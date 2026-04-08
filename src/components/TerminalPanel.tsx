// ============================================================
// Terminal Panel — Multi-tab xterm.js
// ============================================================

import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { X, Terminal as TerminalIcon, Loader2, RefreshCw } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TerminalTab } from '../types'
import 'xterm/css/xterm.css'

interface TerminalPanelProps {
    tabs: TerminalTab[]
    activeTabId: string | null
    onSelectTab: (id: string) => void
    onCloseTab: (id: string) => void
    onReconnect: (id: string) => void
    onReorderTabs: (tabs: TerminalTab[]) => void
    settings: { terminalFontSize: number; terminalFontFamily: string }
}

function SortableTab({ tab, activeTabId, onSelectTab, onCloseTab }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: tab.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`terminal-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onPointerDown={(e) => {
                // Ignore middle clicks or right clicks to avoid interfering with drag/context
                if (e.button === 0) {
                    onSelectTab(tab.id)
                }
            }}
        >
            <span className={`tab-dot ${tab.connecting ? 'connecting' : tab.connected ? 'connected' : 'disconnected'}`} />
            <TerminalIcon size={12} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{tab.name}</span>
            {tab.connecting && <Loader2 size={12} className="spin" />}
            <span
                className="tab-close"
                onPointerDown={(e) => { e.stopPropagation(); onCloseTab(tab.id) }}
            >
                <X size={10} />
            </span>
        </div>
    )
}

export default function TerminalPanel({
    tabs, activeTabId, onSelectTab, onCloseTab, onReconnect, onReorderTabs, settings,
}: TerminalPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const terminalsRef = useRef<Map<string, { term: Terminal; fitAddon: FitAddon }>>(new Map())
    const cleanupRef = useRef<Map<string, () => void>>(new Map())

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event

        if (over && active.id !== over.id) {
            const oldIndex = tabs.findIndex(t => t.id === active.id)
            const newIndex = tabs.findIndex(t => t.id === over.id)
            onReorderTabs(arrayMove(tabs, oldIndex, newIndex))
        }
    }

    // Create or attach terminal for active tab
    useEffect(() => {
        if (!activeTabId || !containerRef.current) return

        const activeTab = tabs.find(t => t.id === activeTabId)
        if (!activeTab || activeTab.connecting) return

        // Hide all terminals
        const container = containerRef.current
        Array.from(container.children).forEach((child) => {
            (child as HTMLElement).style.display = 'none'
        })

        // Check if terminal already exists
        let entry = terminalsRef.current.get(activeTabId)
        if (!entry) {
            // Create new terminal
            const term = new Terminal({
                fontSize: settings.terminalFontSize,
                fontFamily: settings.terminalFontFamily,
                theme: {
                    background: '#000000',
                    foreground: '#e5e5e5',
                    cursor: '#3b82f6',
                    cursorAccent: '#000000',
                    selectionBackground: 'rgba(59, 130, 246, 0.3)',
                    black: '#000000',
                    red: '#ef4444',
                    green: '#22c55e',
                    yellow: '#f59e0b',
                    blue: '#3b82f6',
                    magenta: '#a855f7',
                    cyan: '#06b6d4',
                    white: '#e5e5e5',
                    brightBlack: '#525252',
                    brightRed: '#f87171',
                    brightGreen: '#4ade80',
                    brightYellow: '#fbbf24',
                    brightBlue: '#60a5fa',
                    brightMagenta: '#c084fc',
                    brightCyan: '#22d3ee',
                    brightWhite: '#ffffff',
                },
                cursorBlink: true,
                scrollback: 10000,
                allowProposedApi: true,
            })
            const fitAddon = new FitAddon()
            term.loadAddon(fitAddon)

            const div = document.createElement('div')
            div.style.height = '100%'
            div.style.width = '100%'
            div.style.overflow = 'hidden'
            div.style.padding = '4px'
            div.dataset.tabId = activeTabId
            container.appendChild(div)
            term.open(div)

            // Send input to SSH
            const disposable = term.onData((data) => {
                window.sshTool.sshInput(activeTab.sessionId, data)
            })

            // Listen for SSH data
            const removeDataListener = window.sshTool.onSshData((connId, data) => {
                if (connId === activeTab.connectionId) {
                    term.write(data)
                }
            })

            // Listen for SSH close
            const removeCloseListener = window.sshTool.onSshClosed((connId) => {
                if (connId === activeTab.connectionId) {
                    term.write('\r\n\x1b[31m--- Connection closed ---\x1b[0m\r\n')
                }
            })

            cleanupRef.current.set(activeTabId, () => {
                disposable.dispose()
                removeDataListener()
                removeCloseListener()
                term.dispose()
                div.remove()
            })

            entry = { term, fitAddon }
            terminalsRef.current.set(activeTabId, entry)

            // Fit after open
            requestAnimationFrame(() => {
                try {
                    fitAddon.fit()
                    window.sshTool.sshResize(activeTab.sessionId, term.cols, term.rows)
                } catch { }
            })
        }

        // Show the active terminal
        const activeDiv = container.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement
        if (activeDiv) {
            activeDiv.style.display = 'block'
            requestAnimationFrame(() => {
                try {
                    entry!.fitAddon.fit()
                } catch { }
                entry!.term.focus()
            })
        }
    }, [activeTabId, tabs])

    // Cleanup removed tabs
    useEffect(() => {
        const tabIds = new Set(tabs.map(t => t.id))
        for (const [id, cleanup] of cleanupRef.current) {
            if (!tabIds.has(id)) {
                cleanup()
                cleanupRef.current.delete(id)
                terminalsRef.current.delete(id)
            }
        }
    }, [tabs])

    // Resize handler
    useEffect(() => {
        const handleResize = () => {
            if (!activeTabId) return
            const entry = terminalsRef.current.get(activeTabId)
            const activeTab = tabs.find(t => t.id === activeTabId)
            if (entry && activeTab) {
                try {
                    entry.fitAddon.fit()
                    window.sshTool.sshResize(activeTab.sessionId, entry.term.cols, entry.term.rows)
                } catch { }
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [activeTabId, tabs])

    if (tabs.length === 0) {
        return null
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Tab bar */}
            <div className="terminal-tabs" style={{ display: 'flex', overflowX: 'auto' }}>
                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={tabs.map(t => t.id)}
                        strategy={horizontalListSortingStrategy}
                    >
                        {tabs.map(tab => (
                            <SortableTab 
                                key={tab.id}
                                tab={tab}
                                activeTabId={activeTabId}
                                onSelectTab={onSelectTab}
                                onCloseTab={onCloseTab}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>

            {/* Terminal area and Overlay Wrapper */}
            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                <div ref={containerRef} className="terminal-container" style={{ flex: 1, overflow: 'hidden' }} />

                {/* Connecting overlay */}
            {tabs.find(t => t.id === activeTabId)?.connecting && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.8)', zIndex: 10,
                    flexDirection: 'column', gap: 12,
                }}>
                    <Loader2 size={28} className="spin" style={{ color: 'var(--accent-blue)' }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Connecting...</span>
                </div>
            )}

            {/* Disconnected overlay */}
            {tabs.find(t => t.id === activeTabId && !t.connected && !t.connecting) && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.65)', zIndex: 10,
                    flexDirection: 'column', gap: 16,
                }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>Session Disconnected</span>
                    <button 
                        className="btn btn-primary"
                        onClick={() => {
                            if (activeTabId) onReconnect(activeTabId)
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 14 }}
                    >
                        <RefreshCw size={16} /> Reconnect
                    </button>
                </div>
            )}
            </div>
        </div>
    )
}
