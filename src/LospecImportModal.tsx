import { useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { fetchLospecPalette } from './storage'
import type { Palette, LospecPalette } from './storage'

interface LospecImportModalProps {
  palettes: Palette[]
  currentPaletteId: string | null
  onImport: (palette: LospecPalette, destination: string) => void
  onClose: () => void
  initialSlug?: string
}

function extractSlug(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/lospec\.com\/palette-list\/([a-z0-9-]+)/i)
  if (match) return match[1]
  return trimmed.toLowerCase().replace(/\s+/g, '-')
}

export function LospecImportModal({
  palettes,
  currentPaletteId,
  onImport,
  onClose,
  initialSlug,
}: LospecImportModalProps) {
  const [input, setInput] = useState(initialSlug ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LospecPalette | null>(null)
  const [destination, setDestination] = useState(currentPaletteId ?? 'new')

  const handleFetch = async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const slug = extractSlug(input)
      const palette = await fetchLospecPalette(slug)
      setResult(palette)
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Could not find that palette on Lospec.')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    if (!result) return
    onImport(result, destination)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal lospec-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">Import from Lospec</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="tab-content">
          <div className="tab-description">
            Enter a palette's Lospec slug (the part after /palette-list/ in its URL)
            or paste the full link. Don't know the name yet?{' '}
            <span
              className="lospec-browse-link"
              onClick={() => openUrl('https://lospec.com/palette-list')}
            >
              Browse the Lospec Palette List ↗
            </span>
          </div>

          <div className="lospec-search-row">
            <input
              className="text-input"
              placeholder="e.g. nintendo-gameboy-bgb"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
              spellCheck={false}
              autoFocus
            />
            <button
              className="btn btn-accent"
              onClick={handleFetch}
              disabled={loading || !input.trim()}
            >
              {loading ? 'Fetching…' : 'Fetch'}
            </button>
          </div>

          {error && <div className="lospec-error">{error}</div>}

          {result && (
            <>
              <div className="lospec-preview">
                <div className="lospec-preview-header">
                  <span className="lospec-preview-name">{result.name}</span>
                  <span className="lospec-preview-author">by {result.author}</span>
                </div>
                <div className="color-strip-swatches">
                  {result.colors.map((hex, i) => (
                    <div
                      key={i}
                      className="color-strip-swatch"
                      style={{ background: `#${hex}` }}
                      title={`#${hex}`}
                    />
                  ))}
                </div>
                <div className="tab-description">{result.colors.length} colors</div>
              </div>

              <div className="destination-picker">
                <div className="destination-label">Add to:</div>
                <div className="destination-options">
                  <label className="destination-option">
                    <input
                      type="radio"
                      name="lospec-dest"
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
                        name="lospec-dest"
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
                          name="lospec-dest"
                          value={p.id}
                          checked={destination === p.id}
                          onChange={() => setDestination(p.id)}
                        />
                        <span>{p.name}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="picker-actions">
                <button className="btn" onClick={onClose}>Cancel</button>
                <button className="btn btn-accent" onClick={handleImport}>
                  Import {result.colors.length} colors
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}