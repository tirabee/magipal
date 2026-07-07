import { useState } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile, writeFile } from '@tauri-apps/plugin-fs'
import { exportPaletteJson, exportPaletteAse } from './storage'
import type { Palette } from './storage'

interface ExportMenuProps {
  palette: Palette
  onClose: () => void
}

// ── Format Helpers ────────────────────────────────────────────────

function toHexList(palette: Palette): string {
  return palette.colors.map(c => c.hex).join('\n')
}

function toCssVars(palette: Palette): string {
  const safeName = palette.name.toLowerCase().replace(/\s+/g, '-')
  const vars = palette.colors
    .map((c, i) => `  --${safeName}-${i + 1}: ${c.hex};`)
    .join('\n')
  return `:root {\n${vars}\n}`
}

function toGpl(palette: Palette): string {
  const lines = ['GIMP Palette', `Name: ${palette.name}`, 'Columns: 8', '#']
  for (const color of palette.colors) {
    const hex = color.hex.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const name = color.name ?? color.hex
    lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${name}`)
  }
  return lines.join('\n')
}

async function toPngSwatch(palette: Palette): Promise<Blob> {
  const SWATCH_SIZE = 64
  const COLS = Math.min(palette.colors.length, 8)
  const ROWS = Math.ceil(palette.colors.length / COLS)
  const canvas = document.createElement('canvas')
  canvas.width = COLS * SWATCH_SIZE
  canvas.height = ROWS * SWATCH_SIZE
  const ctx = canvas.getContext('2d')!

  palette.colors.forEach((color, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    ctx.fillStyle = color.hex
    ctx.fillRect(col * SWATCH_SIZE, row * SWATCH_SIZE, SWATCH_SIZE, SWATCH_SIZE)
  })

  return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'))
}

// ── Export Actions ────────────────────────────────────────────────

async function handleExport(palette: Palette, format: string) {
  const safeName = palette.name.replace(/\s+/g, '_')

  if (format === 'hex') {
    const path = await save({
      defaultPath: `${safeName}.txt`,
      filters: [{ name: 'Text', extensions: ['txt'] }],
    })
    if (!path) return
    await writeTextFile(path, toHexList(palette))
  }

  if (format === 'css') {
    const path = await save({
      defaultPath: `${safeName}.css`,
      filters: [{ name: 'CSS', extensions: ['css'] }],
    })
    if (!path) return
    await writeTextFile(path, toCssVars(palette))
  }

  if (format === 'gpl') {
    const path = await save({
      defaultPath: `${safeName}.gpl`,
      filters: [{ name: 'GIMP Palette', extensions: ['gpl'] }],
    })
    if (!path) return
    await writeTextFile(path, toGpl(palette))
  }

  if (format === 'png') {
    const path = await save({
      defaultPath: `${safeName}_swatches.png`,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    })
    if (!path) return
    const blob = await toPngSwatch(palette)
    const arrayBuffer = await blob.arrayBuffer()
    await writeFile(path, new Uint8Array(arrayBuffer))
  }

  if (format === 'ase') {
    const path = await save({
      defaultPath: `${safeName}.ase`,
      filters: [{ name: 'Adobe Swatch Exchange', extensions: ['ase'] }],
    })
    if (!path) return
    const bytes = await exportPaletteAse(palette.id)
    await writeFile(path, new Uint8Array(bytes))
  }

  if (format === 'json') {
    const path = await save({
      defaultPath: `${safeName}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    const json = await exportPaletteJson(palette.id)
    await writeTextFile(path, json)
  }
}

// ── Menu ─────────────────────────────────────────────────────────

const FORMATS = [
  { id: 'hex',  label: 'Hex List',               ext: '.txt',  desc: 'One hex code per line' },
  { id: 'css',  label: 'CSS Variables',           ext: '.css',  desc: ':root { --color-1: ... }' },
  { id: 'gpl',  label: 'GIMP Palette',            ext: '.gpl',  desc: 'GIMP, Inkscape, Krita, Aseprite' },
  { id: 'png',  label: 'PNG Swatch Sheet',        ext: '.png',  desc: '64px swatches grid' },
  { id: 'ase',  label: 'Adobe Swatch Exchange',   ext: '.ase',  desc: 'Photoshop, Illustrator, Affinity' },
  { id: 'json', label: 'Indexed RGB',             ext: '.json', desc: 'RGB triplet array' },
]

export function ExportMenu({ palette, onClose }: ExportMenuProps) {
  const [exporting, setExporting] = useState<string | null>(null)

  const handleClick = async (formatId: string) => {
    setExporting(formatId)
    try {
      await handleExport(palette, formatId)
    } finally {
      setExporting(null)
      onClose()
    }
  }

  return (
    <>
      <div className="popover-backdrop" onClick={onClose} />
      <div className="export-menu">
        <div className="export-menu-title">Export Palette</div>
        {FORMATS.map(fmt => (
          <button
            key={fmt.id}
            className="export-menu-item"
            onClick={() => handleClick(fmt.id)}
            disabled={exporting !== null}
          >
            <div className="export-menu-item-left">
              <span className="export-menu-label">{fmt.label}</span>
              <span className="export-menu-desc">{fmt.desc}</span>
            </div>
            <span className="export-menu-ext">
              {exporting === fmt.id ? '...' : fmt.ext}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}