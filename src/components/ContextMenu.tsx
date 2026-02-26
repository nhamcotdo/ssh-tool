// ============================================================
// Context Menu — right-click dropdown
// ============================================================

import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
    label: string
    icon?: React.ReactNode
    danger?: boolean
    disabled?: boolean
    onClick: () => void
}

interface ContextMenuProps {
    x: number
    y: number
    items: ContextMenuItem[]
    onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [onClose])

    // Clamp position to stay within viewport
    useEffect(() => {
        if (!menuRef.current) return
        const rect = menuRef.current.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight
        if (rect.right > vw) {
            menuRef.current.style.left = `${vw - rect.width - 8}px`
        }
        if (rect.bottom > vh) {
            menuRef.current.style.top = `${vh - rect.height - 8}px`
        }
    }, [x, y])

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{ left: x, top: y }}
        >
            {items.map((item, i) => (
                <div
                    key={i}
                    className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
                    onClick={() => {
                        if (!item.disabled) {
                            item.onClick()
                            onClose()
                        }
                    }}
                >
                    {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                    <span>{item.label}</span>
                </div>
            ))}
        </div>
    )
}
