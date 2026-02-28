// ============================================================
// Persistence Layer — electron-store (per-user data)
// ============================================================

import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import type {
  StoreSchema, SSHConnection, Workspace, Folder, Tag, SSHKey, AppSettings, UserData,
} from './types'
import { DEFAULT_SETTINGS, DEFAULT_WORKSPACE } from './types'

const store = new Store<StoreSchema>({
  defaults: {
    userData: {},
  },
})

// ── User Data Helper ────────────────────────────────────────

function getUserData(userId: string): UserData {
  const all = store.get('userData')
  if (!all[userId]) {
    // Initialize data for new user
    const data: UserData = {
      connections: [],
      workspaces: [{ ...DEFAULT_WORKSPACE, createdAt: Date.now() }],
      folders: [],
      tags: [],
      sshKeys: [],
      settings: { ...DEFAULT_SETTINGS },
    }
    all[userId] = data
    store.set('userData', all)
  }
  return all[userId]
}

function setUserData(userId: string, data: UserData): void {
  const all = store.get('userData')
  all[userId] = data
  store.set('userData', all)
}

// ── Connections ──────────────────────────────────────────────

export function getConnections(userId: string): SSHConnection[] {
  return getUserData(userId).connections
}

export function getConnectionById(userId: string, id: string): SSHConnection | undefined {
  return getUserData(userId).connections.find(c => c.id === id)
}

export function createConnection(userId: string, data: Omit<SSHConnection, 'id' | 'createdAt' | 'updatedAt'>): SSHConnection {
  const now = Date.now()
  const connection: SSHConnection = {
    ...data,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  }
  const ud = getUserData(userId)
  ud.connections.push(connection)
  setUserData(userId, ud)
  return connection
}

export function updateConnection(userId: string, id: string, data: Partial<SSHConnection>): SSHConnection | null {
  const ud = getUserData(userId)
  const index = ud.connections.findIndex(c => c.id === id)
  if (index === -1) return null
  ud.connections[index] = { ...ud.connections[index], ...data, updatedAt: Date.now() }
  setUserData(userId, ud)
  return ud.connections[index]
}

export function deleteConnection(userId: string, id: string): boolean {
  const ud = getUserData(userId)
  const len = ud.connections.length
  ud.connections = ud.connections.filter(c => c.id !== id)
  if (ud.connections.length === len) return false
  setUserData(userId, ud)
  return true
}

export function duplicateConnection(userId: string, id: string): SSHConnection | null {
  const conn = getConnectionById(userId, id)
  if (!conn) return null
  const { id: _id, createdAt: _c, updatedAt: _u, ...data } = conn
  return createConnection(userId, { ...data, name: `${conn.name} (copy)` })
}

export function touchConnection(userId: string, id: string): void {
  updateConnection(userId, id, { lastConnected: Date.now() })
}

// ── Workspaces ──────────────────────────────────────────────

export function getWorkspaces(userId: string): Workspace[] {
  return getUserData(userId).workspaces.sort((a, b) => a.order - b.order)
}

export function createWorkspace(userId: string, data: Pick<Workspace, 'name' | 'icon' | 'color'>): Workspace {
  const ud = getUserData(userId)
  const workspace: Workspace = {
    ...data,
    id: uuidv4(),
    order: ud.workspaces.length,
    createdAt: Date.now(),
  }
  ud.workspaces.push(workspace)
  setUserData(userId, ud)
  return workspace
}

export function updateWorkspace(userId: string, id: string, data: Partial<Workspace>): Workspace | null {
  const ud = getUserData(userId)
  const index = ud.workspaces.findIndex(w => w.id === id)
  if (index === -1) return null
  ud.workspaces[index] = { ...ud.workspaces[index], ...data }
  setUserData(userId, ud)
  return ud.workspaces[index]
}

export function deleteWorkspace(userId: string, id: string): boolean {
  if (id === 'default') return false
  const ud = getUserData(userId)
  ud.workspaces = ud.workspaces.filter(w => w.id !== id)
  ud.connections.forEach(c => {
    if (c.workspaceId === id) c.workspaceId = 'default'
  })
  setUserData(userId, ud)
  return true
}

// ── Folders ──────────────────────────────────────────────────

export function getFolders(userId: string): Folder[] {
  return getUserData(userId).folders.sort((a, b) => a.order - b.order)
}

