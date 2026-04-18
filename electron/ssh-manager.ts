// ============================================================
// SSH Connection Manager — ssh2-based
// ============================================================

import { Client, type ConnectConfig, type ClientChannel } from 'ssh2'
import { readFileSync, createReadStream, unlinkSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'
import type { SSHConnection } from './types'

export interface SSHSession {
  id: string
  connectionId: string
  client: Client
  stream: ClientChannel | null
  jumpClient?: Client
}

const activeSessions = new Map<string, SSHSession>()

function buildConfig(conn: SSHConnection): ConnectConfig {
  const config: ConnectConfig = {
    host: conn.host,
    port: conn.port,
    username: conn.username,
    readyTimeout: 10000,
    keepaliveInterval: 30000,
  }

  switch (conn.authType) {
    case 'password':
      config.password = conn.password
      break
    case 'key':
      if (conn.privateKeyPath) {
        config.privateKey = readFileSync(conn.privateKeyPath)
      }
      break
    case 'key+passphrase':
      if (conn.privateKeyPath) {
        config.privateKey = readFileSync(conn.privateKeyPath)
        config.passphrase = conn.passphrase
      }
      break
  }

  return config
}

function connectViaProxy(
  conn: SSHConnection,
  onReady: (session: SSHSession) => void,
  onError: (err: Error) => void,
  onData: (data: string) => void,
  onClose: () => void,
): void {
  const proxy = conn.proxyJump!
  const jumpClient = new Client()

  const jumpConfig: ConnectConfig = {
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    readyTimeout: 10000,
  }

  if (proxy.authType === 'password') {
    jumpConfig.password = proxy.password
  } else if (proxy.privateKeyPath) {
    jumpConfig.privateKey = readFileSync(proxy.privateKeyPath)
  }

  jumpClient.on('ready', () => {
    jumpClient.forwardOut(
      '127.0.0.1', 0,
      conn.host, conn.port,
      (err, stream) => {
        if (err) {
          jumpClient.end()
          onError(err)
          return
        }

        const targetClient = new Client()
        const targetConfig = buildConfig(conn)
        targetConfig.sock = stream

        targetClient.on('ready', () => {
          targetClient.shell({ term: 'xterm-256color' }, (err, shellStream) => {
            if (err) {
              targetClient.end()
              jumpClient.end()
              onError(err)
              return
            }

            const sessionId = `${conn.id}-${Date.now()}`
            const session: SSHSession = {
              id: sessionId,
              connectionId: conn.id,
              client: targetClient,
              stream: shellStream,
              jumpClient,
            }
            activeSessions.set(sessionId, session)

            shellStream.on('data', (data: Buffer) => onData(data.toString('utf-8')))
            shellStream.on('close', () => {
              activeSessions.delete(sessionId)
              targetClient.end()
              jumpClient.end()
              onClose()
            })

            onReady(session)
          })
        })

        targetClient.on('error', (err) => {
          jumpClient.end()
          onError(err)
        })

        targetClient.connect(targetConfig)
      },
    )
  })

  jumpClient.on('error', onError)
  jumpClient.connect(jumpConfig)
}

function connectDirect(
  conn: SSHConnection,
  onReady: (session: SSHSession) => void,
  onError: (err: Error) => void,
  onData: (data: string) => void,
  onClose: () => void,
): void {
  const client = new Client()
  const config = buildConfig(conn)

  client.on('ready', () => {
    client.shell({ term: 'xterm-256color' }, (err, stream) => {
      if (err) {
        client.end()
        onError(err)
        return
      }

      const sessionId = `${conn.id}-${Date.now()}`
      const session: SSHSession = {
        id: sessionId,
        connectionId: conn.id,
        client,
        stream,
      }
      activeSessions.set(sessionId, session)

      stream.on('data', (data: Buffer) => onData(data.toString('utf-8')))
      stream.on('close', () => {
        activeSessions.delete(sessionId)
        client.end()
        onClose()
      })

      onReady(session)
    })
  })

  client.on('error', onError)
  client.connect(config)
}

export function connect(
  conn: SSHConnection,
  onReady: (session: SSHSession) => void,
  onError: (err: Error) => void,
  onData: (data: string) => void,
  onClose: () => void,
): void {
  if (conn.proxyJump?.enabled) {
    connectViaProxy(conn, onReady, onError, onData, onClose)
  } else {
    connectDirect(conn, onReady, onError, onData, onClose)
  }
}

export function disconnect(sessionId: string): void {
  const session = activeSessions.get(sessionId)
  if (!session) return
  session.stream?.end()
  session.client.end()
  session.jumpClient?.end()
  activeSessions.delete(sessionId)
}

export function sendInput(sessionId: string, data: string): void {
  const session = activeSessions.get(sessionId)
  session?.stream?.write(data)
}

export function resizeTerminal(sessionId: string, cols: number, rows: number): void {
  const session = activeSessions.get(sessionId)
  session?.stream?.setWindow(rows, cols, 0, 0)
}

export function getActiveSessions(): string[] {
  return Array.from(activeSessions.keys())
}

export function disconnectAll(): void {
  for (const [id] of activeSessions) {
    disconnect(id)
  }
}

export async function testConnection(conn: SSHConnection): Promise<{ success: boolean; message: string; latency?: number }> {
  return new Promise((resolve) => {
    const start = Date.now()

    const onReady = (session: SSHSession) => {
      const latency = Date.now() - start
      disconnect(session.id)
      resolve({ success: true, message: `Connected in ${latency}ms`, latency })
    }

    const onError = (err: Error) => {
      resolve({ success: false, message: err.message })
    }

    const onData = () => { }
    const onClose = () => { }

    connect(conn, onReady, onError, onData, onClose)

    // Timeout after 15 seconds
    setTimeout(() => {
      resolve({ success: false, message: 'Connection timed out (15s)' })
    }, 15000)
  })
}

export async function execCommand(conn: SSHConnection, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = ''

    const handleStream = (client: Client, stream: ClientChannel, jumpClient?: Client) => {
      stream.on('data', (data: Buffer) => {
        output += data.toString('utf-8')
      })
      stream.stderr.on('data', (data: Buffer) => {
        output += data.toString('utf-8')
      })
      stream.on('close', () => {
        client.end()
        if (jumpClient) jumpClient.end()
        resolve(output)
      })
    }

    if (conn.proxyJump?.enabled) {
      const proxy = conn.proxyJump
      const jumpClient = new Client()
      const jumpConfig: ConnectConfig = {
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        readyTimeout: 10000,
      }
      if (proxy.authType === 'password') jumpConfig.password = proxy.password
      else if (proxy.privateKeyPath) jumpConfig.privateKey = readFileSync(proxy.privateKeyPath)

      jumpClient.on('ready', () => {
        jumpClient.forwardOut('127.0.0.1', 0, conn.host, conn.port, (err, stream) => {
          if (err) { jumpClient.end(); return reject(err) }
          const targetClient = new Client()
          const targetConfig = buildConfig(conn)
          targetConfig.sock = stream

          targetClient.on('ready', () => {
            targetClient.exec(command, (err, shellStream) => {
              if (err) { targetClient.end(); jumpClient.end(); return reject(err) }
              handleStream(targetClient, shellStream, jumpClient)
            })
          })
          targetClient.on('error', (err) => { jumpClient.end(); reject(err) })
          targetClient.connect(targetConfig)
        })
      })
      jumpClient.on('error', reject)
      jumpClient.connect(jumpConfig)
    } else {
      const client = new Client()
      const config = buildConfig(conn)
      client.on('ready', () => {
        client.exec(command, (err, stream) => {
          if (err) { client.end(); return reject(err) }
          handleStream(client, stream)
        })
      })
      client.on('error', reject)
      client.connect(config)
    }
  })
}

