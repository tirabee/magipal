import { useState, useMemo } from 'react'
import type { Palette } from './storage'
import { DestinationPicker } from './DestinationPicker'
import { hexToHsl, hslToHex } from './color'

interface RampModalProps {
  baseColor: string
  palettes: Palette[]
  currentPaletteId: string | null
  onImport: (colors: string[], destination: string, newName?: string) => void
  onClose: () => void
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

          <DestinationPicker
            name="ramp-dest"
            label="Add ramp to:"
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
              Add {ramp.length} colors
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}