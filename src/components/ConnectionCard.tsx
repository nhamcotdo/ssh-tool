// ============================================================
// Connection Card Component
// ============================================================

import {
    Play, Pencil, Copy, Trash2, Key, Lock, ArrowRightLeft,
} from 'lucide-react'
import type { SSHConnection, Tag } from '../types'
import { timeAgo } from '../lib/utils'

interface ConnectionCardProps {
    connection: SSHConnection
    tags: Tag[]
    onConnect: (id: string) => void
    onEdit: (c: SSHConnection) => void
    onDuplicate: (id: string) => void
    onDelete: (id: string) => void
}

export default function ConnectionCard({
    connection: c, tags, onConnect, onEdit, onDuplicate, onDelete,
}: ConnectionCardProps) {
    const connTags = tags.filter(t => c.tags.includes(t.id))
    const authIcon = c.authType === 'password' ? <Lock size={11} /> : <Key size={11} />
    const authLabel = c.authType === 'password' ? 'Password' : c.authType === 'key+passphrase' ? 'Key+Pass' : 'SSH Key'

    return (
        <div className="connection-card" onDoubleClick={() => onConnect(c.id)}>
            <div className="card-header">
                <div>
                    <div className="card-name">{c.name}</div>
                    <div className="card-host">{c.username}@{c.host}:{c.port}</div>
                </div>
                <div className="card-actions">
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onConnect(c.id) }} title="Connect">
                        <Play size={14} />
                    </button>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(c) }} title="Edit">
                        <Pencil size={14} />
                    </button>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onDuplicate(c.id) }} title="Duplicate">
                        <Copy size={14} />
                    </button>
                    <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(c.id) }} title="Delete">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="card-meta">
                <span className="auth-badge">
                    {authIcon} {authLabel}
                </span>
                {c.proxyJump?.enabled && (
                    <span className="proxy-badge">
                        <ArrowRightLeft size={11} /> ProxyJump
                    </span>
                )}
                {connTags.map(t => (
                    <span
                        key={t.id}
                        className="tag-badge"
                        style={{ background: `${t.color}20`, color: t.color, fontSize: 10, padding: '1px 6px' }}
                    >
                        {t.name}
                    </span>
                ))}
            </div>

            {c.lastConnected && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    Last connected: {timeAgo(c.lastConnected)}
                </div>
            )}
        </div>
    )
}
