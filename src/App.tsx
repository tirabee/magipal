import { useState, useEffect } from 'react'
import { loadPalettes, savePalette, deletePalette, saveFolder, deleteFolder, newPalette } from './storage'
import type { Palette, AppData } from './storage'
import { Sidebar } from './Sidebar'
import { ImportPngModal } from './ImportPngModal'
import './App.css'

// ── App ──────────────────────────────────────────────────────────

function App() {
  const [data, setData] = useState<AppData>({ palettes: [], folders: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showImportPng, setShowImportPng] = useState(false)

  const selectedPalette = data.palettes.find(p => p.id === selectedId) ?? null

  // Load from disk on startup
  useEffect(() => {
    loadPalettes()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const handleNewPalette = async () => {
    const name = prompt('Palette name:')
    if (!name?.trim()) return
    const palette = newPalette(name.trim())
    await savePalette(palette)
    const updated = await loadPalettes()
    setData(updated)
    setSelectedId(palette.id)
  }

  const handleDeletePalette = async (id: string) => {
    if (!confirm('Delete this palette?')) return
    await deletePalette(id)
    const updated = await loadPalettes()
    setData(updated)
    if (selectedId === id) setSelectedId(null)
  }

  const handleNewFolder = async () => {
    const name = prompt('Folder name:')
    if (!name?.trim()) return
    await saveFolder(name.trim())
    const updated = await loadPalettes()
    setData(updated)
  }

  const handleDeleteFolder = async (name: string) => {
    if (!confirm(`Delete folder "${name}"? Palettes inside will be unfoldered.`)) return
    await deleteFolder(name)
    const updated = await loadPalettes()
    setData(updated)
  }

  const handlePaletteUpdated = async () => {
    const updated = await loadPalettes()
    setData(updated)
  }

  const handleImportPng = async (
  colors: string[],
  destination: 'new' | string,
  newName?: string
) => {
  if (destination === 'new') {
    const palette = newPalette(newName ?? 'Imported Palette')
    palette.colors = colors.map(hex => ({ hex }))
    await savePalette(palette)
    const updated = await loadPalettes()
    setData(updated)
    setSelectedId(palette.id)
  } else {
    const target = data.palettes.find(p => p.id === destination)
    if (!target) return
    const updated = {
      ...target,
      colors: [...target.colors, ...colors.map(hex => ({ hex }))]
    }
    await savePalette(updated)
    const refreshed = await loadPalettes()
    setData(refreshed)
  }
  setShowImportPng(false)
}

  if (loading) {
    return (
      <div className="app">
        <div className="titlebar">
          <span className="titlebar-name">Magipal</span>
        </div>
        <div className="empty-state" style={{ gridColumn: '1/-1' }}>
          <div className="empty-state-text">loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">

      {/* Title Bar */}
      <div className="titlebar">
        <span className="titlebar-name">Magipal</span>
        <span className="titlebar-sep">—</span>
        <span className="titlebar-file">
          {selectedPalette ? selectedPalette.name : 'no palette selected'}
        </span>
      </div>

     {/* Sidebar */}
<Sidebar
  palettes={data.palettes}
  folders={data.folders}
  selectedId={selectedId}
  onSelect={setSelectedId}
  onDelete={handleDeletePalette}
  onDeleteFolder={handleDeleteFolder}
  onNewPalette={handleNewPalette}
  onNewFolder={handleNewFolder}
  onUpdated={handlePaletteUpdated}
/>

      {/* Main Area */}
      <div className="main">
        <div className="main-toolbar">
          <button className="btn" onClick={() => setShowImportPng(true)}>Import PNG</button>
          <button className="btn">Import URL</button>
          <button className="btn">✨ AI Generate</button>
        </div>
        <div className="main-content">
          {selectedPalette ? (
            <PaletteView
              palette={selectedPalette}
              onUpdated={handlePaletteUpdated}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🎨</div>
              <div className="empty-state-text">select a palette or create a new one</div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="statusbar">
        <span className="statusbar-item">magipal v0.1.0</span>
        <span className="statusbar-item">{data.palettes.length} palettes</span>
        {selectedPalette && (
          <span className="statusbar-item">{selectedPalette.colors.length} colors</span>
        )}
      </div>
{showImportPng && (
  <ImportPngModal
    palettes={data.palettes}
    currentPaletteId={selectedId}
    onImport={handleImportPng}
    onClose={() => setShowImportPng(false)}
  />
)}
    </div>
  )
}

// ── Palette Item (sidebar) ────────────────────────────────────────

function PaletteItem({ palette, selected, onSelect, onDelete, indented }: {
  palette: Palette
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  indented?: boolean
}) {
  return (
    <div
      className={`palette-item ${selected ? 'active' : ''} ${indented ? 'indented' : ''}`}
      onClick={onSelect}
    >
      <div className="palette-item-swatches">
        {palette.colors.slice(0, 5).map((c, i) => (
          <div
            key={i}
            className="palette-item-swatch"
            style={{ background: c.hex }}
          />
        ))}
        {palette.colors.length === 0 && (
          <div className="palette-item-swatch" style={{ background: 'transparent' }} />
        )}
      </div>
      <span className="palette-item-name">{palette.name}</span>
      <button
        className="palette-delete"
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete palette"
      >×</button>
    </div>
  )
}

// ── Palette View (main area) ──────────────────────────────────────

function PaletteView({ palette, onUpdated }: {
  palette: Palette
  onUpdated: () => void
}) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null)

  const handleCopy = (hex: string) => {
    navigator.clipboard.writeText(hex)
    setCopiedHex(hex)
    setTimeout(() => setCopiedHex(null), 1500)
  }

  const handleAddColor = async () => {
    const hex = prompt('Enter hex color (e.g. #ff0000):')
    if (!hex?.trim()) return
    const cleaned = hex.trim().startsWith('#') ? hex.trim() : `#${hex.trim()}`
    const updated = {
      ...palette,
      colors: [...palette.colors, { hex: cleaned }]
    }
    await savePalette(updated)
    onUpdated()
  }

  const handleRemoveColor = async (index: number) => {
    const updated = {
      ...palette,
      colors: palette.colors.filter((_, i) => i !== index)
    }
    await savePalette(updated)
    onUpdated()
  }

  return (
    <div className="palette-view">
      <div className="palette-view-header">
        <div className="palette-view-name">{palette.name}</div>
        <button className="btn btn-accent" onClick={handleAddColor}>+ Add Color</button>
      </div>
      <div className="palette-swatches">
        {palette.colors.map((color, i) => (
          <div key={i} className="swatch-card">
            <div
              className="swatch-color"
              style={{ background: color.hex }}
              onClick={() => handleCopy(color.hex)}
              title="Click to copy"
            />
            <div className="swatch-hex">
              {copiedHex === color.hex ? 'copied!' : color.hex}
            </div>
            <button
              className="swatch-remove"
              onClick={() => handleRemoveColor(i)}
              title="Remove color"
            >×</button>
          </div>
        ))}
        {palette.colors.length === 0 && (
          <div className="empty-state" style={{ height: 'auto', paddingTop: 40 }}>
            <div className="empty-state-text">no colors yet — add one above</div>
          </div>
        )}
      </div>
      
    </div>
  )
}

export default App