// ============================================================
// SSH Tool - Core Type Definitions
// ============================================================

export interface ProxyJumpConfig {
  enabled: boolean
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  privateKeyPath?: string
}

export interface SSHConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key' | 'key+passphrase'
  password?: string
  privateKeyPath?: string
  passphrase?: string
  proxyJump?: ProxyJumpConfig
  workspaceId: string
  tags: string[]
  notes?: string
  lastConnected?: number
  createdAt: number
  updatedAt: number
}

export interface Workspace {
  id: string
  name: string
  icon: string       // emoji
  color: string      // hex color
  order: number
  createdAt: number
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface AppSettings {
  terminalFontSize: number
  terminalFontFamily: string
  defaultPort: number
  defaultUsername: string
}

export interface StoreSchema {
  connections: SSHConnection[]
  workspaces: Workspace[]
  tags: Tag[]
  settings: AppSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  terminalFontSize: 14,
  terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
  defaultPort: 22,
  defaultUsername: 'root',
}

export const DEFAULT_WORKSPACE: Workspace = {
  id: 'default',
  name: 'All Connections',
  icon: '🏠',
  color: '#3b82f6',
  order: 0,
  createdAt: Date.now(),
}
