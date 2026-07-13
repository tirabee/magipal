import { useState } from 'react'
import type { Palette } from './storage'
import { DestinationPicker } from './DestinationPicker'

interface EyedropperModalProps {
  color: string
  palettes: Palette[]
  currentPaletteId: string | null
  onImport: (color: string, destination: string, newName?: string) => void
  onClose: () => void
}

export function EyedropperModal({
  color,
  palettes,
  currentPaletteId,
  onImport,
  onClose,
}: EyedropperModalProps) {
  const [destination, setDestination] = useState<string>(currentPaletteId ?? 'new')
  const [newName, setNewName] = useState('Picked Colors')

  const handleImport = () => {
    onImport(color, destination, destination === 'new' ? newName : undefined)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal eyedropper-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">Eyedropper</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="tab-content">
          {/* Color preview */}
          <div className="eyedropper-preview-row">
            <div
              className="eyedropper-preview-swatch"
              style={{ background: color }}
            />
            <div className="eyedropper-preview-info">
              <div className="eyedropper-hex">{color}</div>
              <div className="tab-description">picked from screen</div>
            </div>
          </div>

          {/* Destination */}
          <DestinationPicker
            name="dest"
            label="Add color to:"
            palettes={palettes}
            currentPaletteId={currentPaletteId}
            value={destination}
            onChange={setDestination}
          />

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
            <button className="btn btn-accent" onClick={handleImport}>
              Add Color
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}