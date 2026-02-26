// ============================================================
// Input Dialog — replaces prompt() for Electron
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface InputDialogProps {
    title: string
    placeholder?: string
    defaultValue?: string
    onSubmit: (value: string) => void
    onCancel: () => void
}

export default function InputDialog({ title, placeholder, defaultValue, onSubmit, onCancel }: InputDialogProps) {
    const [value, setValue] = useState(defaultValue || '')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        // Auto-focus and select all text
        setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
        }, 50)
    }, [])

    function handleSubmit() {
        const trimmed = value.trim()
        if (trimmed) onSubmit(trimmed)
    }

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="icon-btn" onClick={onCancel}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <input
                        ref={inputRef}
                        className="form-input"
                        placeholder={placeholder || 'Enter name...'}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSubmit()
                            if (e.key === 'Escape') onCancel()
                        }}
                    />
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={!value.trim()}>
                        OK
                    </button>
                </div>
            </div>
        </div>
    )
}
