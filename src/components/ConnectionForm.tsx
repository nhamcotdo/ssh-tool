// ============================================================
// Connection Form — Create / Edit
// ============================================================

import { useState, useEffect } from 'react'
import { X, FolderOpen, Zap } from 'lucide-react'
import type { SSHConnection, SSHKey, Workspace, Folder, Tag, ProxyJumpConfig } from '../types'
import { TAG_COLORS } from '../lib/utils'

interface ConnectionFormProps {
    connection?: SSHConnection | null
    connections: SSHConnection[]
    workspaces: Workspace[]
    folders: Folder[]
    tags: Tag[]
    sshKeys?: SSHKey[]
    initialWorkspaceId?: string
    initialFolderId?: string
    onSave: (data: any) => void
    onCancel: () => void
    onTest: (data: any) => void
}

const defaultProxy: ProxyJumpConfig = {
    enabled: false,
    host: '',
    port: 22,
    username: 'root',
    authType: 'password',
    password: '',
    privateKeyPath: '',
}

export default function ConnectionForm({
    connection, connections, workspaces, folders, tags, sshKeys,
    initialWorkspaceId, initialFolderId,
    onSave, onCancel, onTest,
}: ConnectionFormProps) {
    const [proxySource, setProxySource] = useState<'manual' | string>('manual') // 'manual' or connectionId
    const [keySource, setKeySource] = useState<'manual' | string>('manual') // 'manual' or sshKeyId
    const [name, setName] = useState('')
    const [host, setHost] = useState('')
    const [port, setPort] = useState(22)
    const [username, setUsername] = useState('root')
    const [authType, setAuthType] = useState<'password' | 'key' | 'key+passphrase'>('password')
    const [password, setPassword] = useState('')
    const [privateKeyPath, setPrivateKeyPath] = useState('')
    const [passphrase, setPassphrase] = useState('')
    const [proxyJump, setProxyJump] = useState<ProxyJumpConfig>(defaultProxy)
    const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId || 'default')
    const [folderId, setFolderId] = useState<string | undefined>(initialFolderId)
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [notes, setNotes] = useState('')
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

    useEffect(() => {
        if (connection) {
            setName(connection.name)
            setHost(connection.host)
            setPort(connection.port)
            setUsername(connection.username)
            setAuthType(connection.authType)
            setPassword(connection.password || '')
            setPrivateKeyPath(connection.privateKeyPath || '')
            setPassphrase(connection.passphrase || '')
            setProxyJump(connection.proxyJump || defaultProxy)
            setWorkspaceId(connection.workspaceId)
            setFolderId(connection.folderId)
            setSelectedTags(connection.tags)
            setNotes(connection.notes || '')
        }
    }, [connection])

    async function handleSelectKey(target: 'main' | 'proxy') {
        const filePath = await window.sshTool.selectFile()
        if (filePath) {
            if (target === 'main') setPrivateKeyPath(filePath)
            else setProxyJump(p => ({ ...p, privateKeyPath: filePath }))
        }
    }

    function buildConnectionData() {
        return {
            name: name || `${host}:${port}`,
            host, port, username, authType,
            password: authType === 'password' ? password : undefined,
            privateKeyPath: authType !== 'password' ? privateKeyPath : undefined,
            passphrase: authType === 'key+passphrase' ? passphrase : undefined,
            proxyJump: proxyJump.enabled ? proxyJump : { ...defaultProxy, enabled: false },
            workspaceId, folderId, tags: selectedTags, notes,
        }
    }

    function handleSave() {
        if (!host) return
        onSave(buildConnectionData())
    }

    async function handleTest() {
        if (!host) return
        setTesting(true)
        setTestResult(null)
        const data = buildConnectionData()
        const result = await onTest(data)
        setTestResult(result as any)
        setTesting(false)
    }

    function toggleTag(tagId: string) {
        setSelectedTags(prev =>
            prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
        )
    }

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
                <div className="modal-header">
                    <h2>{connection ? 'Edit Connection' : 'New Connection'}</h2>
                    <button className="icon-btn" onClick={onCancel}><X size={18} /></button>
                </div>

                <div className="modal-body">
                    {/* Name */}
                    <div className="form-group">
                        <label className="form-label">Connection Name</label>
                        <input
                            className="form-input"
                            placeholder="e.g. Production Server"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* Host + Port */}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Host</label>
                            <input
                                className="form-input"
                                placeholder="192.168.1.100 or hostname"
                                value={host}
                                onChange={e => setHost(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Port</label>
                            <input
                                className="form-input"
                                type="number"
                                value={port}
                                onChange={e => setPort(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    {/* Username */}
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            className="form-input"
                            placeholder="root"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>

                    {/* Auth Type */}
                    <div className="form-group">
                        <label className="form-label">Authentication</label>
                        <select
                            className="form-select"
                            value={authType}
                            onChange={e => setAuthType(e.target.value as any)}
                        >
                            <option value="password">Password</option>
                            <option value="key">SSH Key</option>
                            <option value="key+passphrase">SSH Key + Passphrase</option>
                        </select>
                    </div>

                    {/* Password */}
                    {authType === 'password' && (
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                    )}

                    {/* SSH Key */}
                    {(authType === 'key' || authType === 'key+passphrase') && (
                        <>
                            {/* Key Source Selector */}
                            {sshKeys && sshKeys.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">Key Source</label>
                                    <select
                                        className="form-select"
                                        value={keySource}
                                        onChange={e => {
                                            const val = e.target.value
                                            setKeySource(val)
                                            if (val !== 'manual') {
                                                const key = sshKeys.find(k => k.id === val)
                                                if (key) {
                                                    setPrivateKeyPath(key.path)
                                                    if (key.passphrase) setPassphrase(key.passphrase)
                                                }
                                            }
                                        }}
                                    >
                                        <option value="manual">✏️ Enter path manually</option>
                                        {sshKeys.map(k => (
                                            <option key={k.id} value={k.id}>
                                                🔑 {k.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {keySource !== 'manual' && (
                                <div style={{
                                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                                    fontSize: 12, background: 'rgba(59, 130, 246, 0.1)',
                                    color: 'var(--accent-blue)', marginBottom: 12,
                                }}>
                                    Using saved key <strong>{sshKeys?.find(k => k.id === keySource)?.name}</strong>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Private Key Path</label>
                                <div className="form-file-input">
                                    <input
                                        className="form-input"
                                        placeholder="~/.ssh/id_rsa"
                                        value={privateKeyPath}
                                        onChange={e => setPrivateKeyPath(e.target.value)}
                                        style={{ flex: 1, ...(keySource !== 'manual' ? { opacity: 0.6 } : {}) }}
                                        readOnly={keySource !== 'manual'}
                                    />
                                    {keySource === 'manual' && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleSelectKey('main')}>
                                            <FolderOpen size={14} /> Browse
                                        </button>
                                    )}
                                </div>
                            </div>
                            {authType === 'key+passphrase' && (
                                <div className="form-group">
                                    <label className="form-label">Passphrase</label>
                                    <input
                                        className="form-input"
                                        type="password"
                                        placeholder="Enter passphrase"
                                        value={passphrase}
                                        onChange={e => setPassphrase(e.target.value)}
                                        readOnly={keySource !== 'manual' && !!sshKeys?.find(k => k.id === keySource)?.passphrase}
                                        style={keySource !== 'manual' && sshKeys?.find(k => k.id === keySource)?.passphrase ? { opacity: 0.6 } : {}}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* ProxyJump */}
                    <div className="divider" />
                    <div className="form-group">
                        <label className="form-checkbox">
                            <input
                                type="checkbox"
                                checked={proxyJump.enabled}
                                onChange={e => setProxyJump(p => ({ ...p, enabled: e.target.checked }))}
                            />
                            Enable ProxyJump (Jump Host)
                        </label>
                    </div>

                    {proxyJump.enabled && (
                        <div className="proxy-section">
                            <div className="proxy-header">
                                <span className="proxy-title">⚡ Jump Host Configuration</span>
                            </div>

                            {/* Select from existing connection */}
                            <div className="form-group">
                                <label className="form-label">Jump Host Source</label>
                                <select
                                    className="form-select"
                                    value={proxySource}
                                    onChange={e => {
                                        const val = e.target.value
                                        setProxySource(val)
                                        if (val !== 'manual') {
                                            // Auto-fill from existing connection
                                            const src = connections.find(c => c.id === val)
                                            if (src) {
                                                setProxyJump(p => ({
                                                    ...p,
                                                    host: src.host,
                                                    port: src.port,
                                                    username: src.username,
                                                    authType: src.authType === 'password' ? 'password' : 'key',
                                                    password: src.password || '',
                                                    privateKeyPath: src.privateKeyPath || '',
                                                }))
                                            }
                                        }
                                    }}
                                >
                                    <option value="manual">✏️ Enter manually</option>
                                    {connections
                                        .filter(c => c.id !== connection?.id) // exclude self
                                        .map(c => (
                                            <option key={c.id} value={c.id}>
                                                🖥️ {c.name} ({c.username}@{c.host}:{c.port})
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            {proxySource !== 'manual' && (
                                <div style={{
                                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                                    fontSize: 12, background: 'rgba(59, 130, 246, 0.1)',
                                    color: 'var(--accent-blue)', marginBottom: 12,
                                }}>
                                    Using <strong>{connections.find(c => c.id === proxySource)?.name}</strong> as jump host
                                </div>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Jump Host</label>
                                    <input
                                        className="form-input"
                                        placeholder="jump.example.com"
                                        value={proxyJump.host}
                                        onChange={e => setProxyJump(p => ({ ...p, host: e.target.value }))}
                                        readOnly={proxySource !== 'manual'}
                                        style={proxySource !== 'manual' ? { opacity: 0.6 } : {}}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Port</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        value={proxyJump.port}
                                        onChange={e => setProxyJump(p => ({ ...p, port: Number(e.target.value) }))}
                                        readOnly={proxySource !== 'manual'}
                                        style={proxySource !== 'manual' ? { opacity: 0.6 } : {}}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input
                                    className="form-input"
                                    placeholder="root"
                                    value={proxyJump.username}
                                    onChange={e => setProxyJump(p => ({ ...p, username: e.target.value }))}
                                    readOnly={proxySource !== 'manual'}
                                    style={proxySource !== 'manual' ? { opacity: 0.6 } : {}}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Auth Type</label>
                                <select
                                    className="form-select"
                                    value={proxyJump.authType}
                                    onChange={e => setProxyJump(p => ({ ...p, authType: e.target.value as any }))}
                                    disabled={proxySource !== 'manual'}
                                    style={proxySource !== 'manual' ? { opacity: 0.6 } : {}}
                                >
                                    <option value="password">Password</option>
                                    <option value="key">SSH Key</option>
                                </select>
                            </div>
                            {proxyJump.authType === 'password' ? (
                                <div className="form-group">
                                    <label className="form-label">Password</label>
                                    <input
                                        className="form-input"
                                        type="password"
                                        placeholder="Jump host password"
                                        value={proxyJump.password || ''}
                                        onChange={e => setProxyJump(p => ({ ...p, password: e.target.value }))}
                                        readOnly={proxySource !== 'manual'}
                                        style={proxySource !== 'manual' ? { opacity: 0.6 } : {}}
                                    />
                                </div>
                            ) : (
                                <div className="form-group">
                                    <label className="form-label">Private Key Path</label>
                                    <div className="form-file-input">
                                        <input
                                            className="form-input"
                                            placeholder="~/.ssh/id_rsa"
                                            value={proxyJump.privateKeyPath || ''}
                                            onChange={e => setProxyJump(p => ({ ...p, privateKeyPath: e.target.value }))}
                                            style={{ flex: 1, ...(proxySource !== 'manual' ? { opacity: 0.6 } : {}) }}
                                            readOnly={proxySource !== 'manual'}
                                        />
                                        {proxySource === 'manual' && (
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleSelectKey('proxy')}>
                                                <FolderOpen size={14} /> Browse
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="divider" />

                    {/* Workspace */}
                    <div className="form-group">
                        <label className="form-label">Workspace</label>
                        <select
                            className="form-select"
                            value={workspaceId}
                            onChange={e => setWorkspaceId(e.target.value)}
                        >
                            {workspaces.map(ws => (
                                <option key={ws.id} value={ws.id}>
                                    {ws.icon} {ws.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Folder (nested, filtered by workspace) */}
                    <div className="form-group">
                        <label className="form-label">Folder</label>
                        <select
                            className="form-select"
                            value={folderId || ''}
                            onChange={e => setFolderId(e.target.value || undefined)}
                        >
                            <option value="">— No folder (workspace root) —</option>
                            {(() => {
                                // Build nested folder options with indentation
                                const options: { id: string; name: string; depth: number }[] = []
                                function buildOptions(parentId: string | undefined, depth: number) {
                                    folders
                                        .filter(f => f.workspaceId === workspaceId && (parentId ? f.parentId === parentId : !f.parentId))
                                        .forEach(f => {
                                            options.push({ id: f.id, name: f.name, depth })
                                            buildOptions(f.id, depth + 1)
                                        })
                                }
                                buildOptions(undefined, 0)
                                return options.map(opt => (
                                    <option key={opt.id} value={opt.id}>
                                        {'\u00A0\u00A0'.repeat(opt.depth)}📁 {opt.name}
                                    </option>
                                ))
                            })()}
                        </select>
                    </div>

                    {/* Tags */}
                    <div className="form-group">
                        <label className="form-label">Tags</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {tags.map(tag => (
                                <span
                                    key={tag.id}
                                    className="tag-badge"
                                    style={{
                                        background: selectedTags.includes(tag.id) ? `${tag.color}30` : `${tag.color}10`,
                                        color: tag.color,
                                        border: selectedTags.includes(tag.id) ? `1px solid ${tag.color}` : '1px solid transparent',
                                    }}
                                    onClick={() => toggleTag(tag.id)}
                                >
                                    {tag.name}
                                </span>
                            ))}
                            {tags.length === 0 && (
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tags available</span>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea
                            className="form-textarea"
                            placeholder="Optional notes about this server..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Test Result */}
                    {testResult && (
                        <div style={{
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 12,
                            background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: testResult.success ? 'var(--accent-green)' : 'var(--accent-red)',
                            marginBottom: 8,
                        }}>
                            {testResult.message}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={handleTest} disabled={testing}>
                        <Zap size={14} /> {testing ? 'Testing...' : 'Test Connection'}
                    </button>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        {connection ? 'Save Changes' : 'Create Connection'}
                    </button>
                </div>
            </div>
        </div>
    )
}
