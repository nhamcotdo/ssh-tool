// ============================================================
// Sidebar Component — with context menu + drag-and-drop
// ============================================================

import { useState } from 'react'
import {
    Plus, Settings, Monitor, Tag, ChevronRight, ChevronDown,
    FolderPlus, FolderOpen, Folder as FolderIcon,
    Trash2, Pencil, FolderInput, Key, LogOut,
} from 'lucide-react'
import type { Workspace, Folder, Tag as TagType, SSHConnection } from '../types'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'

interface SidebarProps {
    workspaces: Workspace[]
    folders: Folder[]
    tags: TagType[]
    connections: SSHConnection[]
    activeWorkspaceId: string
    activeFolderId: string | null
    activeTagId: string | null
    onSelectWorkspace: (id: string) => void
    onSelectFolder: (folderId: string | null) => void
    onSelectTag: (id: string | null) => void
    onCreateWorkspace: () => void
    onCreateFolder: (workspaceId: string, parentId?: string) => void
    onRenameFolder: (id: string) => void
    onDeleteFolder: (id: string) => void
    onMoveFolder: (folderId: string, newParentId: string | null, newWorkspaceId?: string) => void
    onNewConnection: (workspaceId: string, folderId?: string) => void
    onCreateTag: () => void
    onOpenSSHKeys: () => void
    onOpenSettings: () => void
    onLogout: () => void
    currentUsername: string
    activeSessionCount: number
}

interface CtxMenuState {
    x: number
    y: number
    items: ContextMenuItem[]
}

