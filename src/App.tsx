import { useState, useEffect, useRef } from 'react'
import { loadPalettes, savePalette, deletePalette, saveFolder, deleteFolder, newPalette } from './storage'
import type { Palette, AppData } from './storage'
import { Sidebar } from './Sidebar'
import { ImportPngModal } from './ImportPngModal'
import { ColorPickerModal } from './ColorPickerModal'
import { EyedropperModal } from './EyedropperModal'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { exportPaletteJson } from './storage'
import { usePreferences } from './usePreferences'
import { SettingsPopover } from './SettingsPopover'
import './App.css'

// ── App ──────────────────────────────────────────────────────────

function App() {
  const [data, setData] = useState<AppData>({ palettes: [], folders: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showImportPng, setShowImportPng] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [eyedropperColor, setEyedropperColor] = useState<string | null>(null)
  const selectedPalette = data.palettes.find(p => p.id === selectedId) ?? null
  const { theme, setTheme, swatchStyle, setSwatchStyle } = usePreferences()
  const [showSettings, setShowSettings] = useState(false)

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

  const handleAddColor = async (hex: string) => {
  if (!selectedPalette) return
  const updated = {
    ...selectedPalette,
    colors: [...selectedPalette.colors, { hex }]
  }
  await savePalette(updated)
  const refreshed = await loadPalettes()
  setData(refreshed)
  setShowColorPicker(false)
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

const handleEyedropper = async () => {
  try {
    // @ts-ignore — EyeDropper is not in TS types yet
    const eyeDropper = new EyeDropper()
    const result = await eyeDropper.open()
    setEyedropperColor(result.sRGBHex)
  } catch {
    // User cancelled — no action needed
  }
}

const handleEyedropperImport = async (
  color: string,
  destination: string,
  newName?: string
) => {
  if (destination === 'new') {
    const palette = newPalette(newName ?? 'Picked Colors')
    palette.colors = [{ hex: color }]
    await savePalette(palette)
    const updated = await loadPalettes()
    setData(updated)
    setSelectedId(palette.id)
  } else {
    const target = data.palettes.find(p => p.id === destination)
    if (!target) return
    const updated = {
      ...target,
      colors: [...target.colors, { hex: color }]
    }
    await savePalette(updated)
    const refreshed = await loadPalettes()
    setData(refreshed)
  }
  setEyedropperColor(null)
}

const handleExportJson = async () => {
  if (!selectedPalette) return
  const json = await exportPaletteJson(selectedPalette.id)
  const path = await save({
    defaultPath: `${selectedPalette.name.replace(/\s+/g, '_')}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!path) return
  await writeTextFile(path, json)
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
<div className="titlebar" style={{ position: 'relative' }}>
  <span className="titlebar-name">Magipal</span>
  <span className="titlebar-sep">—</span>
  <span className="titlebar-file">
    {selectedPalette ? selectedPalette.name : 'no palette selected'}
  </span>
  <button
    className="settings-btn"
    onClick={() => setShowSettings(s => !s)}
    title="Settings"
  >
    ⚙️
  </button>
  {showSettings && (
    <SettingsPopover
      theme={theme}
      swatchStyle={swatchStyle}
      onThemeChange={t => { setTheme(t); setShowSettings(false) }}
      onSwatchStyleChange={s => { setSwatchStyle(s); setShowSettings(false) }}
      onClose={() => setShowSettings(false)}
    />
  )}
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
          <button className="eyedropper-btn" onClick={handleEyedropper} title="Pick color from screen">🔍</button>
        </div>
        <div className="main-content">
          {selectedPalette ? (
            <PaletteView
              palette={selectedPalette}
              onUpdated={handlePaletteUpdated}
              onAddColor={() => setShowColorPicker(true)}
              onExportJson={handleExportJson}
              swatchStyle={swatchStyle}
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
    {showColorPicker && (
  <ColorPickerModal
    onConfirm={handleAddColor}
    onClose={() => setShowColorPicker(false)}
  />
)}
{eyedropperColor && (
  <EyedropperModal
    color={eyedropperColor}
    palettes={data.palettes}
    currentPaletteId={selectedId}
    onImport={handleEyedropperImport}
    onClose={() => setEyedropperColor(null)}
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

function PaletteView({ palette, onUpdated, onAddColor, onExportJson, swatchStyle }: {
  palette: Palette
  onUpdated: () => void
  onAddColor: () => void
  onExportJson: () => void
  swatchStyle: 'squares' | 'circles' | 'bar'
}) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [segmentWidth, setSegmentWidth] = useState(999)

useEffect(() => {
  if (!barRef.current || palette.colors.length === 0) return
  const updateWidth = () => {
    const totalWidth = barRef.current!.offsetWidth
    setSegmentWidth(totalWidth / palette.colors.length)
  }
  updateWidth()
  const observer = new ResizeObserver(updateWidth)
  observer.observe(barRef.current)
  return () => observer.disconnect()
}, [palette.colors.length])

  const handleCopy = (hex: string) => {
    navigator.clipboard.writeText(hex)
    setCopiedHex(hex)
    setTimeout(() => setCopiedHex(null), 1500)
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
  <div style={{ display: 'flex', gap: 6 }}>
    <button className="btn" onClick={onExportJson} title="Export as JSON">
      ⬇ JSON
    </button>
    <button className="btn btn-accent" onClick={onAddColor}>+ Add Color</button>
  </div>
</div>
     <div className={`palette-swatches ${swatchStyle === 'bar' ? 'palette-swatches-bar' : ''}`}>
  {swatchStyle === 'bar' ? (
    // Continuous bar view
 <div className="swatch-bar-wrap" ref={barRef}>
  <div className="swatch-bar">
    {palette.colors.map((color, i) => {
      const isDuplicate = palette.colors.some(
        (c, j) => j !== i && c.hex.toLowerCase() === color.hex.toLowerCase()
      )
      return (
        <div
          key={i}
          className="swatch-bar-segment"
          style={{ background: color.hex, flex: 1 }}
          onClick={() => handleCopy(color.hex)}
          title={color.hex}
        >
          {isDuplicate && <div className="swatch-duplicate-badge">⚠</div>}
        </div>
      )
    })}
  </div>
  <div className="swatch-bar-labels">
    {palette.colors.map((color, i) => (
      <div key={i} className="swatch-bar-label" style={{ flex: 1 }}>
        <span className={segmentWidth < 40 ? 'label-vertical' : 'label-horizontal'}>
          {copiedHex === color.hex ? '✓' : color.hex}
        </span>
      </div>
    ))}
  </div>
</div>
  ) : (
    // Squares or circles view
    palette.colors.map((color, i) => {
      const isDuplicate = palette.colors.some(
        (c, j) => j !== i && c.hex.toLowerCase() === color.hex.toLowerCase()
      )
      return (
        <div key={i} className="swatch-card">
          <div
            className={`swatch-color ${swatchStyle === 'circles' ? 'swatch-circle' : ''}`}
            style={{ background: color.hex }}
            onClick={() => handleCopy(color.hex)}
            title="Click to copy"
          >
            {isDuplicate && <div className="swatch-duplicate-badge">⚠</div>}
          </div>
          <div className="swatch-hex">
            {copiedHex === color.hex ? 'copied!' : color.hex}
          </div>
          <button
            className="swatch-remove"
            onClick={() => handleRemoveColor(i)}
            title="Remove color"
          >×</button>
        </div>
      )
    })
  )}
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