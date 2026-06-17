import { useState, useRef, useEffect, useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import type { Palette } from './storage'
import { readFile } from '@tauri-apps/plugin-fs'



async function fileToDataUrl(path: string): Promise<string> {
  const bytes = await readFile(path)
  const blob = new Blob([bytes], { type: 'image/png' })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}


// ── Types ────────────────────────────────────────────────────────

interface ImportPngModalProps {
  palettes: Palette[]
  currentPaletteId: string | null
  onImport: (colors: string[], destination: 'new' | string, newName?: string) => void
  onClose: () => void
}

type Tab = 'grid' | 'sample'

// ── Helpers ──────────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function deduplicateColors(colors: string[]): string[] {
  return [...new Set(colors)]
}

function sampleGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  columns: number,
  rows: number
): string[] {
  const colors: string[] = []
  const cellW = width / columns
  const cellH = height / rows
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = Math.floor(col * cellW + cellW / 2)
      const y = Math.floor(row * cellH + cellH / 2)
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
      if (a < 128) continue // skip transparent
      colors.push(rgbToHex(r, g, b))
    }
  }
  return deduplicateColors(colors)
}

// ── Destination Picker ────────────────────────────────────────────

function DestinationPicker({ palettes, currentPaletteId, value, onChange }: {
  palettes: Palette[]
  currentPaletteId: string | null
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="destination-picker">
      <div className="destination-label">Add colors to:</div>
      <div className="destination-options">
        <label className="destination-option">
          <input
            type="radio"
            name="destination"
            value="new"
            checked={value === 'new'}
            onChange={() => onChange('new')}
          />
          <span>New palette</span>
        </label>
        {currentPaletteId && (
          <label className="destination-option">
            <input
              type="radio"
              name="destination"
              value={currentPaletteId}
              checked={value === currentPaletteId}
              onChange={() => onChange(currentPaletteId)}
            />
            <span>Current palette</span>
          </label>
        )}
        {palettes.filter(p => p.id !== currentPaletteId).map(p => (
          <label key={p.id} className="destination-option">
            <input
              type="radio"
              name="destination"
              value={p.id}
              checked={value === p.id}
              onChange={() => onChange(p.id)}
            />
            <span>{p.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Color Preview Strip ───────────────────────────────────────────

function ColorStrip({ colors, onRemove }: {
  colors: string[]
  onRemove: (i: number) => void
}) {
  if (colors.length === 0) return null
  return (
    <div className="color-strip">
      <div className="color-strip-label">{colors.length} color{colors.length !== 1 ? 's' : ''} selected</div>
      <div className="color-strip-swatches">
        {colors.map((c, i) => (
          <div
            key={i}
            className="color-strip-swatch"
            style={{ background: c }}
            title={`${c} — click to remove`}
            onClick={() => onRemove(i)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Grid Tab ──────────────────────────────────────────────────────

function GridTab({ palettes, currentPaletteId, onImport }: {
  palettes: Palette[]
  currentPaletteId: string | null
  onImport: (colors: string[], destination: 'new' | string, newName?: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })
  const [columns, setColumns] = useState(8)
  const [rows, setRows] = useState(4)
  const [colors, setColors] = useState<string[]>([])
  const [destination, setDestination] = useState<string>(currentPaletteId ?? 'new')
  const [newName, setNewName] = useState('Imported Palette')

  const handlePickFile = async () => {
  const path = await open({
    filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
  })
  if (!path) return
  const dataUrl = await fileToDataUrl(path)
  setImageSrc(dataUrl)
}

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImageSize({ w: img.naturalWidth, h: img.naturalHeight })
  }, [])

  const handleSample = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageSrc) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      const sampled = sampleGrid(ctx, img.naturalWidth, img.naturalHeight, columns, rows)
      setColors(sampled)
    }
    img.src = imageSrc
  }, [imageSrc, columns, rows])

  useEffect(() => {
    if (imageSrc) handleSample()
  }, [imageSrc, columns, rows, handleSample])

  const handleRemoveColor = (i: number) => {
    setColors(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleImport = () => {
    if (colors.length === 0) return
    onImport(colors, destination, destination === 'new' ? newName : undefined)
  }

  return (
    <div className="tab-content">
      <div className="tab-description">
        Samples colors from a swatch grid image at regular intervals.
        Works great with Aseprite palette exports and Lospec palettes.
      </div>

      <button className="btn btn-accent" onClick={handlePickFile}>
        Choose Image…
      </button>

      {imageSrc && (
        <>
          <div className="grid-preview">
            <img
              src={imageSrc}
              alt="palette source"
              onLoad={handleImageLoad}
              style={{
                maxWidth: '100%',
                maxHeight: 180,
                imageRendering: 'pixelated',
                border: '1px solid var(--border)',
              }}
            />
            <div className="grid-size-label">
              {imageSize.w} × {imageSize.h}px
            </div>
          </div>

          <div className="grid-controls">
            <label className="grid-control">
              <span>Columns</span>
              <input
                type="number"
                className="number-input"
                min={1} max={64}
                value={columns}
                onChange={e => setColumns(Number(e.target.value))}
              />
            </label>
            <label className="grid-control">
              <span>Rows</span>
              <input
                type="number"
                className="number-input"
                min={1} max={64}
                value={rows}
                onChange={e => setRows(Number(e.target.value))}
              />
            </label>
          </div>

          <ColorStrip colors={colors} onRemove={handleRemoveColor} />

          <DestinationPicker
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

          <button
            className="btn btn-accent"
            onClick={handleImport}
            disabled={colors.length === 0}
          >
            Import {colors.length} color{colors.length !== 1 ? 's' : ''}
          </button>
        </>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}

// ── Sample Tab ────────────────────────────────────────────────────

function SampleTab({ palettes, currentPaletteId, onImport }: {
  palettes: Palette[]
  currentPaletteId: string | null
  onImport: (colors: string[], destination: 'new' | string, newName?: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [colors, setColors] = useState<string[]>([])
  const [hoveredColor, setHoveredColor] = useState<string | null>(null)
  const [destination, setDestination] = useState<string>(currentPaletteId ?? 'new')
  const [newName, setNewName] = useState('Sampled Palette')
  const [loaded, setLoaded] = useState(false)

  const handlePickFile = async () => {
  const path = await open({
    filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
  })
  if (!path) return
  setColors([])
  setLoaded(false)
  const dataUrl = await fileToDataUrl(path)
  setImageSrc(dataUrl)
}

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageSrc) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Scale to fit display area
      const maxW = 480
      const maxH = 280
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
      canvas.width = img.naturalWidth * scale
      canvas.height = img.naturalHeight * scale
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      setLoaded(true)
    }
    img.src = imageSrc
  }, [imageSrc])

  useEffect(() => { drawImage() }, [drawImage])

  const getColorAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
    if (a < 128) return null
    return rgbToHex(r, g, b)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setHoveredColor(getColorAt(e))
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const color = getColorAt(e)
    if (!color) return
    setColors(prev => deduplicateColors([...prev, color]))
  }

  const handleRemoveColor = (i: number) => {
    setColors(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleImport = () => {
    if (colors.length === 0) return
    onImport(colors, destination, destination === 'new' ? newName : undefined)
  }

  return (
    <div className="tab-content">
      <div className="tab-description">
        Click anywhere on the image to sample individual colors.
        Great for reference images and game screenshots.
      </div>

      <button className="btn btn-accent" onClick={handlePickFile}>
        Choose Image…
      </button>

      {imageSrc && (
        <>
          <div className="sample-canvas-wrap">
            <canvas
              ref={canvasRef}
              style={{
                cursor: 'crosshair',
                imageRendering: 'pixelated',
                border: '1px solid var(--border)',
                maxWidth: '100%',
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredColor(null)}
              onClick={handleClick}
            />
            {hoveredColor && (
              <div className="hover-preview">
                <div
                  className="hover-swatch"
                  style={{ background: hoveredColor }}
                />
                <span>{hoveredColor}</span>
              </div>
            )}
          </div>

          {!loaded && <div className="tab-description">Loading image…</div>}

          <ColorStrip colors={colors} onRemove={handleRemoveColor} />

          {colors.length > 0 && (
            <>
              <DestinationPicker
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

              <button
                className="btn btn-accent"
                onClick={handleImport}
                disabled={colors.length === 0}
              >
                Import {colors.length} color{colors.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────

export function ImportPngModal({ palettes, currentPaletteId, onImport, onClose }: ImportPngModalProps) {
  const [tab, setTab] = useState<Tab>('grid')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">Import PNG</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === 'grid' ? 'active' : ''}`}
            onClick={() => setTab('grid')}
          >
            Grid Sample
          </button>
          <button
            className={`modal-tab ${tab === 'sample' ? 'active' : ''}`}
            onClick={() => setTab('sample')}
          >
            Click Sample
          </button>
        </div>

        {tab === 'grid'
          ? <GridTab palettes={palettes} currentPaletteId={currentPaletteId} onImport={onImport} />
          : <SampleTab palettes={palettes} currentPaletteId={currentPaletteId} onImport={onImport} />
        }
      </div>
    </div>
  )
}