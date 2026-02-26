// ============================================================
// Electron Main Process
// ============================================================

import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import * as store from './store'
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

// ── IPC: Connections ──────────────────────────────────────────

ipcMain.handle('connections:list', () => store.getConnections())
ipcMain.handle('connections:get', (_e, id: string) => store.getConnectionById(id))

ipcMain.handle('connections:create', (_e, data: Omit<SSHConnection, 'id' | 'createdAt' | 'updatedAt'>) => {
  return store.createConnection(data)
})

ipcMain.handle('connections:update', (_e, id: string, data: Partial<SSHConnection>) => {
  return store.updateConnection(id, data)
})

ipcMain.handle('connections:delete', (_e, id: string) => store.deleteConnection(id))
ipcMain.handle('connections:duplicate', (_e, id: string) => store.duplicateConnection(id))

// ── IPC: SSH Sessions ─────────────────────────────────────────

ipcMain.handle('ssh:connect', (_e, connectionId: string) => {
  const conn = store.getConnectionById(connectionId)
  if (!conn) return { success: false, message: 'Connection not found' }

  return new Promise((resolve) => {
    sshManager.connect(
      conn,
      (session) => {
        store.touchConnection(connectionId)
        // Forward SSH data to renderer
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

ipcMain.handle('ssh:active-sessions', () => sshManager.getActiveSessions())

// ── IPC: Workspaces ───────────────────────────────────────────

ipcMain.handle('workspaces:list', () => store.getWorkspaces())

ipcMain.handle('workspaces:create', (_e, data: { name: string; icon: string; color: string }) => {
  return store.createWorkspace(data)
})

ipcMain.handle('workspaces:update', (_e, id: string, data: any) => {
  return store.updateWorkspace(id, data)
})

ipcMain.handle('workspaces:delete', (_e, id: string) => store.deleteWorkspace(id))

// ── IPC: Tags ─────────────────────────────────────────────────

ipcMain.handle('tags:list', () => store.getTags())

ipcMain.handle('tags:create', (_e, data: { name: string; color: string }) => {
  return store.createTag(data)
})

ipcMain.handle('tags:update', (_e, id: string, data: any) => {
  return store.updateTag(id, data)
})

ipcMain.handle('tags:delete', (_e, id: string) => store.deleteTag(id))

// ── IPC: Settings ─────────────────────────────────────────────

ipcMain.handle('settings:get', () => store.getSettings())
ipcMain.handle('settings:update', (_e, data: any) => store.updateSettings(data))

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

app.whenReady().then(createWindow)
