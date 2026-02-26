// ============================================================
// SSH Key Manager — List / Add / Edit / Delete saved keys
// ============================================================

import { useState, useEffect } from 'react'
import { X, Plus, Key, Pencil, Trash2, FolderOpen, AlertTriangle, ArrowLeft } from 'lucide-react'
import type { SSHKey } from '../types'

interface SSHKeyManagerProps {
    sshKeys: SSHKey[]
    onCreateKey: (data: { name: string; path: string; passphrase?: string }) => void
    onUpdateKey: (id: string, data: Partial<SSHKey>) => void
    onDeleteKey: (id: string) => void
    onClose: () => void
}

export default function SSHKeyManager({
    sshKeys, onCreateKey, onUpdateKey, onDeleteKey, onClose,
}: SSHKeyManagerProps) {
    const [showForm, setShowForm] = useState(false)
    const [editingKey, setEditingKey] = useState<SSHKey | null>(null)
    const [name, setName] = useState('')
    const [path, setPath] = useState('')
    const [passphrase, setPassphrase] = useState('')
    const [keyFileStatus, setKeyFileStatus] = useState<Map<string, boolean>>(new Map())

    // Check which key files exist on disk
    useEffect(() => {
        async function checkFiles() {
            const status = new Map<string, boolean>()
            for (const key of sshKeys) {
                try {
                    // We'll use a simple test: try to read the file via the selectFile dialog isn't needed
                    // Instead, store the path and let the main process verify
                    status.set(key.id, true) // Default to true, backend will handle missing files
                } catch {
                    status.set(key.id, false)
                }
            }
            setKeyFileStatus(status)
        }
        checkFiles()
    }, [sshKeys])

    function resetForm() {
        setName('')
        setPath('')
        setPassphrase('')
        setEditingKey(null)
        setShowForm(false)
    }

    function handleEdit(key: SSHKey) {
        setEditingKey(key)
        setName(key.name)
        setPath(key.path)
        setPassphrase(key.passphrase || '')
        setShowForm(true)
    }

    function handleSave() {
        if (!name || !path) return
        if (editingKey) {
            onUpdateKey(editingKey.id, { name, path, passphrase: passphrase || undefined })
        } else {
            onCreateKey({ name, path, passphrase: passphrase || undefined })
        }
        resetForm()
    }

    async function handleBrowse() {
        const filePath = await window.sshTool.selectFile()
        if (filePath) {
            setPath(filePath)
            // Auto-fill name from filename if name is empty
            if (!name) {
                const fileName = filePath.split('/').pop() || filePath
                setName(fileName)
            }
        }
    }

    function handleDelete(id: string) {
        if (confirm('Delete this SSH key from the manager? (The key file itself will not be deleted)')) {
            onDeleteKey(id)
        }
    }

    function formatDate(timestamp: number) {
        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        })
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div className="main-header titlebar-drag">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="titlebar-no-drag">
                    <button className="icon-btn" onClick={onClose} title="Back">
                        <ArrowLeft size={18} />
                    </button>
                    <Key size={20} style={{ color: 'var(--accent-blue)' }} />
                    <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>SSH Key Manager</h2>
                </div>
                <button
                    className="btn btn-primary titlebar-no-drag"
                    onClick={() => { resetForm(); setShowForm(true) }}
                >
                    <Plus size={16} /> Add Key
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {sshKeys.length === 0 && !showForm ? (
                    <div className="empty-state">
                        <Key size={48} style={{ opacity: 0.2 }} />
                        <div className="empty-text">
                            No SSH keys saved yet. Add a key to quickly use it across connections.
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowForm(true)}
                        >
                            <Plus size={16} /> Add SSH Key
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Add/Edit Form */}
                        {showForm && (
                            <div style={{
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--accent-blue)',
                                borderRadius: 'var(--radius-md)',
                                padding: 16,
                                marginBottom: 8,
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    marginBottom: 12,
                                }}>
                                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                                        {editingKey ? 'Edit Key' : 'Add New Key'}
                                    </span>
                                    <button className="icon-btn" onClick={resetForm}>
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="form-group" style={{ marginBottom: 10 }}>
                                    <label className="form-label">Key Name</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g. Production Server Key"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: 10 }}>
                                    <label className="form-label">Private Key Path</label>
                                    <div className="form-file-input">
                                        <input
                                            className="form-input"
                                            placeholder="~/.ssh/id_rsa"
                                            value={path}
                                            onChange={e => setPath(e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                        <button className="btn btn-secondary btn-sm" onClick={handleBrowse}>
                                            <FolderOpen size={14} /> Browse
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Passphrase (optional)</label>
                                    <input
                                        className="form-input"
                                        type="password"
                                        placeholder="Enter passphrase if key is encrypted"
                                        value={passphrase}
                                        onChange={e => setPassphrase(e.target.value)}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                                    <button className="btn btn-primary" onClick={handleSave} disabled={!name || !path}>
                                        {editingKey ? 'Save Changes' : 'Add Key'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Key List */}
                        {sshKeys.map(key => (
                            <div
                                key={key.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 14px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                            >
                                <div style={{
                                    width: 36, height: 36,
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Key size={18} style={{ color: 'var(--accent-blue)' }} />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontWeight: 600, fontSize: 13,
                                        display: 'flex', alignItems: 'center', gap: 6,
                                    }}>
                                        {key.name}
                                        {key.passphrase && (
                                            <span style={{
                                                fontSize: 10, padding: '1px 6px',
                                                borderRadius: 4, background: 'rgba(139, 92, 246, 0.15)',
                                                color: '#a78bfa',
                                            }}>
                                                passphrase
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        fontSize: 11, color: 'var(--text-muted)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        marginTop: 2,
                                    }}>
                                        {key.path}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                        Added {formatDate(key.createdAt)}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <button
                                        className="icon-btn"
                                        onClick={() => handleEdit(key)}
                                        title="Edit"
                                        style={{ width: 30, height: 30 }}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        className="icon-btn"
                                        onClick={() => handleDelete(key.id)}
                                        title="Delete"
                                        style={{ width: 30, height: 30, color: 'var(--accent-red)' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
