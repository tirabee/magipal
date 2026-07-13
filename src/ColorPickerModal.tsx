import { useState, useRef, useEffect, useCallback } from 'react'
import { addRecentColor, getRecentColors } from './storage'

// ── Color Math ────────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = h / 360
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let r = 0, g = 0, b = 0
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0, s = max === 0 ? 0 : d / max, v = max
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), s, v]
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function isValidHex(hex: string): boolean {
  return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)
}

// ── SV Square ────────────────────────────────────────────────────

function SVSquare({ hue, saturation, value, onChange }: {
  hue: number
  saturation: number
  value: number
  onChange: (s: number, v: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width, h = canvas.height

    // White to hue gradient (left to right)
    const gradH = ctx.createLinearGradient(0, 0, w, 0)
    gradH.addColorStop(0, 'white')
    gradH.addColorStop(1, `hsl(${hue}, 100%, 50%)`)
    ctx.fillStyle = gradH
    ctx.fillRect(0, 0, w, h)

    // Transparent to black gradient (top to bottom)
    const gradV = ctx.createLinearGradient(0, 0, 0, h)
    gradV.addColorStop(0, 'rgba(0,0,0,0)')
    gradV.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = gradV
    ctx.fillRect(0, 0, w, h)

    // Cursor
    const cx = saturation * w
    const cy = (1 - value) * h
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [hue, saturation, value])

  useEffect(() => { draw() }, [draw])

  const handleInteract = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    onChange(s, v)
  }

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={200}
      style={{ cursor: 'crosshair', display: 'block', width: '100%' }}
      onMouseDown={e => { dragging.current = true; handleInteract(e) }}
      onMouseMove={e => { if (dragging.current) handleInteract(e) }}
      onMouseUp={() => { dragging.current = false }}
      onMouseLeave={() => { dragging.current = false }}
    />
  )
}

// ── Hue Slider ────────────────────────────────────────────────────

function HueSlider({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0)
    for (let i = 0; i <= 360; i += 30) {
      grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`)
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Cursor
    const x = (hue / 360) * canvas.width
    ctx.fillStyle = 'white'
    ctx.fillRect(x - 2, 0, 4, canvas.height)
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.strokeRect(x - 2, 0, 4, canvas.height)
  }, [hue])

  const handleInteract = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const h = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360))
    onChange(Math.round(h))
  }

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={16}
      style={{ cursor: 'crosshair', display: 'block', width: '100%', borderRadius: 0 }}
      onMouseDown={e => { dragging.current = true; handleInteract(e) }}
      onMouseMove={e => { if (dragging.current) handleInteract(e) }}
      onMouseUp={() => { dragging.current = false }}
      onMouseLeave={() => { dragging.current = false }}
    />
  )
}

// ── Main Modal ────────────────────────────────────────────────────

interface ColorPickerModalProps {
  initialColor?: string
  onConfirm: (hex: string) => void
  onClose: () => void
  mode?: 'add' | 'edit'
}

export function ColorPickerModal({ initialColor = '#ff0000', onConfirm, onClose, mode = 'add' }: ColorPickerModalProps) {
  const initHsv = rgbToHsv(...hexToRgb(initialColor))

  const [hue, setHue] = useState(initHsv[0])
  const [sat, setSat] = useState(initHsv[1])
  const [val, setVal] = useState(initHsv[2])
  const [hexInput, setHexInput] = useState(initialColor)
  const [recentColors, setRecentColors] = useState<string[]>([])

  const currentRgb = hsvToRgb(hue, sat, val)
  const currentHex = rgbToHex(...currentRgb)

  useEffect(() => {
    getRecentColors().then(setRecentColors)
  }, [])

  useEffect(() => {
    setHexInput(currentHex)
  }, [currentHex])

  const handleHexInput = (raw: string) => {
    setHexInput(raw)
    const hex = raw.startsWith('#') ? raw : `#${raw}`
    if (isValidHex(hex)) {
      const [r, g, b] = hexToRgb(hex)
      const [h, s, v] = rgbToHsv(r, g, b)
      setHue(h); setSat(s); setVal(v)
    }
  }

  const handleRgbInput = (channel: 'r' | 'g' | 'b', raw: string) => {
    const n = Math.max(0, Math.min(255, parseInt(raw) || 0))
    const [r, g, b] = currentRgb
    const newRgb: [number, number, number] =
      channel === 'r' ? [n, g, b] :
      channel === 'g' ? [r, n, b] : [r, g, n]
    const [h, s, v] = rgbToHsv(...newRgb)
    setHue(h); setSat(s); setVal(v)
  }

  const handleConfirm = async () => {
    await addRecentColor(currentHex)
    onConfirm(currentHex)
  }

  const handleRecentClick = (hex: string) => {
    const [h, s, v] = rgbToHsv(...hexToRgb(hex))
    setHue(h); setSat(s); setVal(v)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal color-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-titlebar">
<span className="modal-title">{mode === 'edit' ? 'Edit Color' : 'Color Picker'}</span>          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="picker-body">
          {/* SV Square */}
          <div className="picker-canvas-wrap">
            <SVSquare
              hue={hue}
              saturation={sat}
              value={val}
              onChange={(s, v) => { setSat(s); setVal(v) }}
            />
          </div>

          {/* Hue Slider */}
          <div className="picker-row">
            <HueSlider hue={hue} onChange={setHue} />
          </div>

          {/* Preview + Hex */}
          <div className="picker-row picker-preview-row">
            <div
              className="picker-preview"
              style={{ background: currentHex }}
            />
            <div className="picker-hex-wrap">
              <span className="picker-label">#</span>
              <input
                className="picker-hex-input"
                value={hexInput.replace('#', '')}
                onChange={e => handleHexInput(e.target.value)}
                maxLength={6}
                spellCheck={false}
              />
            </div>
          </div>

          {/* RGB Inputs */}
          <div className="picker-row picker-rgb-row">
            {(['r', 'g', 'b'] as const).map((ch, i) => (
              <label key={ch} className="picker-rgb-field">
                <span className="picker-label">{ch.toUpperCase()}</span>
                <input
                  className="picker-rgb-input"
                  type="number"
                  min={0} max={255}
                  value={currentRgb[i]}
                  onChange={e => handleRgbInput(ch, e.target.value)}
                />
              </label>
            ))}
          </div>

          {/* Recent Colors */}
          {recentColors.length > 0 && (
            <div className="picker-recent">
              <div className="picker-recent-label">Recent</div>
              <div className="picker-recent-swatches">
                {recentColors.map((c, i) => (
                  <div
                    key={i}
                    className="picker-recent-swatch"
                    style={{ background: c }}
                    title={c}
                    onClick={() => handleRecentClick(c)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="picker-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
           <button className="btn btn-accent" onClick={handleConfirm}>
  {mode === 'edit' ? 'Update Color' : 'Add Color'}
</button>
          </div>
        </div>
      </div>
    </div>
  )
}