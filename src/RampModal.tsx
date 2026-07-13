import { useState, useMemo } from 'react'
import type { Palette } from './storage'

interface RampModalProps {
  baseColor: string
  palettes: Palette[]
  currentPaletteId: string | null
  onImport: (colors: string[], destination: string, newName?: string) => void
  onClose: () => void
}

// ── Color math ──────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let hue = 0, sat = 0
  if (max !== min) {
    const d = max - min
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: hue = ((b - r) / d + 2) / 6; break
      case b: hue = ((r - g) / d + 4) / 6; break
    }
  }
  return [hue * 360, sat * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100
  const hh = h / 360

  if (s === 0) {
    const v = Math.round(l * 255)
    const hex = v.toString(16).padStart(2, '0')
    return `#${hex}${hex}${hex}`
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hue2rgb(p, q, hh + 1 / 3)
  const g = hue2rgb(p, q, hh)
  const b = hue2rgb(p, q, hh - 1 / 3)

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Blends hue toward a target along the shortest path around the color wheel
function lerpHue(from: number, to: number, t: number): number {
  const diff = ((to - from + 540) % 360) - 180
  return (from + diff * t + 360) % 360
}

interface RampOptions {
  shadowSteps: number
  highlightSteps: number
  hueShift: boolean
  hueShiftStrength: number // 0–1
}

function generateRamp(baseHex: string, opts: RampOptions): string[] {
  const [h, s, l] = hexToHsl(baseHex)

  const makeColor = (t: number, kind: 'shadow' | 'highlight'): string => {
    const lTarget = kind === 'shadow' ? 6 : 94
    const newL = l + (lTarget - l) * t
    const satShift = kind === 'shadow' ? 12 : -12
    const newS = Math.max(0, Math.min(100, s + satShift * t))
    const hueTarget = kind === 'shadow' ? 250 : 45 // blue-violet / warm yellow
    const newH = opts.hueShift ? lerpHue(h, hueTarget, t * opts.hueShiftStrength) : h
    return hslToHex(newH, newS, newL)
  }

  const shadows: string[] = []
  for (let i = opts.shadowSteps; i >= 1; i--) {
    shadows.push(makeColor(i / opts.shadowSteps, 'shadow'))
  }

  const highlights: string[] = []
  for (let i = 1; i <= opts.highlightSteps; i++) {
    highlights.push(makeColor(i / opts.highlightSteps, 'highlight'))
  }

  return [...shadows, baseHex, ...highlights]
}

// ── Modal ─────────────────────────────────────────────────────────

export function RampModal({ baseColor, palettes, currentPaletteId, onImport, onClose }: RampModalProps) {
  const [shadowSteps, setShadowSteps] = useState(2)
  const [highlightSteps, setHighlightSteps] = useState(2)
  const [hueShift, setHueShift] = useState(true)
  const [hueShiftStrength, setHueShiftStrength] = useState(0.35)
  const [destination, setDestination] = useState(currentPaletteId ?? 'new')
  const [newName, setNewName] = useState('Shade Ramp')

  const ramp = useMemo(
    () => generateRamp(baseColor, { shadowSteps, highlightSteps, hueShift, hueShiftStrength }),
    [baseColor, shadowSteps, highlightSteps, hueShift, hueShiftStrength]
  )

  const baseIndex = shadowSteps

  const handleImport = () => {
    onImport(ramp, destination, destination === 'new' ? newName : undefined)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ramp-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">Shade & Highlight Ramp</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="tab-content">
          <div className="tab-description">
            Generates a ramp of shadows and highlights from your base color.
            Hue shifting nudges shadows cooler and highlights warmer — a classic
            pixel art technique that reads more naturally than a flat darken/lighten.
          </div>

          <div className="ramp-preview">
            {ramp.map((hex, i) => (
              <div
                key={i}
                className={`ramp-swatch ${i === baseIndex ? 'ramp-swatch-base' : ''}`}
                style={{ background: hex }}
                title={i === baseIndex ? `${hex} (base)` : hex}
              />
            ))}
          </div>

          <div className="ramp-controls">
            <label className="ramp-control">
              <span>Shadow steps</span>
              <input
                type="range"
                min={0} max={5}
                value={shadowSteps}
                onChange={e => setShadowSteps(Number(e.target.value))}
              />
              <span className="ramp-control-value">{shadowSteps}</span>
            </label>

            <label className="ramp-control">
              <span>Highlight steps</span>
              <input
                type="range"
                min={0} max={5}
                value={highlightSteps}
                onChange={e => setHighlightSteps(Number(e.target.value))}
              />
              <span className="ramp-control-value">{highlightSteps}</span>
            </label>

            <label className="ramp-checkbox">
              <input
                type="checkbox"
                checked={hueShift}
                onChange={e => setHueShift(e.target.checked)}
              />
              <span>Hue shift (shadows cooler, highlights warmer)</span>
            </label>

            {hueShift && (
              <label className="ramp-control">
                <span>Shift strength</span>
                <input
                  type="range"
                  min={0} max={100}
                  value={hueShiftStrength * 100}
                  onChange={e => setHueShiftStrength(Number(e.target.value) / 100)}
                />
                <span className="ramp-control-value">{Math.round(hueShiftStrength * 100)}%</span>
              </label>
            )}
          </div>

          <div className="destination-picker">
            <div className="destination-label">Add ramp to:</div>
            <div className="destination-options">
              <label className="destination-option">
                <input
                  type="radio"
                  name="ramp-dest"
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
                    name="ramp-dest"
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
                      name="ramp-dest"
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
            <button className="btn btn-accent" onClick={handleImport}>
              Add {ramp.length} colors
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}