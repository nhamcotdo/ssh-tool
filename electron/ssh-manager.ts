// ============================================================
// SSH Connection Manager — ssh2-based
// ============================================================

import { Client, type ConnectConfig, type ClientChannel } from 'ssh2'
import { readFileSync, createReadStream, unlinkSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'
import type { SSHConnection, JumpHostConfig } from './types'

export interface SSHSession {
  id: string
  connectionId: string
  client: Client
  stream: ClientChannel | null
}

const activeSessions = new Map<string, SSHSession>()
// Stores all jump-hop clients so they can be closed on disconnect
const sessionJumpClients = new Map<string, Client[]>()

// ── Build target SSH config ───────────────────────────────────────────────────
function buildConfig(conn: SSHConnection): ConnectConfig {
  const config: ConnectConfig = {
    host: conn.host,
    port: conn.port,
    username: conn.username,
    readyTimeout: 10000,
    keepaliveInterval: 30000,
  }
  switch (conn.authType) {
    case 'password': config.password = conn.password; break
    case 'key':
      if (conn.privateKeyPath) config.privateKey = readFileSync(conn.privateKeyPath)
      break
    case 'key+passphrase':
      if (conn.privateKeyPath) { config.privateKey = readFileSync(conn.privateKeyPath); config.passphrase = conn.passphrase }
      break
  }
  return config
}

// ── Build hop SSH config ──────────────────────────────────────────────────────
function buildHopConfig(hop: JumpHostConfig, sock?: any): ConnectConfig {
  const cfg: ConnectConfig = { host: hop.host, port: hop.port, username: hop.username, readyTimeout: 10000 }
  if (hop.authType === 'password') cfg.password = hop.password
  else if (hop.privateKeyPath) cfg.privateKey = readFileSync(hop.privateKeyPath)
  if (sock) cfg.sock = sock
  return cfg
}

// ── Recursive proxy chain resolver ───────────────────────────────────────────
// Follows sourceConnectionId links: if A jumps via B and B jumps via C (and C via D),
// the resolved chain is [D, C, B] — tunnel order from outermost to innermost hop.
// A depth guard of 20 prevents infinite loops.
function resolveProxyChain(
  conn: SSHConnection,
  allConns: SSHConnection[],
  visited = new Set<string>(),
): JumpHostConfig[] {
  const pj = conn.proxyJump as any
  if (!pj?.enabled) return []
  if (visited.has(conn.id)) return []   // circular guard
  visited.add(conn.id)

  // Build the hop for this level
  const hop: JumpHostConfig = {
    host: pj.host, port: pj.port, username: pj.username,
    authType: pj.authType || 'password',
    password: pj.password, privateKeyPath: pj.privateKeyPath,
  }

  // If the jump host is a saved connection, recursively resolve ITS chain first
  if (pj.sourceConnectionId) {
    const srcConn = allConns.find(c => c.id === pj.sourceConnectionId)
    if (srcConn && (srcConn.proxyJump as any)?.enabled) {
      // srcConn's chain goes first (deepest hops), then this hop
      return [...resolveProxyChain(srcConn, allConns, visited), hop]
    }
  }

  return [hop]
}

// ── Core: build N-hop tunnel, returns stream to final target ─────────────────
// Connects hop[0] directly, then tunnels hop[1]...hop[N-1], then forwards to target.
// Returns all created hop clients for cleanup.
function buildProxyChain(
  chain: JumpHostConfig[],
  targetHost: string,
  targetPort: number,
): Promise<{ stream: any; hopClients: Client[] }> {
  return new Promise((resolve, reject) => {
    const hopClients: Client[] = []

    function connectHop(index: number, sock?: any): void {
      const hop = chain[index]
      const client = new Client()
      hopClients.push(client)

      client.on('ready', () => {
        const nextHost = index + 1 < chain.length ? chain[index + 1].host : targetHost
        const nextPort = index + 1 < chain.length ? chain[index + 1].port : targetPort

        client.forwardOut('127.0.0.1', 0, nextHost, nextPort, (err, fwdStream) => {
          if (err) { hopClients.forEach(c => c.end()); reject(err); return }

          if (index + 1 < chain.length) {
            connectHop(index + 1, fwdStream)
          } else {
            resolve({ stream: fwdStream, hopClients })
          }
        })
      })

      client.on('error', (err) => { hopClients.forEach(c => c.end()); reject(err) })
      client.connect(buildHopConfig(hop, sock))
    }

    connectHop(0)
  })
}

// ── Connect via proxy chain (shell) ──────────────────────────────────────────
async function connectViaProxy(
  conn: SSHConnection,
  allConns: SSHConnection[],
  onReady: (session: SSHSession) => void,
  onError: (err: Error) => void,
  onData: (data: string) => void,
  onClose: () => void,
): Promise<void> {
  const chain = resolveProxyChain(conn, allConns)
  try {
    const { stream: proxyStream, hopClients } = await buildProxyChain(chain, conn.host, conn.port)
    const targetClient = new Client()
    const targetConfig = buildConfig(conn)
    targetConfig.sock = proxyStream

    targetClient.on('ready', () => {
      targetClient.shell({ term: 'xterm-256color' }, (err, shellStream) => {
        if (err) { targetClient.end(); hopClients.forEach(c => c.end()); onError(err); return }

        const sessionId = `${conn.id}-${Date.now()}`
        activeSessions.set(sessionId, { id: sessionId, connectionId: conn.id, client: targetClient, stream: shellStream })
        sessionJumpClients.set(sessionId, hopClients)

        shellStream.on('data', (data: Buffer) => onData(data.toString('utf-8')))
        shellStream.on('close', () => {
          activeSessions.delete(sessionId)
          sessionJumpClients.delete(sessionId)
          targetClient.end()
          hopClients.forEach(c => c.end())
          onClose()
        })
        onReady(activeSessions.get(sessionId)!)
      })
    })
    targetClient.on('error', (err) => { hopClients.forEach(c => c.end()); onError(err) })
    targetClient.connect(targetConfig)
  } catch (err) {
    onError(err as Error)
  }
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
      if (err) { client.end(); onError(err); return }

      const sessionId = `${conn.id}-${Date.now()}`
      activeSessions.set(sessionId, { id: sessionId, connectionId: conn.id, client, stream })

      stream.on('data', (data: Buffer) => onData(data.toString('utf-8')))
      stream.on('close', () => { activeSessions.delete(sessionId); client.end(); onClose() })
      onReady(activeSessions.get(sessionId)!)
    })
  })
  client.on('error', onError)
  client.connect(config)
}

