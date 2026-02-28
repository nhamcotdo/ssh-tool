// ============================================================
// Preload — Typed IPC Bridge
// ============================================================

import { ipcRenderer, contextBridge } from 'electron'

const api = {
  // ── Auth ─────────────────────────────────────────────────────
  register: (username: string, password: string) => ipcRenderer.invoke('auth:register', username, password),
  login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth:current-user'),

  // ── Connections ──────────────────────────────────────────────
  listConnections: () => ipcRenderer.invoke('connections:list'),
  getConnection: (id: string) => ipcRenderer.invoke('connections:get', id),
  createConnection: (data: any) => ipcRenderer.invoke('connections:create', data),
  updateConnection: (id: string, data: any) => ipcRenderer.invoke('connections:update', id, data),
  deleteConnection: (id: string) => ipcRenderer.invoke('connections:delete', id),
  duplicateConnection: (id: string) => ipcRenderer.invoke('connections:duplicate', id),

  // ── SSH Sessions ────────────────────────────────────────────
  sshConnect: (connectionId: string) => ipcRenderer.invoke('ssh:connect', connectionId),
  sshDisconnect: (sessionId: string) => ipcRenderer.invoke('ssh:disconnect', sessionId),
  sshInput: (sessionId: string, data: string) => ipcRenderer.send('ssh:input', sessionId, data),
  sshResize: (sessionId: string, cols: number, rows: number) => ipcRenderer.send('ssh:resize', sessionId, cols, rows),
  sshTest: (connData: any) => ipcRenderer.invoke('ssh:test', connData),
  sshActiveSessions: () => ipcRenderer.invoke('ssh:active-sessions'),

  onSshData: (callback: (connectionId: string, data: string) => void) => {
    const handler = (_e: any, connectionId: string, data: string) => callback(connectionId, data)
    ipcRenderer.on('ssh:data', handler)
    return () => ipcRenderer.removeListener('ssh:data', handler)
  },
  onSshClosed: (callback: (connectionId: string) => void) => {
    const handler = (_e: any, connectionId: string) => callback(connectionId)
    ipcRenderer.on('ssh:closed', handler)
    return () => ipcRenderer.removeListener('ssh:closed', handler)
  },

  // ── Workspaces ──────────────────────────────────────────────
  listWorkspaces: () => ipcRenderer.invoke('workspaces:list'),
  createWorkspace: (data: any) => ipcRenderer.invoke('workspaces:create', data),
  updateWorkspace: (id: string, data: any) => ipcRenderer.invoke('workspaces:update', id, data),
  deleteWorkspace: (id: string) => ipcRenderer.invoke('workspaces:delete', id),

  // ── Folders ────────────────────────────────────────────────
  listFolders: () => ipcRenderer.invoke('folders:list'),
  listFoldersByWorkspace: (workspaceId: string) => ipcRenderer.invoke('folders:list-by-workspace', workspaceId),
  createFolder: (data: any) => ipcRenderer.invoke('folders:create', data),
  updateFolder: (id: string, data: any) => ipcRenderer.invoke('folders:update', id, data),
  deleteFolder: (id: string) => ipcRenderer.invoke('folders:delete', id),

  // ── Tags ────────────────────────────────────────────────────
  listTags: () => ipcRenderer.invoke('tags:list'),
  createTag: (data: any) => ipcRenderer.invoke('tags:create', data),
  updateTag: (id: string, data: any) => ipcRenderer.invoke('tags:update', id, data),
  deleteTag: (id: string) => ipcRenderer.invoke('tags:delete', id),

  // ── Settings ────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (data: any) => ipcRenderer.invoke('settings:update', data),

  // ── SSH Keys ────────────────────────────────────────────────
  listSSHKeys: () => ipcRenderer.invoke('ssh-keys:list'),
  createSSHKey: (data: any) => ipcRenderer.invoke('ssh-keys:create', data),
  updateSSHKey: (id: string, data: any) => ipcRenderer.invoke('ssh-keys:update', id, data),
  deleteSSHKey: (id: string) => ipcRenderer.invoke('ssh-keys:delete', id),

  // ── File Dialog ─────────────────────────────────────────────
  selectFile: (options?: any) => ipcRenderer.invoke('dialog:select-file', options),

  // ── Events ──────────────────────────────────────────────────
  onLockScreen: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('app:lock-screen', handler)
    return () => ipcRenderer.removeListener('app:lock-screen', handler)
  },
}

contextBridge.exposeInMainWorld('sshTool', api)

export type SshToolAPI = typeof api