export default function Sidebar({
    workspaces, folders, tags, connections, activeWorkspaceId,
    activeFolderId, activeTagId, onSelectWorkspace, onSelectFolder,
    onSelectTag, onCreateWorkspace, onCreateFolder, onRenameFolder,
    onDeleteFolder, onMoveFolder, onNewConnection, onCreateTag, onOpenSSHKeys, onOpenSettings,
    onLogout, currentUsername, activeSessionCount,
}: SidebarProps) {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set(['default']))
    const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)
    const [dragId, setDragId] = useState<string | null>(null)
    const [dragOverId, setDragOverId] = useState<string | null>(null)

    function getConnectionCount(wsId: string): number {
        if (wsId === 'default') return connections.length
        return connections.filter(c => c.workspaceId === wsId).length
    }

    function getFolderConnectionCount(folderId: string): number {
        let count = connections.filter(c => c.folderId === folderId).length
        folders.filter(f => f.parentId === folderId).forEach(child => {
            count += getFolderConnectionCount(child.id)
        })
        return count
    }

    function getTagCount(tagId: string): number {
        return connections.filter(c => c.tags.includes(tagId)).length
    }

    function toggleFolder(folderId: string) {
        setExpandedFolders(prev => {
            const next = new Set(prev)
            next.has(folderId) ? next.delete(folderId) : next.add(folderId)
            return next
        })
    }

    function toggleWorkspace(wsId: string) {
        setExpandedWorkspaces(prev => {
            const next = new Set(prev)
            next.has(wsId) ? next.delete(wsId) : next.add(wsId)
            return next
        })
    }

    // ── Context Menus ──
    function showWorkspaceContextMenu(e: React.MouseEvent, ws: Workspace) {
        e.preventDefault()
        e.stopPropagation()
        setCtxMenu({
            x: e.clientX, y: e.clientY,
            items: [
                { label: 'New Connection', icon: <Plus size={14} />, onClick: () => onNewConnection(ws.id) },
                { label: 'New Folder', icon: <FolderPlus size={14} />, onClick: () => onCreateFolder(ws.id) },
            ],
        })
    }

    function showFolderContextMenu(e: React.MouseEvent, folder: Folder) {
        e.preventDefault()
        e.stopPropagation()
        setCtxMenu({
            x: e.clientX, y: e.clientY,
            items: [
                { label: 'New Connection', icon: <Plus size={14} />, onClick: () => onNewConnection(folder.workspaceId, folder.id) },
                { label: 'New Subfolder', icon: <FolderPlus size={14} />, onClick: () => onCreateFolder(folder.workspaceId, folder.id) },
                { label: 'Rename', icon: <Pencil size={14} />, onClick: () => onRenameFolder(folder.id) },
                { label: 'Delete Folder', icon: <Trash2 size={14} />, danger: true, onClick: () => onDeleteFolder(folder.id) },
            ],
        })
    }

    // ── Drag & Drop ──
    function handleDragStart(e: React.DragEvent, folderId: string) {
        e.stopPropagation()
        setDragId(folderId)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', folderId)
        // Add a slight delay for the dragging visual
        requestAnimationFrame(() => {
            const el = e.currentTarget as HTMLElement
            el.classList.add('dragging')
        })
    }

    function handleDragEnd(e: React.DragEvent) {
        e.stopPropagation()
        setDragId(null)
        setDragOverId(null)
            ; (e.currentTarget as HTMLElement).classList.remove('dragging')
    }

    function handleDragOver(e: React.DragEvent, targetId: string) {
        e.preventDefault()
        e.stopPropagation()
        if (dragId === targetId) return
        e.dataTransfer.dropEffect = 'move'
        setDragOverId(targetId)
    }

    function handleDragLeave(e: React.DragEvent) {
        e.stopPropagation()
        setDragOverId(null)
    }

    function handleDropOnFolder(e: React.DragEvent, targetFolderId: string) {
        e.preventDefault()
        e.stopPropagation()
        setDragOverId(null)
        const folderId = e.dataTransfer.getData('text/plain')
        if (!folderId || folderId === targetFolderId) return
        // Prevent dropping on own descendant
        if (isDescendant(targetFolderId, folderId)) return
        onMoveFolder(folderId, targetFolderId)
    }

    function handleDropOnWorkspace(e: React.DragEvent, workspaceId: string) {
        e.preventDefault()
        e.stopPropagation()
        setDragOverId(null)
        const folderId = e.dataTransfer.getData('text/plain')
        if (!folderId) return
        // Move to workspace root (no parent)
        onMoveFolder(folderId, null, workspaceId)
    }

    function isDescendant(potentialChild: string, potentialParent: string): boolean {
        // Check if potentialChild is a descendant of potentialParent
        let current = potentialChild
        while (current) {
            const folder = folders.find(f => f.id === current)
            if (!folder?.parentId) return false
            if (folder.parentId === potentialParent) return true
            current = folder.parentId
        }
        return false
    }

    // ── Recursive folder tree ──
    function renderFolderTree(parentId: string | undefined, workspaceId: string, depth: number) {
        const children = folders.filter(f =>
            f.workspaceId === workspaceId &&
            (parentId ? f.parentId === parentId : !f.parentId)
        )
        if (children.length === 0) return null

        return (
            <>
                {children.map(folder => {
                    const isExpanded = expandedFolders.has(folder.id)
                    const isActive = activeFolderId === folder.id
                    const hasChildren = folders.some(f => f.parentId === folder.id)
                    const count = getFolderConnectionCount(folder.id)
                    const isDragOver = dragOverId === folder.id

                    return (
                        <div key={folder.id}>
                            <div
                                className={`sidebar-item titlebar-no-drag ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''} ${dragId === folder.id ? 'dragging' : ''}`}
                                style={{ paddingLeft: 12 + depth * 16 }}
                                onClick={() => {
                                    onSelectWorkspace(workspaceId)
                                    onSelectFolder(folder.id)
                                    onSelectTag(null)
                                }}
                                onContextMenu={(e) => showFolderContextMenu(e, folder)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, folder.id)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => handleDragOver(e, folder.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDropOnFolder(e, folder.id)}
                            >
                                {/* Expand chevron */}
                                <span
                                    style={{ width: 16, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                    onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id) }}
                                >
                                    {hasChildren ? (
                                        isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                                    ) : <span style={{ width: 12 }} />}
                                </span>

                                {isExpanded
                                    ? <FolderOpen size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                                    : <FolderIcon size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
                                }

                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                                    {folder.name}
                                </span>

                                <span className="count" style={{ fontSize: 10 }}>{count}</span>

                                {/* Add subfolder */}
                                <span
                                    className="icon-btn folder-action"
                                    style={{ width: 18, height: 18 }}
                                    onClick={(e) => { e.stopPropagation(); onCreateFolder(workspaceId, folder.id) }}
                                    title="New subfolder"
                                >
                                    <FolderPlus size={11} />
                                </span>
                            </div>

                            {/* Children */}
                            {isExpanded && renderFolderTree(folder.id, workspaceId, depth + 1)}
                        </div>
                    )
                })}
            </>
        )
    }

    return (
        <div className="sidebar">
            {/* Header */}
            <div className="sidebar-header titlebar-drag">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Monitor size={18} style={{ color: 'var(--accent-blue)' }} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        SSH Tool
                    </span>
                </div>
            </div>

            {/* Workspaces + Folders */}
            <div className="sidebar-section" style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="sidebar-label">Workspaces</div>
                    <button
                        className="icon-btn titlebar-no-drag"
                        onClick={onCreateWorkspace}
                        title="New Workspace"
                        style={{ width: 24, height: 24 }}
                    >
                        <Plus size={14} />
                    </button>
                </div>

                {workspaces.map(ws => {
                    const isExpanded = expandedWorkspaces.has(ws.id)
                    const wsFolders = folders.filter(f => f.workspaceId === ws.id && !f.parentId)
                    const hasFolders = wsFolders.length > 0
                    const isDragOverWs = dragOverId === `ws-${ws.id}`

                    return (
                        <div key={ws.id}>
                            <div
                                className={`sidebar-item titlebar-no-drag ${activeWorkspaceId === ws.id && !activeTagId && !activeFolderId ? 'active' : ''} ${isDragOverWs ? 'drag-over' : ''}`}
                                onClick={() => { onSelectWorkspace(ws.id); onSelectFolder(null); onSelectTag(null) }}
                                onContextMenu={(e) => showWorkspaceContextMenu(e, ws)}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(`ws-${ws.id}`) }}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDropOnWorkspace(e, ws.id)}
                            >
                                {/* Expand chevron */}
                                {hasFolders ? (
                                    <span
                                        style={{ width: 16, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                        onClick={(e) => { e.stopPropagation(); toggleWorkspace(ws.id) }}
                                    >
                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </span>
                                ) : (
                                    <span style={{ width: 16 }} />
                                )}

                                <span className="icon">{ws.icon}</span>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ws.name}
                                </span>
                                <span className="count">{getConnectionCount(ws.id)}</span>

                                {/* Add folder (hover) */}
                                <span
                                    className="icon-btn folder-action"
                                    style={{ width: 20, height: 20 }}
                                    onClick={(e) => { e.stopPropagation(); onCreateFolder(ws.id) }}
                                    title="New folder"
                                >
                                    <FolderPlus size={12} />
                                </span>
                            </div>

                            {/* Nested folder tree */}
                            {isExpanded && renderFolderTree(undefined, ws.id, 1)}
                        </div>
                    )
                })}

                {/* Tags */}
                <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="sidebar-label">Tags</div>
                        <button
                            className="icon-btn titlebar-no-drag"
                            onClick={onCreateTag}
                            title="New Tag"
                            style={{ width: 24, height: 24 }}
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {tags.length === 0 && (
                        <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                            No tags yet
                        </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 8px' }}>
                        {tags.map(tag => (
                            <span
                                key={tag.id}
                                className="tag-badge titlebar-no-drag"
                                style={{
                                    background: `${tag.color}20`,
                                    color: tag.color,
                                    border: activeTagId === tag.id ? `1px solid ${tag.color}` : '1px solid transparent',
                                }}
                                onClick={() => onSelectTag(activeTagId === tag.id ? null : tag.id)}
                            >
                                <Tag size={10} />
                                {tag.name}
                                <span style={{ fontSize: 10, opacity: 0.7 }}>
                                    {getTagCount(tag.id)}
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                {activeSessionCount > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                        fontSize: 12, color: 'var(--accent-green)',
                    }}>
                        <span className="status-dot online" />
                        {activeSessionCount} active session{activeSessionCount > 1 ? 's' : ''}
                    </div>
                )}
                <div
                    className="sidebar-item titlebar-no-drag"
                    onClick={onOpenSSHKeys}
                >
                    <Key size={16} />
                    <span>SSH Keys</span>
                </div>
                <div
                    className="sidebar-item titlebar-no-drag"
                    onClick={onOpenSettings}
                >
                    <Settings size={16} />
                    <span>Settings</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '6px 0', padding: '6px 12px 0' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: 12, color: 'var(--text-muted)',
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: 'rgba(59, 130, 246, 0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, color: 'var(--accent-blue)', fontWeight: 700,
                            }}>
                                {currentUsername[0]?.toUpperCase()}
                            </div>
                            <span>{currentUsername}</span>
                        </span>
                        <button
                            className="icon-btn titlebar-no-drag"
                            onClick={onLogout}
                            title="Sign Out"
                            style={{ width: 24, height: 24 }}
                        >
                            <LogOut size={13} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Context Menu */}
            {ctxMenu && (
                <ContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    items={ctxMenu.items}
                    onClose={() => setCtxMenu(null)}
                />
            )}
        </div>
    )
}
