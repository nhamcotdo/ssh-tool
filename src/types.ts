import type { SshToolAPI } from '../electron/preload'

declare global {
  interface Window {
    sshTool: SshToolAPI
  }
}

// Re-export types for renderer usage
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
  icon: string
  color: string
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

export interface TerminalTab {
  id: string
  connectionId: string
  sessionId: string
  name: string
  connected: boolean
}
