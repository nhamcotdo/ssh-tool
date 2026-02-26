// ============================================================
// SSH Connection Manager — ssh2-based
// ============================================================

import { Client, type ConnectConfig, type ClientChannel } from 'ssh2'
import { readFileSync } from 'node:fs'
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
