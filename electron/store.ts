// ============================================================
// Persistence Layer — electron-store
// ============================================================

import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import type {
  StoreSchema, SSHConnection, Workspace, Folder, Tag, SSHKey, AppSettings,
  DEFAULT_SETTINGS, DEFAULT_WORKSPACE,
} from './types'

const store = new Store<StoreSchema>({
  defaults: {
    connections: [],
    workspaces: [
      {
        id: 'default',
        name: 'All Connections',
        icon: '🏠',
        color: '#3b82f6',
        order: 0,
        createdAt: Date.now(),
      },
    ],
    folders: [],
    tags: [],
    sshKeys: [],
    settings: {
      terminalFontSize: 14,
      terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
      defaultPort: 22,
      defaultUsername: 'root',
    },
  },
})

// ── Connections ──────────────────────────────────────────────

export function getConnections(): SSHConnection[] {
  return store.get('connections')
}

export function getConnectionById(id: string): SSHConnection | undefined {
  return store.get('connections').find(c => c.id === id)
}

export function createConnection(data: Omit<SSHConnection, 'id' | 'createdAt' | 'updatedAt'>): SSHConnection {
  const now = Date.now()
  const connection: SSHConnection = {
    ...data,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  }
  const connections = store.get('connections')
  connections.push(connection)
  store.set('connections', connections)
  return connection
}

export function updateConnection(id: string, data: Partial<SSHConnection>): SSHConnection | null {
  const connections = store.get('connections')
  const index = connections.findIndex(c => c.id === id)
  if (index === -1) return null
  connections[index] = { ...connections[index], ...data, updatedAt: Date.now() }
  store.set('connections', connections)
  return connections[index]
}

export function deleteConnection(id: string): boolean {
  const connections = store.get('connections')
  const filtered = connections.filter(c => c.id !== id)
  if (filtered.length === connections.length) return false
  store.set('connections', filtered)
  return true
}

export function duplicateConnection(id: string): SSHConnection | null {
  const conn = getConnectionById(id)
  if (!conn) return null
  const { id: _id, createdAt: _c, updatedAt: _u, ...data } = conn
  return createConnection({ ...data, name: `${conn.name} (copy)` })
}

export function touchConnection(id: string): void {
  updateConnection(id, { lastConnected: Date.now() })
}

// ── Workspaces ──────────────────────────────────────────────

export function getWorkspaces(): Workspace[] {
  return store.get('workspaces').sort((a, b) => a.order - b.order)
}

export function createWorkspace(data: Pick<Workspace, 'name' | 'icon' | 'color'>): Workspace {
  const workspaces = store.get('workspaces')
  const workspace: Workspace = {
    ...data,
    id: uuidv4(),
    order: workspaces.length,
    createdAt: Date.now(),
  }
  workspaces.push(workspace)
  store.set('workspaces', workspaces)
  return workspace
}

export function updateWorkspace(id: string, data: Partial<Workspace>): Workspace | null {
  const workspaces = store.get('workspaces')
  const index = workspaces.findIndex(w => w.id === id)
  if (index === -1) return null
  workspaces[index] = { ...workspaces[index], ...data }
  store.set('workspaces', workspaces)
  return workspaces[index]
}

export function deleteWorkspace(id: string): boolean {
  if (id === 'default') return false
  const workspaces = store.get('workspaces')
  store.set('workspaces', workspaces.filter(w => w.id !== id))
  // Move orphaned connections to default
  const connections = store.get('connections')
  connections.forEach(c => {
    if (c.workspaceId === id) c.workspaceId = 'default'
  })
  store.set('connections', connections)
  return true
}

// ── Folders ──────────────────────────────────────────────────

export function getFolders(): Folder[] {
  return store.get('folders').sort((a, b) => a.order - b.order)
}

export function getFoldersByWorkspace(workspaceId: string): Folder[] {
  return getFolders().filter(f => f.workspaceId === workspaceId)
}