export function connect(
  conn: SSHConnection,
  allConns: SSHConnection[],
  onReady: (session: SSHSession) => void,
  onError: (err: Error) => void,
  onData: (data: string) => void,
  onClose: () => void,
): void {
  if (conn.proxyJump?.enabled) {
    connectViaProxy(conn, allConns, onReady, onError, onData, onClose)
  } else {
    connectDirect(conn, onReady, onError, onData, onClose)
  }
}

export function disconnect(sessionId: string): void {
  const session = activeSessions.get(sessionId)
  if (!session) return
  session.stream?.end()
  session.client.end()
  sessionJumpClients.get(sessionId)?.forEach(c => c.end())
  sessionJumpClients.delete(sessionId)
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

export async function testConnection(conn: SSHConnection, allConns: SSHConnection[] = []): Promise<{ success: boolean; message: string; latency?: number }> {
  return new Promise((resolve) => {
    const start = Date.now()
    const onReady = (session: SSHSession) => {
      const latency = Date.now() - start
      disconnect(session.id)
      resolve({ success: true, message: `Connected in ${latency}ms`, latency })
    }
    const onError = (err: Error) => resolve({ success: false, message: err.message })
    connect(conn, allConns, onReady, onError, () => {}, () => {})
    setTimeout(() => resolve({ success: false, message: 'Connection timed out (15s)' }), 15000)
  })
}

export async function execCommand(conn: SSHConnection, command: string, allConns: SSHConnection[] = []): Promise<string> {
  let output = ''

  const runExec = (client: Client, hopClients: Client[] = []): Promise<string> =>
    new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) { client.end(); hopClients.forEach(c => c.end()); return reject(err) }
        stream.on('data', (d: Buffer) => { output += d.toString('utf-8') })
        stream.stderr.on('data', (d: Buffer) => { output += d.toString('utf-8') })
        stream.on('close', () => { client.end(); hopClients.forEach(c => c.end()); resolve(output) })
      })
    })

  if (conn.proxyJump?.enabled) {
    const chain = resolveProxyChain(conn, allConns)
    const { stream, hopClients } = await buildProxyChain(chain, conn.host, conn.port)
    const targetClient = new Client()
    targetClient.connect({ ...buildConfig(conn), sock: stream })
    return new Promise((resolve, reject) => {
      targetClient.on('ready', () => runExec(targetClient, hopClients).then(resolve).catch(reject))
      targetClient.on('error', (err) => { hopClients.forEach(c => c.end()); reject(err) })
    })
  } else {
    const client = new Client()
    client.connect(buildConfig(conn))
    return new Promise((resolve, reject) => {
      client.on('ready', () => runExec(client).then(resolve).catch(reject))
      client.on('error', reject)
    })
  }
}