const NGINX_REGEX = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d+)\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"/

interface NginxLogFilters {
  dateFilter: 'today' | '7days' | 'this_month' | 'specific' | 'range'
  startDate?: string
  endDate?: string
}

function buildDatePattern(filters: NginxLogFilters): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const formatDate = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${months[d.getMonth()]}/${d.getFullYear()}`

  if (filters.dateFilter === 'this_month') {
    const d = new Date()
    return `${months[d.getMonth()]}/${d.getFullYear()}`
  }

  const targetDates: Date[] = []
  const today = new Date()

  if (filters.dateFilter === 'today') {
    targetDates.push(today)
  } else if (filters.dateFilter === '7days') {
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      targetDates.push(d)
    }
  } else if (filters.dateFilter === 'specific' && filters.startDate) {
    const [y, m, d] = filters.startDate.split('-').map(Number)
    if (!isNaN(y)) targetDates.push(new Date(y, m - 1, d))
  } else if (filters.dateFilter === 'range' && filters.startDate && filters.endDate) {
    let [sy, sm, sd] = filters.startDate.split('-').map(Number)
    let [ey, em, ed] = filters.endDate.split('-').map(Number)
    if (!isNaN(sy) && !isNaN(ey)) {
      const start = new Date(sy, sm - 1, sd)
      const end = new Date(ey, em - 1, ed)
      let iter = new Date(start)
      // limit to 31 days max logic to ensure bash doesn't blow up
      let guards = 0
      while (iter <= end && guards < 32) {
        targetDates.push(new Date(iter))
        iter.setDate(iter.getDate() + 1)
        guards++
      }
    }
  }

  if (targetDates.length > 0) {
    return targetDates.map(d => formatDate(d)).join('|')
  }

  return ""
}

export async function downloadAndParseLog(conn: SSHConnection, remotePath: string, filters?: NginxLogFilters, onProgress?: (msg: string) => void): Promise<any[]> {
  onProgress?.('Đang khởi tạo kết nối SSH...')
  return new Promise((resolve, reject) => {
    let command = `tail -n 200000 "${remotePath}"`
    if (filters) {
      const pattern = buildDatePattern(filters)
      if (pattern && pattern.includes('|')) {
        command = `grep -E "${pattern}" "${remotePath}" | tail -n 200000`
      } else if (pattern) {
        command = `grep "${pattern}" "${remotePath}" | tail -n 200000`
      }
    }

    const handleStream = (client: Client, stream: any, jumpClient?: Client) => {
      let closed = false
      const closeClients = () => {
        if (closed) return
        closed = true
        client.end()
        if (jumpClient) jumpClient.end()
      }

      onProgress?.('Đang bắt đầu đọc luồng dữ liệu...')
      parseLogStream(stream).then(logs => {
        closeClients()
        resolve(logs)
      }).catch(err => {
        closeClients()
        reject(err)
      })

      stream.on('close', () => { closeClients() })
    }

    if (conn.proxyJump?.enabled) {
      const proxy = conn.proxyJump
      const jumpClient = new Client()
      const jumpConfig: ConnectConfig = {
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        readyTimeout: 10000,
      }
      if (proxy.authType === 'password') jumpConfig.password = proxy.password
      else if (proxy.privateKeyPath) jumpConfig.privateKey = readFileSync(proxy.privateKeyPath)

      onProgress?.('Đang kết nối qua Proxy Jump...')
      jumpClient.on('ready', () => {
        onProgress?.('Đang khởi tạo chuyển tiếp cổng...')
        jumpClient.forwardOut('127.0.0.1', 0, conn.host, conn.port || 22, (err, fwdStream) => {
          if (err) { jumpClient.end(); return reject(err) }
          const targetClient = new Client()
          const targetConfig = buildConfig(conn)
          targetConfig.sock = fwdStream

          targetClient.on('ready', () => {
            targetClient.exec(command, (err, shellStream) => {
              if (err) { targetClient.end(); jumpClient.end(); return reject(err) }
              handleStream(targetClient, shellStream, jumpClient)
            })
          })
          targetClient.on('error', (err) => { jumpClient.end(); reject(err) })
          targetClient.connect(targetConfig)
        })
      })
      jumpClient.on('error', reject)
      jumpClient.connect(jumpConfig)
    } else {
      const client = new Client()
      const config = buildConfig(conn)
      client.on('ready', () => {
        client.exec(command, (err, stream) => {
          if (err) { client.end(); return reject(err) }
          handleStream(client, stream)
        })
      })
      client.on('error', reject)
      client.connect(config)
    }
  })
}

async function parseLogStream(inputStream: any) {
  const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity })

  const entries: any[] = []

  const MAX_RECORDS = 200000 // Safe hard cap ~150MB RAM limit
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

  let totalLines = 0
  let matchCount = 0
  let passDateCount = 0

  for await (const line of rl) {
    if (!line.trim()) continue
    totalLines++
    const match = NGINX_REGEX.exec(line)
    if (match) {
      matchCount++
      try {
        const timeLocal = match[2]
        const normalizedTime = timeLocal.replace(':', ' ')
        const ts = new Date(normalizedTime).getTime()

        if (!isNaN(ts)) {
          const reqParts = match[3].split(' ')
          let bytes = parseInt(match[5], 10)
          if (isNaN(bytes)) bytes = 0

          entries.push({
            raw: line,
            ip: match[1],
            timestamp: new Date(ts).toISOString(),
            method: reqParts[0],
            path: reqParts[1] || '',
            status: parseInt(match[4], 10),
            bytes: bytes,
            referer: match[6],
            userAgent: match[7]
          })

          // Prune sliding window to 1 month from latest record periodically
          if (entries.length % 50000 === 0) {
            const currentMaxTs = ts
            const limit = currentMaxTs - THIRTY_DAYS_MS
            let dropCount = 0
            while (dropCount < entries.length && new Date(entries[dropCount].timestamp).getTime() < limit) {
              dropCount++
            }
            if (dropCount > 0) {
              entries.splice(0, dropCount)
            }
          }

          // if (entries.length > MAX_RECORDS) {
          //   entries.shift()
          // }
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // Final prune for 1 month of latest data
  if (entries.length > 0) {
    const latestTs = new Date(entries[entries.length - 1].timestamp).getTime()
    const finalLimit = latestTs - THIRTY_DAYS_MS
    let dropCount = 0
    while (dropCount < entries.length && new Date(entries[dropCount].timestamp).getTime() < finalLimit) {
      dropCount++
    }
    if (dropCount > 0) entries.splice(0, dropCount)
  }

  return entries
}