export function createFolder(data: Pick<Folder, 'name' | 'workspaceId' | 'icon'> & { parentId?: string }): Folder {
  const folders = store.get('folders')
  const folder: Folder = {
    ...data,
    id: uuidv4(),
    parentId: data.parentId || undefined,
    order: folders.filter(f => f.workspaceId === data.workspaceId).length,
    createdAt: Date.now(),
  }
  folders.push(folder)
  store.set('folders', folders)
  return folder
}

export function updateFolder(id: string, data: Partial<Folder>): Folder | null {
  const folders = store.get('folders')
  const idx = folders.findIndex(f => f.id === id)
  if (idx === -1) return null
  folders[idx] = { ...folders[idx], ...data }
  store.set('folders', folders)
  return folders[idx]
}

export function deleteFolder(id: string): boolean {
  const folders = store.get('folders')
  // Collect all descendant folder IDs (recursive)
  const toDelete = new Set<string>()
  function collectChildren(parentId: string) {
    toDelete.add(parentId)
    folders.filter(f => f.parentId === parentId).forEach(f => collectChildren(f.id))
  }
  collectChildren(id)
  store.set('folders', folders.filter(f => !toDelete.has(f.id)))
  // Move orphaned connections back to workspace root (no folder)
  const connections = store.get('connections')
  connections.forEach(c => {
    if (c.folderId && toDelete.has(c.folderId)) {
      c.folderId = undefined
    }
  })
  store.set('connections', connections)
  return true
}

// ── Tags ────────────────────────────────────────────────────

export function getTags(): Tag[] {
  return store.get('tags')
}

export function createTag(data: Pick<Tag, 'name' | 'color'>): Tag {
  const tag: Tag = { ...data, id: uuidv4() }
  const tags = store.get('tags')
  tags.push(tag)
  store.set('tags', tags)
  return tag
}

export function updateTag(id: string, data: Partial<Tag>): Tag | null {
  const tags = store.get('tags')
  const idx = tags.findIndex(t => t.id === id)
  if (idx === -1) return null
  tags[idx] = { ...tags[idx], ...data }
  store.set('tags', tags)
  return tags[idx]
}

export function deleteTag(id: string): boolean {
  const tags = store.get('tags')
  store.set('tags', tags.filter(t => t.id !== id))
  // Remove tag from all connections
  const connections = store.get('connections')
  connections.forEach(c => {
    c.tags = c.tags.filter(t => t !== id)
  })
  store.set('connections', connections)
  return true
}

// ── Settings ────────────────────────────────────────────────

export function getSettings(): AppSettings {
  return store.get('settings')
}

export function updateSettings(data: Partial<AppSettings>): AppSettings {
  const settings = { ...store.get('settings'), ...data }
  store.set('settings', settings)
  return settings
}

// ── SSH Keys ────────────────────────────────────────────────

export function getSSHKeys(): SSHKey[] {
  return store.get('sshKeys') || []
}

export function createSSHKey(data: Pick<SSHKey, 'name' | 'path' | 'passphrase'>): SSHKey {
  const key: SSHKey = {
    ...data,
    id: uuidv4(),
    createdAt: Date.now(),
  }
  const keys = getSSHKeys()
  keys.push(key)
  store.set('sshKeys', keys)
  return key
}

export function updateSSHKey(id: string, data: Partial<SSHKey>): SSHKey | null {
  const keys = getSSHKeys()
  const idx = keys.findIndex(k => k.id === id)
  if (idx === -1) return null
  keys[idx] = { ...keys[idx], ...data }
  store.set('sshKeys', keys)
  return keys[idx]
}

export function deleteSSHKey(id: string): boolean {
  const keys = getSSHKeys()
  const filtered = keys.filter(k => k.id !== id)
  if (filtered.length === keys.length) return false
  store.set('sshKeys', filtered)
  return true
}
