import { useState, useRef, useEffect } from 'react'
import type { Color } from './storage'
import { hexToRgb } from './color'


// 4x4 Bayer ordered-dither matrix — gives that classic chunky pixel-art
// dither look rather than random noise.
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

function DitherStrip({ colorA, colorB, steps = 6, cellSize = 16, zoom = 6 }: {
  colorA: string
  colorB: string
  steps?: number
  cellSize?: number
  zoom?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = steps * cellSize
    canvas.height = cellSize

    const [ar, ag, ab] = hexToRgb(colorA)
    const [br, bg, bb] = hexToRgb(colorB)

    for (let step = 0; step < steps; step++) {
      const ratio = step / (steps - 1) // 0 = pure A, 1 = pure B
      for (let y = 0; y < cellSize; y++) {
        for (let x = 0; x < cellSize; x++) {
          const threshold = (BAYER_4X4[y % 4][x % 4] + 0.5) / 16
          const useB = ratio >= threshold
          const [r, g, b] = useB ? [br, bg, bb] : [ar, ag, ab]
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.fillRect(step * cellSize + x, y, 1, 1)
        }
      }
    }
  }, [colorA, colorB, steps, cellSize])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: steps * cellSize * zoom,
        height: cellSize * zoom,
        imageRendering: 'pixelated',
        border: '1px solid var(--border)',
      }}
    />
  )
}

export function DitherTestPanel({ colors }: { colors: Color[] }) {
  const [zoom, setZoom] = useState(6)

  if (colors.length < 2) {
    return (
      <div className="empty-state" style={{ height: 'auto', paddingTop: 40 }}>
        <div className="empty-state-text">Add at least 2 colors to see dither tests</div>
      </div>
    )
  }

  const pairs = colors.slice(0, -1).map((c, i) => [c, colors[i + 1]] as const)

  return (
    <div className="dither-test-panel">
      <div className="dither-test-header">
        <div className="tab-description">
          Ordered dither blends between each adjacent pair of colors in the current
          display order — sort by lightness for the most useful reading.
        </div>
        <select
          className="sort-select"
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          title="Preview scale"
        >
          <option value={1}>1x — true size</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={6}>6x — inspect</option>
          <option value={8}>8x</option>
        </select>
      </div>
      {pairs.map(([a, b], i) => (
        <div key={i} className="dither-row">
          <span className="dither-row-label">{a.hex}</span>
          <DitherStrip colorA={a.hex} colorB={b.hex} zoom={zoom} />
          <span className="dither-row-label">{b.hex}</span>
        </div>
      ))}
    </div>
  )
}