// ============================================================
// Nginx Analytics Panel Component
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { X, RefreshCw, AlertCircle, Calendar, Filter } from 'lucide-react'
import { parse, format, isWithinInterval, startOfDay, endOfDay, isSameDay } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import type { SSHConnection } from '../types'

interface Props {
  connection: SSHConnection
  onClose: () => void
}

interface LogEntry {
  raw: string
  ip: string
  timestamp: Date
  method: string
  path: string
  status: number
  bytes: number
  referer: string
  userAgent: string
}

// Removed NGINX_REGEX as parsing is now done in backend

export default function NginxAnalyticsPanel({ connection, onClose }: Props) {
  const logFiles = connection.logFiles || []
  const [selectedLogPath, setSelectedLogPath] = useState<string>(logFiles[0]?.path || '')
  
  const [parsedLogs, setParsedLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = window.sshTool.onSshAnalyzeStatus?.((status) => {
      setLoadingStatus(status)
    })
    
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'this_month' | 'specific' | 'range'>('today')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  
  const [filterIp, setFilterIp] = useState('')
  const [filterPath, setFilterPath] = useState('')
  const [filterReferer, setFilterReferer] = useState('')

  // 1. Fetch Log
  async function fetchLogs() {
    if (!selectedLogPath) return
    setLoading(true)
    setLoadingStatus('Đang chuẩn bị kết nối...')
    setError(null)
    setParsedLogs([])
    try {
      const filters = { dateFilter, startDate, endDate }
      const output = await window.sshTool.sshAnalyzeLog(connection, selectedLogPath, filters)
      setLoadingStatus('Đang ráp dữ liệu vào biểu đồ...')
      const mapped = output.map((l: any) => ({
        ...l,
        timestamp: new Date(l.timestamp)
      }))
      setParsedLogs(mapped)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch logs')
    } finally {
      setLoading(false)
      setLoadingStatus('')
    }
  }

  useEffect(() => {
    if (selectedLogPath) {
      fetchLogs()
    }
  }, [selectedLogPath])

  // 2. Parse Logs (Moved to Backend SFTP Stream Handler)

  // 3. Apply Filters
  const filteredLogs = useMemo(() => {
    let result = parsedLogs

    // Time filter
    const now = new Date()
    if (dateFilter === 'today') {
      const start = startOfDay(now)
      const end = endOfDay(now)
      result = result.filter(l => isWithinInterval(l.timestamp, { start, end }))
    } else if (dateFilter === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      result = result.filter(l => isWithinInterval(l.timestamp, { start, end: now }))
    } else if (dateFilter === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      result = result.filter(l => isWithinInterval(l.timestamp, { start, end: now }))
    } else if (dateFilter === 'specific' && startDate) {
      const specificDate = new Date(startDate)
      if (!isNaN(specificDate.getTime())) {
        const start = startOfDay(specificDate)
        const end = endOfDay(specificDate)
        result = result.filter(l => isWithinInterval(l.timestamp, { start, end }))
      }
    } else if (dateFilter === 'range' && startDate && endDate) {
      const sDate = startOfDay(new Date(startDate))
      const eDate = endOfDay(new Date(endDate))
      if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
        result = result.filter(l => l.timestamp >= sDate && l.timestamp <= eDate)
      }
    }

    if (filterIp) {
      result = result.filter(l => l.ip.includes(filterIp))
    }
    if (filterPath) {
      result = result.filter(l => l.path.includes(filterPath))
    }
    if (filterReferer) {
      result = result.filter(l => l.referer.includes(filterReferer))
    }

    return result
  }, [parsedLogs, dateFilter, startDate, endDate, filterIp, filterPath, filterReferer])

  const filterOptions = useMemo(() => {
    const ipCounts: Record<string, number> = {}
    const pathCounts: Record<string, number> = {}
    const refCounts: Record<string, number> = {}

    parsedLogs.forEach(l => {
      ipCounts[l.ip] = (ipCounts[l.ip] || 0) + 1
      pathCounts[l.path] = (pathCounts[l.path] || 0) + 1
      if (l.referer && l.referer !== '-') {
        refCounts[l.referer] = (refCounts[l.referer] || 0) + 1
      }
    })

    const sortByCount = (c: Record<string, number>) => 
      Object.entries(c).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 300)

    return {
      ips: sortByCount(ipCounts),
      paths: sortByCount(pathCounts),
      referers: sortByCount(refCounts)
    }
  }, [parsedLogs])

  // 4. Aggregate data for charts
  const trafficChartData = useMemo(() => {
    // Group by hour or minute depending on time span length
    const timeSpanMs = filteredLogs.length > 0 
        ? filteredLogs[filteredLogs.length-1].timestamp.getTime() - filteredLogs[0].timestamp.getTime()
        : 0

    // If span > 1 day, group by day. If < 1 day, group by hour. If < 1 hour, group by minute.
    let formatStr = 'HH:00'
    if (timeSpanMs > 24 * 60 * 60 * 1000) formatStr = 'MMM dd'
    else if (timeSpanMs < 2 * 60 * 60 * 1000) formatStr = 'HH:mm'

    const buckets: Record<string, { time: string; requests: number; bytes: number }> = {}

    for (const log of filteredLogs) {
      const str = format(log.timestamp, formatStr)
      if (!buckets[str]) buckets[str] = { time: str, requests: 0, bytes: 0 }
      buckets[str].requests += 1
      buckets[str].bytes += log.bytes
    }

    return Object.values(buckets)
  }, [filteredLogs])
  
  const statusStats = useMemo(() => {
    const counts = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }
    for (const log of filteredLogs) {
      if (log.status >= 200 && log.status < 300) counts['2xx']++
      else if (log.status >= 300 && log.status < 400) counts['3xx']++
      else if (log.status >= 400 && log.status < 500) counts['4xx']++
      else if (log.status >= 500) counts['5xx']++
    }
    return [
      { name: '2xx (OK)', count: counts['2xx'], fill: '#22c55e' },
      { name: '3xx (Redir)', count: counts['3xx'], fill: '#eab308' },
      { name: '4xx (Client)', count: counts['4xx'], fill: '#f97316' },
      { name: '5xx (Server)', count: counts['5xx'], fill: '#ef4444' }
    ]
  }, [filteredLogs])
  
  const topStats = useMemo(() => {
    const ipCounts: Record<string, number> = {}
    const pathCounts: Record<string, number> = {}
    const domainCounts: Record<string, number> = {}

    filteredLogs.forEach(l => {
      ipCounts[l.ip] = (ipCounts[l.ip] || 0) + 1
      // Only keep the base path before query string to group effectively
      const basePath = l.path.split('?')[0]
      pathCounts[basePath] = (pathCounts[basePath] || 0) + 1
      
      if (l.referer && l.referer !== '-') {
        try {
          const url = new URL(l.referer)
          domainCounts[url.hostname] = (domainCounts[url.hostname] || 0) + 1
        } catch {
          domainCounts[l.referer] = (domainCounts[l.referer] || 0) + 1
        }
      }
    })

    const getTop10 = (counts: Record<string, number>) => 
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => ({ name: x[0], count: x[1] }))

    return {
      ips: getTop10(ipCounts),
      paths: getTop10(pathCounts),
      domains: getTop10(domainCounts)
    }
  }, [filteredLogs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-layer-0)' }}>
      {/* Header */}
      <div className="main-header titlebar-drag">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }} className="titlebar-no-drag">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Nginx Analytics</h2>
          <select 
            className="form-select" 
            style={{ width: 200, padding: '4px 8px' }}
            value={selectedLogPath}
            onChange={e => setSelectedLogPath(e.target.value)}
          >
            {logFiles.map(file => (
              <option key={file.id} value={file.path}>{file.name || file.path}</option>
            ))}
          </select>
          <button className="icon-btn" onClick={fetchLogs} disabled={loading || !selectedLogPath}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
        <button className="icon-btn titlebar-no-drag" onClick={onClose}><X size={18} /></button>
      </div>

      {!logFiles.length ? (
        <div className="empty-state">
           <AlertCircle size={48} style={{ opacity: 0.2 }} />
           <div className="empty-text">No Nginx log files connected to this server.</div>
        </div>
      ) : loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
           <div style={{ width: 24, height: 24, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} className="spin"></div>
           <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{loadingStatus || 'Connecting...'}</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ padding: 12, borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)' }}>
              {error}
            </div>
          )}

          {/* Filters Area */}
          <div style={{ display: 'flex', gap: 16, background: 'var(--bg-layer-1)', padding: 16, borderRadius: 8 }}>
            {/* Time Filter */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={12} /> Time Range
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-select" value={dateFilter} onChange={e => setDateFilter(e.target.value as any)}>
                  <option value="today">Today</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="this_month">This Month</option>
                  <option value="specific">Specific Day</option>
                  <option value="range">Date Range</option>
                </select>
                {dateFilter === 'specific' && (
                  <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                )}
                {dateFilter === 'range' && (
                  <>
                    <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </>
                )}
              </div>
            </div>
            
            {/* Field Filters */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={12} /> Data Filters
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Filter by IP..." list="ip-options" value={filterIp} onChange={e => setFilterIp(e.target.value)} />
                <datalist id="ip-options">
                  {filterOptions.ips.map(ip => <option key={ip} value={ip} />)}
                </datalist>

                <input className="form-input" placeholder="Filter by Path..." list="path-options" value={filterPath} onChange={e => setFilterPath(e.target.value)} />
                <datalist id="path-options">
                  {filterOptions.paths.map(p => <option key={p} value={p} />)}
                </datalist>

                <input className="form-input" placeholder="Filter by Referer..." list="ref-options" value={filterReferer} onChange={e => setFilterReferer(e.target.value)} />
                <datalist id="ref-options">
                  {filterOptions.referers.map(r => <option key={r} value={r} />)}
                </datalist>
              </div>
            </div>
          </div>

          {/* Metrics Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div style={{ background: 'var(--bg-layer-1)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Requests</div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{filteredLogs.length.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-layer-1)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unique IPs</div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                {new Set(filteredLogs.map(l => l.ip)).size.toLocaleString()}
              </div>
            </div>
            <div style={{ background: 'var(--bg-layer-1)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Bandwidth</div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                {(filteredLogs.reduce((acc, l) => acc + l.bytes, 0) / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <div style={{ background: 'var(--bg-layer-1)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>4xx / 5xx Errors</div>
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: 'var(--accent-red)' }}>
                {filteredLogs.filter(l => l.status >= 400).length.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Charts Area */}
          <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 300 }}>
            {/* Traffic Chart */}
            <div style={{ flex: 2, background: 'var(--bg-layer-1)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Traffic Volume</div>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={trafficChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-layer-0)', border: '1px solid var(--border-strong)', borderRadius: 4 }} 
                  />
                  <Line type="monotone" dataKey="requests" stroke="var(--accent-blue)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Status Chart */}
            <div style={{ flex: 1, background: 'var(--bg-layer-1)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Status Codes</div>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={statusStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-strong)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--bg-layer-0)', border: '1px solid var(--border-strong)', borderRadius: 4 }} 
                    cursor={{ fill: 'var(--bg-layer-2)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Top Lists Area */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ background: 'var(--bg-layer-1)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Top Referer Domains</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topStats.domains.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-normal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }} title={item.name}>{item.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{item.count.toLocaleString()}</span>
                  </div>
                ))}
                {topStats.domains.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data available</div>}
              </div>
            </div>

            <div style={{ background: 'var(--bg-layer-1)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Top IPs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topStats.ips.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-normal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }} title={item.name}>{item.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{item.count.toLocaleString()}</span>
                  </div>
                ))}
                {topStats.ips.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data available</div>}
              </div>
            </div>

            <div style={{ background: 'var(--bg-layer-1)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Top Paths</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topStats.paths.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-normal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }} title={item.name}>{item.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{item.count.toLocaleString()}</span>
                  </div>
                ))}
                {topStats.paths.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data available</div>}
              </div>
            </div>
          </div>
          
        </div>
      )}
    </div>
  )
}
