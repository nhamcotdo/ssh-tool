// ============================================================
// Connection Card Component
// ============================================================

import { useState, useRef } from 'react'
import {
    Play, Pencil, Copy, Trash2, Key, Lock, ArrowRightLeft, Activity,
    Wifi, WifiOff, Loader2, Radio, Cpu, MemoryStick, HardDrive, Clock
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
    onAnalytics: (c: SSHConnection) => void
}

interface ServerStats {
    cpu: number       // %
    memUsed: number   // MB
    memTotal: number  // MB
    diskUsed: string  // e.g. "12G"
    diskTotal: string // e.g. "50G"
    diskPct: number   // %
    load: string      // e.g. "0.12 0.34 0.56"
    uptime: string    // e.g. "5d 12h 3m"
}

type StatusState =
    | { type: 'idle' }
    | { type: 'checking' }
    | { type: 'online'; latency: number; stats?: ServerStats }
    | { type: 'offline'; message: string }

// Shell command that works on virtually all Linux distros
// Uses /proc directly — no dependency on external tools beyond awk/df
const STATS_CMD = [
    // CPU: two-sample read via /proc/stat (0.5s apart)
    'S1=$(awk \'/^cpu /{t=$2+$3+$4+$5+$6+$7+$8;print t":"$5}\' /proc/stat);',
    'sleep 0.5;',
    'S2=$(awk \'/^cpu /{t=$2+$3+$4+$5+$6+$7+$8;print t":"$5}\' /proc/stat);',
    'awk -v s1="$S1" -v s2="$S2" \'BEGIN{split(s1,a,":");split(s2,b,":");dt=b[1]-a[1];di=b[2]-a[2];printf "CPU:%.1f\\n",dt>0?(dt-di)/dt*100:0}\';',
    // Memory from /proc/meminfo
    'awk \'/MemTotal/{t=$2}/MemAvailable/{a=$2}END{printf "MEM:%d:%d\\n",(t-a)/1024,t/1024}\' /proc/meminfo;',
    // Disk usage for /
    'df -h / 2>/dev/null | awk \'NR==2{gsub(/%/,"",$5);printf "DISK:%s:%s:%s\\n",$3,$2,$5}\';',
    // Load average (1m 5m 15m)
    'awk \'{printf "LOAD:%s %s %s\\n",$1,$2,$3}\' /proc/loadavg;',
    // Uptime from /proc/uptime
    'awk \'{d=int($1/86400);h=int(($1%86400)/3600);m=int(($1%3600)/60);printf "UPTIME:%dd %dh %dm\\n",d,h,m}\' /proc/uptime',
].join(' ')

function parseStats(raw: string): ServerStats | null {
    try {
        const lines = raw.split('\n')
        const get = (prefix: string) =>
            (lines.find(l => l.startsWith(prefix)) ?? '').slice(prefix.length)

        const cpuLine  = get('CPU:')
        const memLine  = get('MEM:')
        const diskLine = get('DISK:')
        const loadLine = get('LOAD:')
        const uptimeLine = get('UPTIME:')

        const [memUsedStr, memTotalStr] = memLine.split(':')
        const [diskUsed, diskTotal, diskPctStr] = diskLine.split(':')

        const memUsed  = parseInt(memUsedStr) || 0
        const memTotal = parseInt(memTotalStr) || 1
        const diskPct  = parseInt(diskPctStr) || 0

        if (!memTotal || !diskTotal) return null

        return {
            cpu: parseFloat(cpuLine) || 0,
            memUsed,
            memTotal,
            diskUsed: diskUsed || '?',
            diskTotal: diskTotal || '?',
            diskPct,
            load: loadLine || '?',
            uptime: uptimeLine || '?',
        }
    } catch {
        return null
    }
}

function metricColor(pct: number): string {
    if (pct >= 85) return 'var(--accent-red)'
    if (pct >= 65) return 'var(--accent-amber)'
    return 'var(--accent-green)'
}

function StatBar({ pct, label }: { pct: number; label: string }) {
    const color = metricColor(pct)
    return (
        <div className="stat-bar-wrap" title={`${label}: ${pct}%`}>
            <div className="stat-bar-track">
                <div
                    className="stat-bar-fill"
                    style={{ width: `${Math.min(pct, 100)}%`, background: color }}
                />
            </div>
        </div>
    )
}

