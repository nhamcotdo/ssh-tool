// ============================================================
// App — Root Component
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, ServerCrash } from 'lucide-react'
// @ts-ignore - TS has trouble resolving the exports in this environment
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import type { SSHConnection, SSHKey, UserAccount, Workspace, Folder, Tag, AppSettings, TerminalTab } from './types'
import Sidebar from './components/Sidebar'
import ConnectionCard from './components/ConnectionCard'
import ConnectionForm from './components/ConnectionForm'
import TerminalPanel from './components/TerminalPanel'
import { WorkspaceModal, TagModal, SettingsPanel } from './components/Modals'
import InputDialog from './components/InputDialog'
import SSHKeyManager from './components/SSHKeyManager'
import AuthScreen from './components/AuthScreen'

type View = 'connections' | 'settings' | 'ssh-keys'

export default function App() {
  // ── Auth state ──
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  // ── Data state ──
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [sshKeys, setSSHKeys] = useState<SSHKey[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    terminalFontSize: 14,
    terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
    defaultPort: 22,
    defaultUsername: 'root',
  })

  // ── UI state ──
  const [view, setView] = useState<View>('connections')
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Modals ──
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null)
  const [newConnectionDefaults, setNewConnectionDefaults] = useState<{ workspaceId?: string; folderId?: string }>({})
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [inputDialog, setInputDialog] = useState<{
    title: string; placeholder?: string; defaultValue?: string;
    onSubmit: (value: string) => void;
  } | null>(null)

  // ── Terminal tabs (multi-tab SSH) ──
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([])
  const [activeTerminalTab, setActiveTerminalTab] = useState<string | null>(null)

  // ── Load data ──
  const loadData = useCallback(async () => {
    const [conns, wss, flds, tgs, keys, sett] = await Promise.all([
      window.sshTool.listConnections(),
      window.sshTool.listWorkspaces(),
      window.sshTool.listFolders(),
      window.sshTool.listTags(),
      window.sshTool.listSSHKeys(),
      window.sshTool.getSettings(),
    ])
    setConnections(conns)
    setWorkspaces(wss)
    setFolders(flds)
    setTags(tgs)
    setSSHKeys(keys)
    setSettings(sett)
  }, [])

  useEffect(() => {
    window.sshTool.getCurrentUser().then((user: UserAccount | null) => {
      setCurrentUser(user)
      setAuthChecked(true)
    })

    if (window.sshTool.onLockScreen) {
      const cleanup = window.sshTool.onLockScreen(() => {
        setIsLocked(true)
      })
      return () => { cleanup() }
    }
  }, [])

  useEffect(() => {
    if (currentUser) loadData()
  }, [currentUser, loadData])

  // ── Connection Status & Shortcuts ──
  useEffect(() => {
    if (!authChecked) return

    const removeCloseListener = window.sshTool.onSshClosed((connId) => {
      setTerminalTabs(prev => prev.map(t =>
        t.connectionId === connId && t.connected
          ? { ...t, connected: false }
          : t
      ))
    })

    return () => { removeCloseListener(); }
  }, [authChecked])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+W (macOS) or Ctrl+W (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        if (activeTerminalTab) {
          e.preventDefault()
          handleCloseTab(activeTerminalTab)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTerminalTab, terminalTabs])

  // ── Connection CRUD ──
  async function handleCreateConnection(data: any) {
    // Auto-assign folderId if a folder is active
    if (activeFolderId && !data.folderId) {
      data.folderId = activeFolderId
    }
    await window.sshTool.createConnection(data)
    setShowConnectionForm(false)
    loadData()
  }

  async function handleUpdateConnection(data: any) {
    if (!editingConnection) return
    await window.sshTool.updateConnection(editingConnection.id, data)
    setShowConnectionForm(false)
    setEditingConnection(null)
    loadData()
  }

  async function handleDeleteConnection(id: string) {
    if (!confirm('Delete this connection?')) return
    await window.sshTool.deleteConnection(id)
    loadData()
  }

  async function handleDuplicateConnection(id: string) {
    await window.sshTool.duplicateConnection(id)
    loadData()
  }

  // ── New Connection from Sidebar context menu ──
  function handleNewConnection(workspaceId: string, folderId?: string) {
    setEditingConnection(null)
    setNewConnectionDefaults({ workspaceId, folderId })
    setShowConnectionForm(true)
  }

  async function handleTestConnection(data: any) {
    return await window.sshTool.sshTest(data)
  }

  // ── SSH Connect (multi-tab) ──
  async function handleConnect(connectionId: string) {
    const conn = connections.find(c => c.id === connectionId)
    if (!conn) return

    // Create tab immediately with 'connecting' status
    const tempId = `connecting-${connectionId}-${Date.now()}`
    const pendingTab: TerminalTab = {
      id: tempId,
      connectionId,
      sessionId: '',
      name: conn.name,
      connected: false,
      connecting: true,
    }
    setTerminalTabs(prev => [...prev, pendingTab])
    setActiveTerminalTab(tempId)

    const result = await window.sshTool.sshConnect(connectionId)

    if (result.success) {
      // Replace pending tab with real connected tab
      setTerminalTabs(prev => prev.map(t =>
        t.id === tempId
          ? { ...t, id: result.sessionId, sessionId: result.sessionId, connected: true, connecting: false }
          : t
      ))
      setActiveTerminalTab(result.sessionId)
      loadData()
    } else {
      // Remove the pending tab on failure
      setTerminalTabs(prev => prev.filter(t => t.id !== tempId))
      setActiveTerminalTab(prev => {
        if (prev === tempId) {
          const remaining = terminalTabs.filter(t => t.id !== tempId)
          return remaining.length > 0 ? remaining[remaining.length - 1].id : null
        }
        return prev
      })
      alert(`Connection failed: ${result.message}`)
    }
  }

  function handleCloseTab(tabId: string) {
    const tab = terminalTabs.find(t => t.id === tabId)
    if (tab) {
      window.sshTool.sshDisconnect(tab.sessionId)
    }
    setTerminalTabs(prev => prev.filter(t => t.id !== tabId))
    setActiveTerminalTab(prev => {
      if (prev === tabId) {
        const remaining = terminalTabs.filter(t => t.id !== tabId)
        return remaining.length > 0 ? remaining[remaining.length - 1].id : null
      }
      return prev
    })
  }

  async function handleReconnect(tabId: string) {
    const tab = terminalTabs.find(t => t.id === tabId)
    if (!tab) return
    
    setTerminalTabs(prev => prev.map(t => t.id === tabId ? { ...t, connecting: true } : t))
    
    const result = await window.sshTool.sshConnect(tab.connectionId)
    if (result.success) {
      setTerminalTabs(prev => prev.map(t =>
        t.id === tabId
          ? { ...t, id: result.sessionId, sessionId: result.sessionId, connected: true, connecting: false }
          : t
      ))
      if (activeTerminalTab === tabId) {
        setActiveTerminalTab(result.sessionId)
      }
      loadData()
    } else {
      setTerminalTabs(prev => prev.map(t => t.id === tabId ? { ...t, connecting: false } : t))
      alert(`Reconnect failed: ${result.message}`)
    }
  }

  function handleReorderTabs(newTabs: TerminalTab[]) {
    setTerminalTabs(newTabs)
  }

  // ── Workspace CRUD ──
  async function handleCreateWorkspace(data: { name: string; icon: string; color: string }) {
    await window.sshTool.createWorkspace(data)
    setShowWorkspaceModal(false)
    loadData()
  }

  async function handleDeleteWorkspace(id: string) {
    await window.sshTool.deleteWorkspace(id)
    setShowWorkspaceModal(false)
    setActiveWorkspaceId('default')
    loadData()
  }

  // ── Folder CRUD ──
  function handleCreateFolder(workspaceId: string, parentId?: string) {
    setInputDialog({
      title: 'New Folder',
      placeholder: 'Folder name',
      onSubmit: async (name) => {
        setInputDialog(null)
        await window.sshTool.createFolder({ name, workspaceId, icon: '📁', parentId })
        loadData()
      },
    })
  }

  async function handleDeleteFolder(id: string) {
    await window.sshTool.deleteFolder(id)
    if (activeFolderId === id) setActiveFolderId(null)
    loadData()
  }

  function handleRenameFolder(id: string) {
    const folder = folders.find(f => f.id === id)
    if (!folder) return
    setInputDialog({
      title: 'Rename Folder',
      placeholder: 'Folder name',
      defaultValue: folder.name,
      onSubmit: async (newName) => {
        setInputDialog(null)
        await window.sshTool.updateFolder(id, { name: newName })
        loadData()
      },
    })
  }

  async function handleMoveFolder(folderId: string, newParentId: string | null, newWorkspaceId?: string) {
    const update: any = { parentId: newParentId || undefined }
    if (newWorkspaceId) {
      update.workspaceId = newWorkspaceId
      update.parentId = undefined // moving to workspace root
    }
    await window.sshTool.updateFolder(folderId, update)
    loadData()
  }

  // ── Tag CRUD ──
  async function handleCreateTag(data: { name: string; color: string }) {
    await window.sshTool.createTag(data)
    setShowTagModal(false)
    loadData()
  }

  async function handleDeleteTag(id: string) {
    await window.sshTool.deleteTag(id)
    setShowTagModal(false)
    setActiveTagId(null)
    loadData()
  }

  // ── Settings ──
  async function handleUpdateSettings(data: Partial<AppSettings>) {
    const updated = await window.sshTool.updateSettings(data)
    setSettings(updated)
  }

  // ── SSH Key CRUD ──
  async function handleCreateSSHKey(data: { name: string; path: string; passphrase?: string }) {
    await window.sshTool.createSSHKey(data)
    loadData()
  }

  async function handleUpdateSSHKey(id: string, data: any) {
    await window.sshTool.updateSSHKey(id, data)
    loadData()
  }

  async function handleDeleteSSHKey(id: string) {
    await window.sshTool.deleteSSHKey(id)
    loadData()
  }

  // ── Auth ──
  async function handleLogout() {
    await window.sshTool.logout()
    terminalTabs.forEach(t => {
      window.sshTool.sshDisconnect(t.sessionId)
    })
    setCurrentUser(null)
    setConnections([])
    setWorkspaces([])
    setFolders([])
    setTags([])
    setSSHKeys([])
    setTerminalTabs([])
    setView('connections')
  }

  // ── Auth logic ──
  function handleAuthSuccess(user: UserAccount) {
    if (currentUser && currentUser.id === user.id) {
      // Unlocked by same user - resume state perfectly perfectly perfectly perfectly perfectly
      setIsLocked(false)
    } else {
      // New user logged in - wipe older state
      terminalTabs.forEach(t => {
        window.sshTool.sshDisconnect(t.sessionId)
      })
      setCurrentUser(user)
      setIsLocked(false)
      setConnections([])
      setWorkspaces([])
      setFolders([])
      setTags([])
      setSSHKeys([])
      setTerminalTabs([])
      setView('connections')
    }
  }

  // ── Auth gate ──
  if (!authChecked) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="titlebar-drag" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 40 }} />
        <span className="spin" style={{ fontSize: 24 }}>⏳</span>
      </div>
    )
  }

  if (!currentUser) {
    return <AuthScreen onAuth={handleAuthSuccess} />
  }

  // Helper: collect a folder and all its descendant IDs
  function getDescendantFolderIds(folderId: string): string[] {
    const ids = [folderId]
    folders.filter(f => f.parentId === folderId).forEach(child => {
      ids.push(...getDescendantFolderIds(child.id))
    })
    return ids
  }

  const filteredConnections = connections.filter(c => {
    // Workspace filter
    if (activeWorkspaceId !== 'default' && c.workspaceId !== activeWorkspaceId) return false
    // Folder filter (include subfolders)
    if (activeFolderId) {
      const validFolderIds = getDescendantFolderIds(activeFolderId)
      if (!c.folderId || !validFolderIds.includes(c.folderId)) return false
    }
    // Tag filter
    if (activeTagId && !c.tags.includes(activeTagId)) return false
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        c.host.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {isLocked && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
          <AuthScreen onAuth={handleAuthSuccess} />
        </div>
      )}

      <PanelGroup orientation="horizontal">
        <Panel defaultSize={20} minSize={15} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Sidebar */}
          <Sidebar
            workspaces={workspaces}
            folders={folders}
            tags={tags}
            connections={connections}
            activeWorkspaceId={activeWorkspaceId}
            activeFolderId={activeFolderId}
            activeTagId={activeTagId}
            onSelectWorkspace={(id) => { setActiveWorkspaceId(id); setActiveFolderId(null); setView('connections') }}
            onSelectFolder={setActiveFolderId}
            onSelectTag={setActiveTagId}
            onCreateWorkspace={() => setShowWorkspaceModal(true)}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onMoveFolder={handleMoveFolder}
            onNewConnection={handleNewConnection}
            onCreateTag={() => setShowTagModal(true)}
            onOpenSSHKeys={() => setView('ssh-keys')}
            onOpenSettings={() => setView('settings')}
            onLogout={handleLogout}
            currentUsername={currentUser.username}
            activeSessionCount={terminalTabs.filter(t => t.connected).length}
          />
        </Panel>
        <PanelResizeHandle className="resize-handle resize-handle-horizontal" />
        <Panel defaultSize={80} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>

      {/* Main Area */}
      <div className="main-content">
        {view === 'settings' ? (
          <SettingsPanel
            settings={settings}
            onUpdate={handleUpdateSettings}
            onClose={() => setView('connections')}
          />
        ) : view === 'ssh-keys' ? (
          <SSHKeyManager
            sshKeys={sshKeys}
            onCreateKey={handleCreateSSHKey}
            onUpdateKey={handleUpdateSSHKey}
            onDeleteKey={handleDeleteSSHKey}
            onClose={() => setView('connections')}
          />
        ) : (
          <>
            {/* Header */}
            <div className="main-header titlebar-drag">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }} className="titlebar-no-drag">
                <div style={{ position: 'relative' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute', left: 10, top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    className="search-input"
                    placeholder="Search connections..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="btn btn-primary titlebar-no-drag"
                onClick={() => { setEditingConnection(null); setNewConnectionDefaults({}); setShowConnectionForm(true) }}
              >
                <Plus size={16} /> New Connection
              </button>
            </div>

            {/* Connection grid + Terminal split */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {terminalTabs.length > 0 ? (
                <PanelGroup orientation="vertical">
                  <Panel defaultSize={40} minSize={20} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {filteredConnections.length > 0 ? (
                        <div className="connections-grid">
                          {filteredConnections.map(c => (
                            <ConnectionCard
                              key={c.id}
                              connection={c}
                              tags={tags}
                              onConnect={handleConnect}
                              onEdit={(conn) => { setEditingConnection(conn); setShowConnectionForm(true) }}
                              onDuplicate={handleDuplicateConnection}
                              onDelete={handleDeleteConnection}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <ServerCrash size={48} style={{ opacity: 0.2 }} />
                          <div className="empty-text">
                            {connections.length === 0
                              ? 'No connections yet. Click "New Connection" to get started.'
                              : 'No connections match your filters.'
                            }
                          </div>
                          {connections.length === 0 && (
                            <button
                              className="btn btn-primary"
                              onClick={() => { setEditingConnection(null); setNewConnectionDefaults({}); setShowConnectionForm(true) }}
                            >
                              <Plus size={16} /> New Connection
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </Panel>
                  
                  <PanelResizeHandle className="resize-handle resize-handle-vertical" />
                  
                  <Panel defaultSize={60} minSize={20} style={{ display: 'flex', flexDirection: 'column' }}>
                    <TerminalPanel
                      tabs={terminalTabs}
                      activeTabId={activeTerminalTab}
                      onSelectTab={setActiveTerminalTab}
                      onCloseTab={handleCloseTab}
                      onReconnect={handleReconnect}
                      onReorderTabs={handleReorderTabs}
                      settings={settings}
                    />
                  </Panel>
                </PanelGroup>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {filteredConnections.length > 0 ? (
                    <div className="connections-grid">
                      {filteredConnections.map(c => (
                        <ConnectionCard
                          key={c.id}
                          connection={c}
                          tags={tags}
                          onConnect={handleConnect}
                          onEdit={(conn) => { setEditingConnection(conn); setShowConnectionForm(true) }}
                          onDuplicate={handleDuplicateConnection}
                          onDelete={handleDeleteConnection}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <ServerCrash size={48} style={{ opacity: 0.2 }} />
                      <div className="empty-text">
                        {connections.length === 0
                          ? 'No connections yet. Click "New Connection" to get started.'
                          : 'No connections match your filters.'
                        }
                      </div>
                      {connections.length === 0 && (
                        <button
                          className="btn btn-primary"
                          onClick={() => { setEditingConnection(null); setNewConnectionDefaults({}); setShowConnectionForm(true) }}
                        >
                          <Plus size={16} /> New Connection
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      </Panel>
      </PanelGroup>

      {/* ── Modals ── */}
      {showConnectionForm && (
        <ConnectionForm
          connection={editingConnection}
          connections={connections}
          workspaces={workspaces}
          folders={folders}
          tags={tags}
          sshKeys={sshKeys}
          initialWorkspaceId={newConnectionDefaults.workspaceId}
          initialFolderId={newConnectionDefaults.folderId}
          onSave={editingConnection ? handleUpdateConnection : handleCreateConnection}
          onCancel={() => { setShowConnectionForm(false); setEditingConnection(null); setNewConnectionDefaults({}) }}
          onTest={handleTestConnection}
        />
      )}

      {showWorkspaceModal && (
        <WorkspaceModal
          onSave={handleCreateWorkspace}
          onDelete={handleDeleteWorkspace}
          onCancel={() => setShowWorkspaceModal(false)}
        />
      )}

      {showTagModal && (
        <TagModal
          onSave={handleCreateTag}
          onDelete={handleDeleteTag}
          onCancel={() => setShowTagModal(false)}
        />
      )}

      {inputDialog && (
        <InputDialog
          title={inputDialog.title}
          placeholder={inputDialog.placeholder}
          defaultValue={inputDialog.defaultValue}
          onSubmit={inputDialog.onSubmit}
          onCancel={() => setInputDialog(null)}
        />
      )}
    </div>
  )
}
