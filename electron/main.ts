// ============================================================
// Electron Main Process
// ============================================================

import { app, BrowserWindow, ipcMain, dialog, powerMonitor } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'

import * as store from './store'
import * as auth from './auth'
import * as sshManager from './ssh-manager'
import type { SSHConnection } from './types'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Helper: get current userId or throw
function requireUserId(): string {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

// ── IPC: Auth ─────────────────────────────────────────────────

ipcMain.handle('auth:register', (_e, username: string, password: string) => {
  return auth.register(username, password)
})

ipcMain.handle('auth:login', (_e, username: string, password: string) => {
  return auth.login(username, password)
})

ipcMain.handle('auth:logout', () => {
  auth.logout()
  return { success: true }
})

ipcMain.handle('auth:current-user', () => {
  return auth.getCurrentUser()
})

// ── Data Encryption ──────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm'

function encryptData(text: string, password?: string): string {
  if (!password) return JSON.stringify({ encrypted: false, data: text })
  
  const salt = crypto.randomBytes(16)
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()
  
  return JSON.stringify({
    encrypted: true,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted
  })
}

function decryptData(jsonString: string, password?: string): string {
  const parsed = JSON.parse(jsonString)
  if (!parsed.encrypted) return parsed.data
  
  if (!password) throw new Error('A password is required to decrypt this backup')
  
  const salt = Buffer.from(parsed.salt, 'base64')
  const iv = Buffer.from(parsed.iv, 'base64')
  const authTag = Buffer.from(parsed.authTag, 'base64')
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(parsed.data, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ── IPC: Data Import / Export ────────────────────────────────

ipcMain.handle('data:export', async (_e, password?: string) => {
  const userId = requireUserId()
  const data = store.getUserDataRaw(userId)
  const jsonString = JSON.stringify(data)

  const defaultPath = path.join(app.getPath('documents'), `ssh-tool-backup-${Date.now()}.mmo-backup`)
  const result = await dialog.showSaveDialog(win!, {
    title: 'Export Data',
    defaultPath,
    filters: [{ name: 'MMO Backup', extensions: ['mmo-backup'] }, { name: 'All Files', extensions: ['*'] }],
  })

  if (result.canceled || !result.filePath) return { success: false, message: 'Canceled' }

  try {
    const fileData = encryptData(jsonString, password)
    await fs.writeFile(result.filePath, fileData, 'utf8')
    return { success: true }
  } catch (err: any) {
    return { success: false, message: err.message }
  }
})

ipcMain.handle('data:import', async (_e, password?: string) => {
  const userId = requireUserId()

  const result = await dialog.showOpenDialog(win!, {
    title: 'Import Data',
    properties: ['openFile'],
    filters: [{ name: 'MMO Backup', extensions: ['mmo-backup'] }, { name: 'All Files', extensions: ['*'] }],
  })

  if (result.canceled || result.filePaths.length === 0) return { success: false, message: 'Canceled' }

  try {
    const fileData = await fs.readFile(result.filePaths[0], 'utf8')
    const decryptedData = decryptData(fileData, password)
    const userData = JSON.parse(decryptedData)
    
    if (!userData.settings || !Array.isArray(userData.connections)) {
      throw new Error('Invalid backup file format')
    }

    store.setUserDataRaw(userId, userData)
    
    return { success: true }
  } catch (err: any) {
    return { success: false, message: err.message }
  }
})

// ── IPC: Connections ──────────────────────────────────────────

ipcMain.handle('connections:list', () => store.getConnections(requireUserId()))
ipcMain.handle('connections:get', (_e, id: string) => store.getConnectionById(requireUserId(), id))

ipcMain.handle('connections:create', (_e, data: Omit<SSHConnection, 'id' | 'createdAt' | 'updatedAt'>) => {
  return store.createConnection(requireUserId(), data)
})

ipcMain.handle('connections:update', (_e, id: string, data: Partial<SSHConnection>) => {
  return store.updateConnection(requireUserId(), id, data)
})

ipcMain.handle('connections:delete', (_e, id: string) => store.deleteConnection(requireUserId(), id))
ipcMain.handle('connections:duplicate', (_e, id: string) => store.duplicateConnection(requireUserId(), id))

// ── IPC: SSH Sessions ─────────────────────────────────────────

ipcMain.handle('ssh:connect', (_e, connectionId: string) => {
  const userId = requireUserId()
  const conn = store.getConnectionById(userId, connectionId)
  if (!conn) return { success: false, message: 'Connection not found' }

  return new Promise((resolve) => {
    sshManager.connect(
      conn,
      (session) => {
        store.touchConnection(userId, connectionId)
        resolve({ success: true, sessionId: session.id })
      },
      (err) => {
        resolve({ success: false, message: err.message })
      },
      (data) => {
        win?.webContents.send('ssh:data', connectionId, data)
      },
      () => {
        win?.webContents.send('ssh:closed', connectionId)
      },
    )
  })
})

ipcMain.handle('ssh:disconnect', (_e, sessionId: string) => {
  sshManager.disconnect(sessionId)
})

ipcMain.on('ssh:input', (_e, sessionId: string, data: string) => {
  sshManager.sendInput(sessionId, data)
})

ipcMain.on('ssh:resize', (_e, sessionId: string, cols: number, rows: number) => {
  sshManager.resizeTerminal(sessionId, cols, rows)
})

ipcMain.handle('ssh:test', async (_e, connData: SSHConnection) => {
  return sshManager.testConnection(connData)
})

ipcMain.handle('ssh:exec', async (_e, connData: SSHConnection, command: string) => {
  return sshManager.execCommand(connData, command)
})

ipcMain.handle('ssh:analyze-log', async (event, connData: SSHConnection, logPath: string, filters: any) => {
  return sshManager.downloadAndParseLog(connData, logPath, filters, (status) => {
    event.sender.send('ssh:analyze-status', status)
  })
})

ipcMain.handle('ssh:active-sessions', () => sshManager.getActiveSessions())

// ── IPC: Workspaces ───────────────────────────────────────────

ipcMain.handle('workspaces:list', () => store.getWorkspaces(requireUserId()))

ipcMain.handle('workspaces:create', (_e, data: { name: string; icon: string; color: string }) => {
  return store.createWorkspace(requireUserId(), data)
})

ipcMain.handle('workspaces:update', (_e, id: string, data: any) => {
  return store.updateWorkspace(requireUserId(), id, data)
})

ipcMain.handle('workspaces:delete', (_e, id: string) => store.deleteWorkspace(requireUserId(), id))

// ── IPC: Folders ──────────────────────────────────────────────

ipcMain.handle('folders:list', () => store.getFolders(requireUserId()))
ipcMain.handle('folders:list-by-workspace', (_e, workspaceId: string) => store.getFoldersByWorkspace(requireUserId(), workspaceId))

ipcMain.handle('folders:create', (_e, data: { name: string; workspaceId: string; icon: string; parentId?: string }) => {
  return store.createFolder(requireUserId(), data)
})

ipcMain.handle('folders:update', (_e, id: string, data: any) => {
  return store.updateFolder(requireUserId(), id, data)
})

ipcMain.handle('folders:delete', (_e, id: string) => store.deleteFolder(requireUserId(), id))

// ── IPC: Tags ─────────────────────────────────────────────────

ipcMain.handle('tags:list', () => store.getTags(requireUserId()))

ipcMain.handle('tags:create', (_e, data: { name: string; color: string }) => {
  return store.createTag(requireUserId(), data)
})

ipcMain.handle('tags:update', (_e, id: string, data: any) => {
  return store.updateTag(requireUserId(), id, data)
})

ipcMain.handle('tags:delete', (_e, id: string) => store.deleteTag(requireUserId(), id))

// ── IPC: Settings ─────────────────────────────────────────────

ipcMain.handle('settings:get', () => store.getSettings(requireUserId()))
ipcMain.handle('settings:update', (_e, data: any) => store.updateSettings(requireUserId(), data))

// ── IPC: SSH Keys ─────────────────────────────────────────────

ipcMain.handle('ssh-keys:list', () => store.getSSHKeys(requireUserId()))

ipcMain.handle('ssh-keys:create', (_e, data: { name: string; path: string; passphrase?: string }) => {
  return store.createSSHKey(requireUserId(), data)
})

ipcMain.handle('ssh-keys:update', (_e, id: string, data: any) => {
  return store.updateSSHKey(requireUserId(), id, data)
})

ipcMain.handle('ssh-keys:delete', (_e, id: string) => store.deleteSSHKey(requireUserId(), id))

// ── IPC: File Dialog ──────────────────────────────────────────

ipcMain.handle('dialog:select-file', async (_e, options?: any) => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    title: 'Select SSH Private Key',
    filters: [{ name: 'All Files', extensions: ['*'] }],
    ...options,
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── App Lifecycle ─────────────────────────────────────────────

app.on('window-all-closed', () => {
  sshManager.disconnectAll()
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()

  function handleScreenLock() {
    if (auth.getCurrentUser()) {
      auth.logout()
      if (win && !win.isDestroyed()) {
        win.webContents.send('app:lock-screen')
      }
    }
  }

  powerMonitor.on('suspend', handleScreenLock)
  powerMonitor.on('lock-screen', handleScreenLock)
})