export default function ConnectionCard({
    connection: c, tags, onConnect, onEdit, onDuplicate, onDelete, onAnalytics,
}: ConnectionCardProps) {
    const connTags = tags.filter(t => c.tags.includes(t.id))
    const authIcon  = c.authType === 'password' ? <Lock size={11} /> : <Key size={11} />
    const authLabel = c.authType === 'password' ? 'Password'
        : c.authType === 'key+passphrase' ? 'Key+Pass' : 'SSH Key'

    const [status, setStatus] = useState<StatusState>({ type: 'idle' })
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    async function handleCheckStatus(e: React.MouseEvent) {
        e.stopPropagation()
        if (status.type === 'checking') return

        if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
        setStatus({ type: 'checking' })

        try {
            // Step 1: test connectivity + measure latency
            const result = await window.sshTool.sshTest(c)
            if (!result.success) {
                setStatus({ type: 'offline', message: result.message })
                scheduleReset()
                return
            }

            // Step 2: fetch CPU / MEM / DISK / UPTIME
            let stats: ServerStats | undefined
            try {
                const raw = await window.sshTool.sshExec(c, STATS_CMD)
                stats = parseStats(raw) ?? undefined
            } catch {
                // stats are optional — connection is still online
            }

            setStatus({ type: 'online', latency: result.latency ?? 0, stats })
        } catch (err: any) {
            setStatus({ type: 'offline', message: err?.message ?? 'Unknown error' })
        }

        scheduleReset()
    }

    function scheduleReset() {
        resetTimerRef.current = setTimeout(() => {
            setStatus({ type: 'idle' })
        }, 60000) // auto-clear after 60s
    }

    // ── Render helpers ──────────────────────────────────────────

    function renderStatusBadge() {
        if (status.type === 'idle') return null

        if (status.type === 'checking') {
            return (
                <span className="status-badge status-badge--checking">
                    <Loader2 size={10} className="spin-icon" />
                    Checking…
                </span>
            )
        }

        if (status.type === 'online') {
            return (
                <span className="status-badge status-badge--online">
                    <Wifi size={10} />
                    Online · {status.latency}ms
                </span>
            )
        }

        return (
            <span className="status-badge status-badge--offline" title={status.message}>
                <WifiOff size={10} />
                Offline
            </span>
        )
    }

    function renderStatsPanel() {
        if (status.type !== 'online' || !status.stats) return null
        const s = status.stats
        const memPct = Math.round((s.memUsed / s.memTotal) * 100)

        return (
            <div className="server-stats" onClick={e => e.stopPropagation()}>
                {/* CPU */}
                <div className="stat-item">
                    <div className="stat-header">
                        <Cpu size={10} />
                        <span>CPU</span>
                        <span className="stat-value" style={{ color: metricColor(s.cpu) }}>
                            {s.cpu.toFixed(1)}%
                        </span>
                    </div>
                    <StatBar pct={s.cpu} label="CPU" />
                </div>

                {/* Memory */}
                <div className="stat-item">
                    <div className="stat-header">
                        <MemoryStick size={10} />
                        <span>RAM</span>
                        <span className="stat-value" style={{ color: metricColor(memPct) }}>
                            {s.memUsed >= 1024
                                ? `${(s.memUsed / 1024).toFixed(1)}G`
                                : `${s.memUsed}M`}
                            &nbsp;/&nbsp;
                            {s.memTotal >= 1024
                                ? `${(s.memTotal / 1024).toFixed(1)}G`
                                : `${s.memTotal}M`}
                        </span>
                    </div>
                    <StatBar pct={memPct} label="RAM" />
                </div>

                {/* Disk */}
                <div className="stat-item">
                    <div className="stat-header">
                        <HardDrive size={10} />
                        <span>Disk</span>
                        <span className="stat-value" style={{ color: metricColor(s.diskPct) }}>
                            {s.diskUsed} / {s.diskTotal}
                        </span>
                    </div>
                    <StatBar pct={s.diskPct} label="Disk" />
                </div>

                {/* Load + Uptime row */}
                <div className="stat-footer">
                    <span title="Load average (1m 5m 15m)">Load: {s.load}</span>
                    <span className="stat-footer-sep">·</span>
                    <Clock size={9} />
                    <span>{s.uptime}</span>
                </div>
            </div>
        )
    }

    return (
        <div className="connection-card" onDoubleClick={() => onConnect(c.id)}>
            <div className="card-header">
                <div>
                    <div className="card-name">{c.name}</div>
                    <div className="card-host">{c.username}@{c.host}:{c.port}</div>
                </div>
                <div className="card-actions">
                    <button
                        className={`icon-btn${status.type === 'online' ? ' active-status' : ''}`}
                        onClick={handleCheckStatus}
                        title="Check server status"
                        disabled={status.type === 'checking'}
                    >
                        <Radio size={14} />
                    </button>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onConnect(c.id) }} title="Connect">
                        <Play size={14} />
                    </button>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(c) }} title="Edit">
                        <Pencil size={14} />
                    </button>
                    {c.logFiles && c.logFiles.length > 0 && (
                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onAnalytics(c) }} title="Analytics">
                            <Activity size={14} />
                        </button>
                    )}
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
                {renderStatusBadge()}
            </div>

            {renderStatsPanel()}

            {c.lastConnected && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    Last connected: {timeAgo(c.lastConnected)}
                </div>
            )}
        </div>
    )
}
