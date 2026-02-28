// ============================================================
// Auth Screen — Login / Register
// ============================================================

import { useState } from 'react'
import { Terminal, User, Lock, LogIn, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react'
import type { UserAccount } from '../types'

interface AuthScreenProps {
    onAuth: (user: UserAccount) => void
}

export default function AuthScreen({ onAuth }: AuthScreenProps) {
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (!username.trim() || !password) {
            setError('Please fill in all fields')
            return
        }

        if (mode === 'register' && password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setLoading(true)
        try {
            const result = mode === 'login'
                ? await window.sshTool.login(username.trim(), password)
                : await window.sshTool.register(username.trim(), password)

            if (result.success && result.user) {
                onAuth(result.user)
            } else {
                setError(result.message || 'Authentication failed')
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    function switchMode() {
        setMode(mode === 'login' ? 'register' : 'login')
        setError('')
        setConfirmPassword('')
    }

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
        }}>
            <div className="titlebar-drag" style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: 40,
            }} />

            <div style={{
                width: 380,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '32px 32px 24px',
                    textAlign: 'center',
                }}>
                    <div style={{
                        width: 56, height: 56,
                        borderRadius: 'var(--radius-lg)',
                        background: 'rgba(59, 130, 246, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                    }}>
                        <Terminal size={28} style={{ color: 'var(--accent-blue)' }} />
                    </div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>SSH Tool</h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '0 32px 32px' }}>
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', marginBottom: 16,
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: 'var(--accent-red)',
                            fontSize: 12,
                        }}>
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <div style={{ position: 'relative' }}>
                            <User size={14} style={{
                                position: 'absolute', left: 12, top: '50%',
                                transform: 'translateY(-50%)', color: 'var(--text-muted)',
                            }} />
                            <input
                                className="form-input"
                                style={{ paddingLeft: 36 }}
                                placeholder="Enter username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={14} style={{
                                position: 'absolute', left: 12, top: '50%',
                                transform: 'translateY(-50%)', color: 'var(--text-muted)',
                            }} />
                            <input
                                className="form-input"
                                style={{ paddingLeft: 36, paddingRight: 40 }}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: 4, top: '50%',
                                    transform: 'translateY(-50%)', background: 'none',
                                    border: 'none', color: 'var(--text-muted)',
                                    cursor: 'pointer', padding: 8,
                                }}
                            >
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    {mode === 'register' && (
                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={14} style={{
                                    position: 'absolute', left: 12, top: '50%',
                                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                                }} />
                                <input
                                    className="form-input"
                                    style={{ paddingLeft: 36 }}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={loading}
                        style={{ width: '100%', height: 40, marginTop: 4 }}
                    >
                        {loading ? (
                            <span className="spin" style={{ display: 'inline-block' }}>⏳</span>
                        ) : mode === 'login' ? (
                            <><LogIn size={16} /> Sign In</>
                        ) : (
                            <><UserPlus size={16} /> Create Account</>
                        )}
                    </button>

                    <div style={{
                        textAlign: 'center', marginTop: 16,
                        fontSize: 12, color: 'var(--text-muted)',
                    }}>
                        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                        {' '}
                        <span
                            onClick={switchMode}
                            style={{
                                color: 'var(--accent-blue)',
                                cursor: 'pointer',
                                fontWeight: 500,
                            }}
                        >
                            {mode === 'login' ? 'Register' : 'Sign In'}
                        </span>
                    </div>
                </form>
            </div>
        </div>
    )
}
