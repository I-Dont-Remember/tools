// Lightweight reusable modal — no external dependencies.
// Close on Esc, backdrop click, or × button.
import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
}

export function Modal({ open, onClose, title, children, width = 520 }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '20px 24px',
        maxWidth: width,
        width: '92%',
        maxHeight: '88vh',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 id="modal-title" style={{ margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            title="Close"
            style={{ fontSize: 20, lineHeight: 1, padding: '0 6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
          >×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
