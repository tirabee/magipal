import { useState } from 'react'
import type { Palette } from './storage'

interface BulkImportModalProps {
  palettes: Palette[]
  currentPaletteId: string | null
  onImport: (colors: string[], destination: string, newName?: string) => void
  onClose: () => void
}

function parseHexInput(raw: string): { valid: string[], invalid: string[] } {
  const lines = raw
    .split(/[\n,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)

  const valid: string[] = []
  const invalid: string[] = []

  for (const line of lines) {
    const hex = line.startsWith('#') ? line : `#${line}`
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      valid.push(hex.toLowerCase())
    } else if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      // Expand shorthand #fff -> #ffffff
      const expanded = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      valid.push(expanded.toLowerCase())
    } else {
      invalid.push(line)
    }
  }

  return { valid: [...new Set(valid)], invalid }
}

export function BulkImportModal({
  palettes,
  currentPaletteId,
  onImport,
  onClose,
}: BulkImportModalProps) {
  const [raw, setRaw] = useState('')
  const [destination, setDestination] = useState(currentPaletteId ?? 'new')
  const [newName, setNewName] = useState('Bulk Import')

  const { valid, invalid } = parseHexInput(raw)

  const handleImport = () => {
    if (valid.length === 0) return
    onImport(valid, destination, destination === 'new' ? newName : undefined)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bulk-import-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">Bulk Import Hex</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tab-content">
          <div className="tab-description">
            Paste hex codes separated by newlines, commas, or spaces.
            Both #fff and #ffffff formats are supported.
          </div>

          <textarea
            className="bulk-textarea"
            placeholder={`#ff0000\n#00ff00\n#0000ff`}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            rows={8}
            spellCheck={false}
          />

          {/* Preview */}
          {valid.length > 0 && (
            <div className="color-strip">
              <div className="color-strip-label">
                {valid.length} valid color{valid.length !== 1 ? 's' : ''}
                {invalid.length > 0 && ` · ${invalid.length} skipped`}
              </div>
              <div className="color-strip-swatches">
                {valid.map((c, i) => (
                  <div
                    key={i}
                    className="color-strip-swatch"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}

          {invalid.length > 0 && valid.length === 0 && (
            <div className="tab-description" style={{ color: 'var(--accent)' }}>
              No valid hex codes found yet.
            </div>
          )}

          {/* Destination */}
          <div className="destination-picker">
            <div className="destination-label">Add colors to:</div>
            <div className="destination-options">
              <label className="destination-option">
                <input
                  type="radio"
                  name="bulk-dest"
                  value="new"
                  checked={destination === 'new'}
                  onChange={() => setDestination('new')}
                />
                <span>New palette</span>
              </label>
              {currentPaletteId && (
                <label className="destination-option">
                  <input
                    type="radio"
                    name="bulk-dest"
                    value={currentPaletteId}
                    checked={destination === currentPaletteId}
                    onChange={() => setDestination(currentPaletteId)}
                  />
                  <span>Current palette</span>
                </label>
              )}
              {palettes
                .filter(p => p.id !== currentPaletteId)
                .map(p => (
                  <label key={p.id} className="destination-option">
                    <input
                      type="radio"
                      name="bulk-dest"
                      value={p.id}
                      checked={destination === p.id}
                      onChange={() => setDestination(p.id)}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
            </div>
          </div>

          {destination === 'new' && (
            <input
              className="text-input"
              placeholder="New palette name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          )}

          <div className="picker-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-accent"
              onClick={handleImport}
              disabled={valid.length === 0}
            >
              Import {valid.length} color{valid.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}