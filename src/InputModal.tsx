import { useState } from 'react'

interface InputModalProps {
  title: string
  label: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function InputModal({
  title,
  label,
  placeholder,
  defaultValue = '',
  confirmLabel = 'OK',
  onConfirm,
  onCancel,
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue)

  const handleConfirm = () => {
    if (value.trim()) onConfirm(value.trim())
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="confirm-body">
          <div className="input-modal-field">
            <label className="input-modal-label">{label}</label>
            <input
              className="text-input"
              value={value}
              placeholder={placeholder}
              autoFocus
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirm()
                if (e.key === 'Escape') onCancel()
              }}
            />
          </div>
          <div className="confirm-actions">
            <button className="btn" onClick={onCancel}>Cancel</button>
            <button
              className="btn btn-accent"
              onClick={handleConfirm}
              disabled={!value.trim()}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}