export interface DetectedLogFile {
  path: string
  name: string
  sizeBytes: number
}

export async function detectNginxLogFiles(conn: SSHConnection, allConns: SSHConnection[] = []): Promise<DetectedLogFile[]> {
  const command = `
    set -o pipefail 2>/dev/null || true
    config_logs=$(
      (nginx -T 2>/dev/null || cat \
        /etc/nginx/nginx.conf \
        /etc/nginx/conf.d/*.conf \
        /etc/nginx/sites-enabled/* \
        /www/server/nginx/conf/nginx.conf \
        /www/server/nginx/conf/vhost/*.conf \
        /www/server/panel/vhost/nginx/*.conf \
        2>/dev/null) \
      | grep -E 'access_log|error_log' \
      | grep -v '#' \
      | grep -oE '/[^ ;]+\\.log' \
      | sort -u
    ) 2>/dev/null
    default_paths=(
      /var/log/nginx/access.log /var/log/nginx/error.log /var/log/nginx/access.log.1
      /usr/local/nginx/logs/access.log /usr/local/nginx/logs/error.log
      /opt/nginx/logs/access.log /www/wwwlogs/access.log /www/wwwlogs/nginx_error.log
      /home/*/logs/nginx/access.log /home/*/logs/access.log
    )
    all_candidates="$config_logs"$'\\n'"$(printf '%s\\n' "\${default_paths[@]}")"
    extra=$(find /var/log/nginx /usr/local/nginx/logs /opt/nginx/logs /www/wwwlogs -name "*.log" -type f 2>/dev/null)
    all_candidates="$all_candidates"$'\\n'"$extra"
    echo "$all_candidates" | sort -u | while IFS= read -r p; do
      [ -z "$p" ] && continue
      if [ -f "$p" ] && [ -r "$p" ]; then
        size=$(stat -c%s "$p" 2>/dev/null || stat -f%z "$p" 2>/dev/null || echo 0)
        echo "$size $p"
      fi
    done
  `.trim()

  const output = await execCommand(conn, `bash -c '${command.replace(/'/g, "'\\''")}'`, allConns)
  const results: DetectedLogFile[] = []
  const seen = new Set<string>()
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const spaceIdx = trimmed.indexOf(' ')
    if (spaceIdx === -1) continue
    const filePath = trimmed.substring(spaceIdx + 1).trim()
    if (!filePath || seen.has(filePath)) continue
    seen.add(filePath)
    results.push({ path: filePath, name: filePath.split('/').pop() || filePath, sizeBytes: parseInt(trimmed.substring(0, spaceIdx), 10) || 0 })
  }
  results.sort((a, b) => {
    const aIsAccess = a.name.startsWith('access') ? 0 : 1
    const bIsAccess = b.name.startsWith('access') ? 0 : 1
    return aIsAccess !== bIsAccess ? aIsAccess - bIsAccess : a.path.localeCompare(b.path)
  })
  return results
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
  if (filters.dateFilter === 'this_month') { const d = new Date(); return `${months[d.getMonth()]}/${d.getFullYear()}` }
  const targetDates: Date[] = []
  if (filters.dateFilter === 'today') { targetDates.push(new Date()) }
  else if (filters.dateFilter === '7days') { for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); targetDates.push(d) } }
  else if (filters.dateFilter === 'specific' && filters.startDate) { const [y, m, d] = filters.startDate.split('-').map(Number); if (!isNaN(y)) targetDates.push(new Date(y, m - 1, d)) }
  else if (filters.dateFilter === 'range' && filters.startDate && filters.endDate) {
    const [sy, sm, sd] = filters.startDate.split('-').map(Number)
    const [ey, em, ed] = filters.endDate.split('-').map(Number)
    if (!isNaN(sy) && !isNaN(ey)) {
      let iter = new Date(sy, sm - 1, sd); const end = new Date(ey, em - 1, ed); let g = 0
      while (iter <= end && g++ < 32) { targetDates.push(new Date(iter)); iter.setDate(iter.getDate() + 1) }
    }
  }
  return targetDates.length > 0 ? targetDates.map(d => formatDate(d)).join('|') : ''
}

