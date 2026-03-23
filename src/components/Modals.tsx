// ============================================================
// Quick Modals: Workspace, Tag, Settings
// ============================================================

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Workspace, Tag, AppSettings } from '../types'
import { WORKSPACE_ICONS, TAG_COLORS } from '../lib/utils'
import DataManagementModal from './DataManagementModal'

// ── Workspace Modal ─────────────────────────────────────────

interface WorkspaceModalProps {
    workspace?: Workspace | null
    onSave: (data: { name: string; icon: string; color: string }) => void
    onDelete?: (id: string) => void
    onCancel: () => void
}

export function WorkspaceModal({ workspace, onSave, onDelete, onCancel }: WorkspaceModalProps) {
    const [name, setName] = useState(workspace?.name || '')
    const [icon, setIcon] = useState(workspace?.icon || '📁')
    const [color, setColor] = useState(workspace?.color || '#3b82f6')

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                <div className="modal-header">
                    <h2>{workspace ? 'Edit Workspace' : 'New Workspace'}</h2>
                    <button className="icon-btn" onClick={onCancel}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Name</label>
                        <input
                            className="form-input"
                            placeholder="e.g. Production"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Icon</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {WORKSPACE_ICONS.map(i => (
                                <button
                                    key={i}
                                    onClick={() => setIcon(i)}
                                    style={{
                                        width: 36, height: 36, fontSize: 18,
                                        border: icon === i ? '2px solid var(--accent-blue)' : '2px solid transparent',
                                        borderRadius: 'var(--radius-sm)',
                                        background: icon === i ? 'var(--bg-active)' : 'transparent',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Color</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {TAG_COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: 24, height: 24, borderRadius: '50%',
                                        background: c, border: color === c ? '3px solid white' : '3px solid transparent',
                                        cursor: 'pointer',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    {workspace && workspace.id !== 'default' && onDelete && (
                        <button className="btn btn-danger btn-sm" onClick={() => onDelete(workspace.id)}>
                            Delete
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => name && onSave({ name, icon, color })}>
                        {workspace ? 'Save' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Tag Modal ───────────────────────────────────────────────

interface TagModalProps {
    tag?: Tag | null
    onSave: (data: { name: string; color: string }) => void
    onDelete?: (id: string) => void
    onCancel: () => void
}

export function TagModal({ tag, onSave, onDelete, onCancel }: TagModalProps) {
    const [name, setName] = useState(tag?.name || '')
    const [color, setColor] = useState(tag?.color || TAG_COLORS[0])

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                <div className="modal-header">
                    <h2>{tag ? 'Edit Tag' : 'New Tag'}</h2>
                    <button className="icon-btn" onClick={onCancel}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Tag Name</label>
                        <input
                            className="form-input"
                            placeholder="e.g. aws, docker, staging"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Color</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {TAG_COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: c, border: color === c ? '3px solid white' : '3px solid transparent',
                                        cursor: 'pointer',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <span className="tag-badge" style={{ background: `${color}20`, color, fontSize: 13 }}>
                            {name || 'preview'}
                        </span>
                    </div>
                </div>
                <div className="modal-footer">
                    {tag && onDelete && (
                        <button className="btn btn-danger btn-sm" onClick={() => onDelete(tag.id)}>Delete</button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => name && onSave({ name, color })}>
                        {tag ? 'Save' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Settings Panel ──────────────────────────────────────────

interface SettingsProps {
    settings: AppSettings
    onUpdate: (data: Partial<AppSettings>) => void
    onClose: () => void
}

export function SettingsPanel({ settings, onUpdate, onClose }: SettingsProps) {
    const [showDataModal, setShowDataModal] = useState(false)

    return (
        <div className="settings-panel">
            {showDataModal && (
                <DataManagementModal 
                    onClose={() => setShowDataModal(false)}
                    onExport={window.sshTool.exportData}
                    onImport={window.sshTool.importData}
                />
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <h2 style={{ margin: 0 }}>Settings</h2>
                <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            </div>

            <div className="settings-section">
                <h3>Terminal</h3>
                <div className="form-group">
                    <label className="form-label">Font Size</label>
                    <input
                        className="form-input"
                        type="number"
                        min={10}
                        max={24}
                        value={settings.terminalFontSize}
                        onChange={e => onUpdate({ terminalFontSize: Number(e.target.value) })}
                        style={{ width: 100 }}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Font Family</label>
                    <input
                        className="form-input"
                        value={settings.terminalFontFamily}
                        onChange={e => onUpdate({ terminalFontFamily: e.target.value })}
                    />
                </div>
            </div>

            <div className="settings-section">
                <h3>Defaults</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Default Port</label>
                        <input
                            className="form-input"
                            type="number"
                            value={settings.defaultPort}
                            onChange={e => onUpdate({ defaultPort: Number(e.target.value) })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Default Username</label>
                        <input
                            className="form-input"
                            value={settings.defaultUsername}
                            onChange={e => onUpdate({ defaultUsername: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3>Data Management</h3>
                <div className="form-group">
                    <button className="btn btn-secondary" onClick={() => setShowDataModal(true)}>
                        Import / Export Data
                    </button>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                        Backup or restore your connections, folders, and settings securely.
                    </p>
                </div>
            </div>
        </div>
    )
}
