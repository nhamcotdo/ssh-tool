import { useState } from 'react'
import { Save, Upload, Key, X, Info } from 'lucide-react'

interface DataManagementModalProps {
  onClose: () => void
  onExport: (password?: string) => Promise<boolean>
  onImport: (password?: string) => Promise<boolean>
}

export default function DataManagementModal({ onClose, onExport, onImport }: DataManagementModalProps) {
  const [mode, setMode] = useState<'select' | 'export' | 'import'>('select')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleAction = async () => {
    try {
      setLoading(true)
      setError(null)
      let ok = false
      if (mode === 'export') {
        ok = await onExport(password || undefined)
      } else {
        ok = await onImport(password || undefined)
      }
      if (ok) {
        setSuccess(`Data successfully ${mode === 'export' ? 'exported' : 'imported'}.`)
        setTimeout(onClose, 2000)
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 450 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Data Management</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {mode === 'select' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
              Export your connections and settings for backup, or import from an existing backup file.
            </p>
            <button 
              className="btn" 
              style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', padding: 16 }}
              onClick={() => setMode('export')}
            >
              <Save size={18} /> Export Data
            </button>
            <button 
              className="btn" 
              style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', padding: 16 }}
              onClick={() => setMode('import')}
            >
              <Upload size={18} /> Import Data
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             <p style={{ color: 'var(--text-muted)' }}>
              {mode === 'export' 
                ? 'Optionally provide a password to encrypt your backup (AES-256).'
                : 'Enter the password if the backup file was encrypted.'}
            </p>

            <div className="form-group">
              <label>Password (Optional)</label>
              <div style={{ position: 'relative' }}>
                <Key size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="input-field" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Leave empty for no encryption"
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>

            {error && <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 4, fontSize: 13 }}>{error}</div>}
            {success && <div style={{ padding: 10, background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderRadius: 4, fontSize: 13 }}>{success}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button 
                className="btn" 
                onClick={() => { setMode('select'); setPassword(''); setError(null); }}
                disabled={loading}
              >
                Back
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAction}
                disabled={loading}
              >
                {loading ? 'Processing...' : mode === 'export' ? 'Export' : 'Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