export async function downloadAndParseLog(conn: SSHConnection, remotePath: string, filters?: NginxLogFilters, onProgress?: (msg: string) => void, allConns: SSHConnection[] = []): Promise<any[]> {
  onProgress?.('Đang khởi tạo kết nối SSH...')
  let command = `tail -n 200000 "${remotePath}"`
  if (filters) {
    const pattern = buildDatePattern(filters)
    if (pattern && pattern.includes('|')) command = `grep -E "${pattern}" "${remotePath}" | tail -n 200000`
    else if (pattern) command = `grep "${pattern}" "${remotePath}" | tail -n 200000`
  }

  const runAndParse = (client: Client, hopClients: Client[] = []): Promise<any[]> =>
    new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) { client.end(); hopClients.forEach(c => c.end()); return reject(err) }
        onProgress?.('Đang đọc dữ liệu log...')
        parseLogStream(stream)
          .then(logs => { client.end(); hopClients.forEach(c => c.end()); resolve(logs) })
          .catch(err => { client.end(); hopClients.forEach(c => c.end()); reject(err) })
        stream.on('close', () => {})
      })
    })

  if (conn.proxyJump?.enabled) {
    const chain = resolveProxyChain(conn, allConns)
    onProgress?.(`Đang kết nối qua ${chain.length} hop(s)...`)
    const { stream, hopClients } = await buildProxyChain(chain, conn.host, conn.port || 22)
    const targetClient = new Client()
    targetClient.connect({ ...buildConfig(conn), sock: stream })
    return new Promise((resolve, reject) => {
      targetClient.on('ready', () => runAndParse(targetClient, hopClients).then(resolve).catch(reject))
      targetClient.on('error', (err) => { hopClients.forEach(c => c.end()); reject(err) })
    })
  } else {
    const client = new Client()
    client.connect(buildConfig(conn))
    return new Promise((resolve, reject) => {
      client.on('ready', () => runAndParse(client).then(resolve).catch(reject))
      client.on('error', reject)
    })
  }
}


async function parseLogStream(inputStream: any) {
  const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity })
  const entries: any[] = []
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

  for await (const line of rl) {
    if (!line.trim()) continue
    const match = NGINX_REGEX.exec(line)
    if (match) {
      try {
        const ts = new Date(match[2].replace(':', ' ')).getTime()
        if (!isNaN(ts)) {
          const reqParts = match[3].split(' ')
          let bytes = parseInt(match[5], 10); if (isNaN(bytes)) bytes = 0
          entries.push({ raw: line, ip: match[1], timestamp: new Date(ts).toISOString(), method: reqParts[0], path: reqParts[1] || '', status: parseInt(match[4], 10), bytes, referer: match[6], userAgent: match[7] })
          if (entries.length % 50000 === 0) {
            const limit = ts - THIRTY_DAYS_MS
            let drop = 0
            while (drop < entries.length && new Date(entries[drop].timestamp).getTime() < limit) drop++
            if (drop > 0) entries.splice(0, drop)
          }
        }
      } catch { /* ignore */ }
    }
  }

  if (entries.length > 0) {
    const latestTs = new Date(entries[entries.length - 1].timestamp).getTime()
    const limit = latestTs - THIRTY_DAYS_MS
    let drop = 0
    while (drop < entries.length && new Date(entries[drop].timestamp).getTime() < limit) drop++
    if (drop > 0) entries.splice(0, drop)
  }
  return entries
}
