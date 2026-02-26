// ============================================================
// Persistence Layer — electron-store
// ============================================================

import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import type {
  StoreSchema, SSHConnection, Workspace, Tag, AppSettings,
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
    tags: [],
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