export function getFoldersByWorkspace(userId: string, workspaceId: string): Folder[] {
  return getFolders(userId).filter(f => f.workspaceId === workspaceId)
}

export function createFolder(userId: string, data: Pick<Folder, 'name' | 'workspaceId' | 'icon'> & { parentId?: string }): Folder {
  const ud = getUserData(userId)
  const folder: Folder = {
    ...data,
    id: uuidv4(),
    parentId: data.parentId || undefined,
    order: ud.folders.filter(f => f.workspaceId === data.workspaceId).length,
    createdAt: Date.now(),
  }
  ud.folders.push(folder)
  setUserData(userId, ud)
  return folder
}

export function updateFolder(userId: string, id: string, data: Partial<Folder>): Folder | null {
  const ud = getUserData(userId)
  const idx = ud.folders.findIndex(f => f.id === id)
  if (idx === -1) return null
  ud.folders[idx] = { ...ud.folders[idx], ...data }
  setUserData(userId, ud)
  return ud.folders[idx]
}

export function deleteFolder(userId: string, id: string): boolean {
  const ud = getUserData(userId)
  const toDelete = new Set<string>()
  function collectChildren(parentId: string) {
    toDelete.add(parentId)
    ud.folders.filter(f => f.parentId === parentId).forEach(f => collectChildren(f.id))
  }
  collectChildren(id)
  ud.folders = ud.folders.filter(f => !toDelete.has(f.id))
  ud.connections.forEach(c => {
    if (c.folderId && toDelete.has(c.folderId)) {
      c.folderId = undefined
    }
  })
  setUserData(userId, ud)
  return true
}

// ── Tags ────────────────────────────────────────────────────

export function getTags(userId: string): Tag[] {
  return getUserData(userId).tags
}

export function createTag(userId: string, data: Pick<Tag, 'name' | 'color'>): Tag {
  const tag: Tag = { ...data, id: uuidv4() }
  const ud = getUserData(userId)
  ud.tags.push(tag)
  setUserData(userId, ud)
  return tag
}

export function updateTag(userId: string, id: string, data: Partial<Tag>): Tag | null {
  const ud = getUserData(userId)
  const idx = ud.tags.findIndex(t => t.id === id)
  if (idx === -1) return null
  ud.tags[idx] = { ...ud.tags[idx], ...data }
  setUserData(userId, ud)
  return ud.tags[idx]
}

export function deleteTag(userId: string, id: string): boolean {
  const ud = getUserData(userId)
  ud.tags = ud.tags.filter(t => t.id !== id)
  ud.connections.forEach(c => {
    c.tags = c.tags.filter(t => t !== id)
  })
  setUserData(userId, ud)
  return true
}

// ── Settings ────────────────────────────────────────────────

export function getSettings(userId: string): AppSettings {
  return getUserData(userId).settings
}

export function updateSettings(userId: string, data: Partial<AppSettings>): AppSettings {
  const ud = getUserData(userId)
  ud.settings = { ...ud.settings, ...data }
  setUserData(userId, ud)
  return ud.settings
}

// ── SSH Keys ────────────────────────────────────────────────

export function getSSHKeys(userId: string): SSHKey[] {
  return getUserData(userId).sshKeys || []
}

export function createSSHKey(userId: string, data: Pick<SSHKey, 'name' | 'path' | 'passphrase'>): SSHKey {
  const key: SSHKey = {
    ...data,
    id: uuidv4(),
    createdAt: Date.now(),
  }
  const ud = getUserData(userId)
  if (!ud.sshKeys) ud.sshKeys = []
  ud.sshKeys.push(key)
  setUserData(userId, ud)
  return key
}

export function updateSSHKey(userId: string, id: string, data: Partial<SSHKey>): SSHKey | null {
  const ud = getUserData(userId)
  if (!ud.sshKeys) return null
  const idx = ud.sshKeys.findIndex(k => k.id === id)
  if (idx === -1) return null
  ud.sshKeys[idx] = { ...ud.sshKeys[idx], ...data }
  setUserData(userId, ud)
  return ud.sshKeys[idx]
}

export function deleteSSHKey(userId: string, id: string): boolean {
  const ud = getUserData(userId)
  if (!ud.sshKeys) return false
  const filtered = ud.sshKeys.filter(k => k.id !== id)
  if (filtered.length === ud.sshKeys.length) return false
  ud.sshKeys = filtered
  setUserData(userId, ud)
  return true
}
