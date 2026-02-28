import type { SshToolAPI } from '../electron/preload'

declare global {
  interface Window {
    sshTool: SshToolAPI
  }
}

// Re-export types for renderer usage
export interface UserAccount {
  id: string
  username: string
}

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
  folderId?: string
  tags: string[]
  notes?: string
  lastConnected?: number
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  workspaceId: string
  parentId?: string
  icon: string
  order: number
  createdAt: number
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

export interface SSHKey {
  id: string
  name: string
  path: string
  passphrase?: string
  createdAt: number
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
  connecting?: boolean
}
