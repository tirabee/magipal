import { useState, useEffect, useRef } from "react";
import {
  Color,
  loadPalettes,
  savePalette,
  deletePalette,
  saveFolder,
  deleteFolder,
  newPalette,
  togglePaletteLock,
} from "./storage";
import type { Palette, AppData } from "./storage";
import { Sidebar } from "./Sidebar";
import { ImportPngModal } from "./ImportPngModal";
import { ColorPickerModal } from "./ColorPickerModal";
import { EyedropperModal } from "./EyedropperModal";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { exportPaletteJson } from "./storage";
import { usePreferences } from "./usePreferences";
import { SettingsPopover } from "./SettingsPopover";
import { ConfirmModal } from "./ConfirmModal";
import { useConfirm } from "./useConfirm";
import { InputModal } from "./InputModal";
import { TitleBar } from "./TitleBar";
import { ExportMenu } from "./ExportMenu";
import { BulkImportModal } from "./BulkImportModal";
import "./App.css";

// ── App ──────────────────────────────────────────────────────────

function App() {
  const [data, setData] = useState<AppData>({ palettes: [], folders: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImportPng, setShowImportPng] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [eyedropperColor, setEyedropperColor] = useState<string | null>(null);
  const selectedPalette =
    data.palettes.find((p) => p.id === selectedId) ?? null;
  const { theme, setTheme, swatchStyle, setSwatchStyle } = usePreferences();
  const [showSettings, setShowSettings] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(
    null,
  );
  const { confirm, pending, handleConfirm, handleCancel } = useConfirm();
  const [showNewPalette, setShowNewPalette] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Load from disk on startup
  useEffect(() => {
    loadPalettes()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const handleSort = async (mode: SortMode) => {
    if (!selectedPalette) return;
    const sorted = sortColors(selectedPalette.colors, mode);
    const updated = { ...selectedPalette, colors: sorted };
    await savePalette(updated);
    const refreshed = await loadPalettes();
    setData(refreshed);
  };

  const handleToggleLock = async () => {
    if (!selectedPalette) return;
    await togglePaletteLock(selectedPalette.id);
    const updated = await loadPalettes();
    setData(updated);
  };
  const handleEditColor = async (hex: string) => {
    if (!selectedPalette || editingColorIndex === null) return;
    const updatedColors = [...selectedPalette.colors];
    updatedColors[editingColorIndex] = {
      ...updatedColors[editingColorIndex],
      hex,
    };
    const updated = { ...selectedPalette, colors: updatedColors };
    await savePalette(updated);
    const refreshed = await loadPalettes();
    setData(refreshed);
    setEditingColorIndex(null);
  };

  const handleRemoveColor = async (index: number) => {
    if (!selectedPalette || selectedPalette.locked) return;
    const color = selectedPalette.colors[index];
    const confirmed = await confirm({
      message: `Remove ${color.hex} from this palette?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) return;
    const updated = {
      ...selectedPalette,
      colors: selectedPalette.colors.filter((_, i) => i !== index),
    };
    await savePalette(updated);
    const refreshed = await loadPalettes();
    setData(refreshed);
  };

  const handleNewPalette = async (name: string) => {
    const palette = newPalette(name);
    await savePalette(palette);
    const updated = await loadPalettes();
    setData(updated);
    setSelectedId(palette.id);
    setShowNewPalette(false);
  };

  const handleDeletePalette = async (id: string) => {
    const name = data.palettes.find((p) => p.id === id)?.name ?? "this palette";
    const confirmed = await confirm({
      message: `Delete "${name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await deletePalette(id);
    const updated = await loadPalettes();
    setData(updated);
    if (selectedId === id) setSelectedId(null);
  };

  const handleNewFolder = async (name: string) => {
    await saveFolder(name);
    const updated = await loadPalettes();
    setData(updated);
    setShowNewFolder(false);
  };

  const handleDeleteFolder = async (name: string) => {
    const confirmed = await confirm({
      message: `Delete folder "${name}"? Palettes inside will be unfoldered.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    await deleteFolder(name);
    const updated = await loadPalettes();
    setData(updated);
  };

  const handlePaletteUpdated = async () => {
    const updated = await loadPalettes();
    setData(updated);
  };

  const handleAddColor = async (hex: string) => {
    if (!selectedPalette || selectedPalette.locked) return;
    const updated = {
      ...selectedPalette,
      colors: [...selectedPalette.colors, { hex }],
    };
    await savePalette(updated);
    const refreshed = await loadPalettes();
    setData(refreshed);
    setShowColorPicker(false);
  };

  const handleImportPng = async (
    colors: string[],
    destination: "new" | string,
    newName?: string,
  ) => {
    if (destination === "new") {
      const palette = newPalette(newName ?? "Imported Palette");
      palette.colors = colors.map((hex) => ({ hex }));
      await savePalette(palette);
      const updated = await loadPalettes();
      setData(updated);
      setSelectedId(palette.id);
    } else {
      const target = data.palettes.find((p) => p.id === destination);
      if (!target) return;
      const updated = {
        ...target,
        colors: [...target.colors, ...colors.map((hex) => ({ hex }))],
      };
      await savePalette(updated);
      const refreshed = await loadPalettes();
      setData(refreshed);
    }
    setShowImportPng(false);
  };

  const handleEyedropper = async () => {
    try {
      // @ts-ignore — EyeDropper is not in TS types yet
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      setEyedropperColor(result.sRGBHex);
    } catch {
      // User cancelled — no action needed
    }
  };

  const handleEyedropperImport = async (
    color: string,
    destination: string,
    newName?: string,
  ) => {
    if (destination === "new") {
      const palette = newPalette(newName ?? "Picked Colors");
      palette.colors = [{ hex: color }];
      await savePalette(palette);
      const updated = await loadPalettes();
      setData(updated);
      setSelectedId(palette.id);
    } else {
      const target = data.palettes.find((p) => p.id === destination);
      if (!target) return;
      const updated = {
        ...target,
        colors: [...target.colors, { hex: color }],
      };
      await savePalette(updated);
      const refreshed = await loadPalettes();
      setData(refreshed);
    }
    setEyedropperColor(null);
  };

  const handleExportJson = async () => {
    if (!selectedPalette) return;
    const json = await exportPaletteJson(selectedPalette.id);
    const path = await save({
      defaultPath: `${selectedPalette.name.replace(/\s+/g, "_")}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    await writeFile(path, new TextEncoder().encode(json));
  };

  const handleBulkImport = async (
    colors: string[],
    destination: string,
    newName?: string,
  ) => {
    if (destination === "new") {
      const palette = newPalette(newName ?? "Bulk Import");
      palette.colors = colors.map((hex) => ({ hex }));
      await savePalette(palette);
      const updated = await loadPalettes();
      setData(updated);
      setSelectedId(palette.id);
    } else {
      const target = data.palettes.find((p) => p.id === destination);
      if (!target) return;
      const updated = {
        ...target,
        colors: [...target.colors, ...colors.map((hex) => ({ hex }))],
      };
      await savePalette(updated);
      const refreshed = await loadPalettes();
      setData(refreshed);
    }
    setShowBulkImport(false);
  };

  if (loading) {
    return (
      <div className="app">
        <div className="titlebar">
          <span className="titlebar-name">Magipal</span>
        </div>
        <div className="empty-state" style={{ gridColumn: "1/-1" }}>
          <div className="empty-state-text">loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Title Bar */}
      {/* Title Bar */}
      <TitleBar
        fileName={
          selectedPalette ? selectedPalette.name : "no palette selected"
        }
        onSettingsClick={() => setShowSettings((s) => !s)}
        settingsOpen={showSettings}
      />
      {showSettings && (
        <SettingsPopover
          theme={theme}
          swatchStyle={swatchStyle}
          onThemeChange={(t) => {
            setTheme(t);
            setShowSettings(false);
          }}
          onSwatchStyleChange={(s) => {
            setSwatchStyle(s);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        palettes={data.palettes}
        folders={data.folders}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDelete={handleDeletePalette}
        onDeleteFolder={handleDeleteFolder}
        onNewPalette={() => setShowNewPalette(true)}
        onNewFolder={() => setShowNewFolder(true)}
        onUpdated={handlePaletteUpdated}
      />

      {/* Main Area */}
      <div className="main">
        <div className="main-toolbar">
          <button className="btn" onClick={() => setShowImportPng(true)}>
            Import PNG
          </button>
          <button className="btn" onClick={() => setShowBulkImport(true)}>
            Import Hex
          </button>
          <button className="btn">Import URL</button>
          {/*<button className="btn">✨ AI Generate</button> */}
          <button
            className="eyedropper-btn"
            onClick={handleEyedropper}
            title="Pick color from screen"
          >
            🔍
          </button>
        </div>
        <div className="main-content">
          {selectedPalette ? (
            <PaletteView
              palette={selectedPalette}
              onUpdated={handlePaletteUpdated}
              onAddColor={() => setShowColorPicker(true)}
              onExportClick={() => setShowExportMenu((s) => !s)}
              swatchStyle={swatchStyle}
              onEditColor={setEditingColorIndex}
              onRemoveColor={handleRemoveColor}
              onToggleLock={handleToggleLock}
              onSort={handleSort}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🎨</div>
              <div className="empty-state-text">
                select a palette or create a new one
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="statusbar">
        <span className="statusbar-item">magipal v0.1.0</span>
        <span className="statusbar-item">{data.palettes.length} palettes</span>
        <span className="statusbar-item">
          ⦁ {data.palettes.reduce((acc, p) => acc + p.colors.length, 0)} colors
          total
        </span>
        {selectedPalette && (
          <span className="statusbar-item">
            ⦁ {selectedPalette.colors.length} in selected
          </span>
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
      {(showColorPicker || editingColorIndex !== null) && (
        <ColorPickerModal
          initialColor={
            editingColorIndex !== null
              ? (selectedPalette?.colors[editingColorIndex]?.hex ?? "#ff0000")
              : "#ff0000"
          }
          mode={editingColorIndex !== null ? "edit" : "add"}
          onConfirm={
            editingColorIndex !== null ? handleEditColor : handleAddColor
          }
          onClose={() => {
            setShowColorPicker(false);
            setEditingColorIndex(null);
          }}
        />
      )}

      {showBulkImport && (
        <BulkImportModal
          palettes={data.palettes}
          currentPaletteId={selectedId}
          onImport={handleBulkImport}
          onClose={() => setShowBulkImport(false)}
        />
      )}

      {showExportMenu && selectedPalette && (
        <ExportMenu
          palette={selectedPalette}
          onClose={() => setShowExportMenu(false)}
        />
      )}

      {showNewPalette && (
        <InputModal
          title="New Palette"
          label="Palette name"
          placeholder="My Palette…"
          confirmLabel="Create"
          onConfirm={handleNewPalette}
          onCancel={() => setShowNewPalette(false)}
        />
      )}

      {showNewFolder && (
        <InputModal
          title="New Folder"
          label="Folder name"
          placeholder="My Folder…"
          confirmLabel="Create"
          onConfirm={handleNewFolder}
          onCancel={() => setShowNewFolder(false)}
        />
      )}

      {pending && (
        <ConfirmModal
          message={pending.options.message}
          confirmLabel={pending.options.confirmLabel}
          danger={pending.options.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
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
  );
}

// ── Palette Item (sidebar) ────────────────────────────────────────

function PaletteItem({
  palette,
  selected,
  onSelect,
  onDelete,
  indented,
}: {
  palette: Palette;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  indented?: boolean;
}) {
  return (
    <div
      className={`palette-item ${selected ? "active" : ""} ${indented ? "indented" : ""}`}
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
          <div
            className="palette-item-swatch"
            style={{ background: "transparent" }}
          />
        )}
      </div>
      <span className="palette-item-name">{palette.name}</span>
      <button
        className="palette-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete palette"
      >
        ×
      </button>
    </div>
  );
}

// ── Color Sorting ─────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0,
    sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        hue = ((b - r) / d + 2) / 6;
        break;
      case b:
        hue = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [hue * 360, sat * 100, l * 100];
}

function getLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

type SortMode = "none" | "hue" | "saturation" | "lightness" | "luminance";

function sortColors(colors: Color[], mode: SortMode): Color[] {
  if (mode === "none") return colors;
  return [...colors].sort((a, b) => {
    const [ah, as_, al] = hexToHsl(a.hex);
    const [bh, bs, bl] = hexToHsl(b.hex);
    switch (mode) {
      case "hue":
        return ah - bh;
      case "saturation":
        return bs - as_;
      case "lightness":
        return bl - al;
      case "luminance":
        return getLuminance(b.hex) - getLuminance(a.hex);
      default:
        return 0;
    }
  });
}
// ── Palette View (main area) ──────────────────────────────────────

function PaletteView({
  palette,
  onUpdated,
  onAddColor,
  onExportClick,
  swatchStyle,
  onEditColor,
  onRemoveColor,
  onToggleLock,
  onSort,
}: {
  palette: Palette;
  onUpdated: () => void;
  onAddColor: () => void;
  onExportClick: () => void;
  swatchStyle: "squares" | "circles" | "bar";
  onEditColor: (index: number) => void;
  onRemoveColor: (index: number) => void;
  onToggleLock: () => void;
  onSort: (mode: SortMode) => void;
}) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [segmentWidth, setSegmentWidth] = useState(999);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("none");
  const displayColors = sortColors(palette.colors, sortMode);

  useEffect(() => {
    if (!barRef.current || palette.colors.length === 0) return;
    const updateWidth = () => {
      const totalWidth = barRef.current!.offsetWidth;
      setSegmentWidth(totalWidth / palette.colors.length);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(barRef.current);
    return () => observer.disconnect();
  }, [palette.colors.length]);

  const handleCopy = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  return (
    <div className="palette-view">
      <div className="palette-view-header" style={{ position: "relative" }}>
        {editingTitle !== null ? (
          <input
            className="palette-title-input"
            value={editingTitle}
            autoFocus
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={async () => {
              if (editingTitle.trim() && editingTitle.trim() !== palette.name) {
                const updated = { ...palette, name: editingTitle.trim() };
                await savePalette(updated);
                onUpdated();
              }
              setEditingTitle(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditingTitle(null);
            }}
          />
        ) : (
          <div
            className="palette-view-name"
            onDoubleClick={() => {
              if (!palette.locked) setEditingTitle(palette.name);
            }}
            title={
              palette.locked
                ? "Locked — right-click palette to unlock"
                : "Double-click to rename"
            }
          >
            {palette.locked && <span style={{ marginRight: 8 }}>🔒</span>}
            {palette.name}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select
            className="sort-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            title="Sort colors"
          >
            <option value="none">Sort: none</option>
            <option value="hue">Sort: hue</option>
            <option value="saturation">Sort: saturation</option>
            <option value="lightness">Sort: lightness</option>
            <option value="luminance">Sort: luminance</option>
          </select>
          {sortMode !== "none" && !palette.locked && (
            <button
              className="btn"
              onClick={() => onSort(sortMode)}
              title="Save this sort order permanently"
            >
              ✓ Save Order
            </button>
          )}
          <button
            className={`btn ${palette.locked ? "btn-accent" : ""}`}
            onClick={onToggleLock}
            title={palette.locked ? "Unlock palette" : "Lock palette"}
          >
            {palette.locked ? "🔒 Locked" : "🔓 Lock"}
          </button>
          <button className="btn" onClick={onExportClick}>
            ⬇ Export
          </button>
          {!palette.locked && (
            <button className="btn btn-accent" onClick={onAddColor}>
              + Add Color
            </button>
          )}
        </div>
      </div>
      <div
        className={`palette-swatches ${swatchStyle === "bar" ? "palette-swatches-bar" : ""}`}
      >
        {swatchStyle === "bar" ? (
          // Continuous bar view
          <div className="swatch-bar-wrap" ref={barRef}>
            <div className="swatch-bar">
              {displayColors.map((color, i) => {
                const isDuplicate = palette.colors.some(
                  (c, j) =>
                    j !== i && c.hex.toLowerCase() === color.hex.toLowerCase(),
                );
                return (
                  <div
                    key={i}
                    className="swatch-bar-segment"
                    style={{ background: color.hex, flex: 1 }}
                    onClick={() => handleCopy(color.hex)}
                    onDoubleClick={() => onEditColor(i)}
                    title="Click to copy · Double-click to edit"
                  >
                    {isDuplicate && (
                      <div className="swatch-duplicate-badge">⚠</div>
                    )}
                    {!palette.locked && (
                      <button
                        className="bar-segment-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveColor(i);
                        }}
                        title="Remove color"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="swatch-bar-labels">
              {displayColors.map((color, i) => (
                <div key={i} className="swatch-bar-label" style={{ flex: 1 }}>
                  <span
                    className={
                      segmentWidth < 40 ? "label-vertical" : "label-horizontal"
                    }
                  >
                    {copiedHex === color.hex ? "✓" : color.hex}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Squares or circles view
          displayColors.map((color, i) => {
            const isDuplicate = palette.colors.some(
              (c, j) =>
                j !== i && c.hex.toLowerCase() === color.hex.toLowerCase(),
            );
            return (
              <div
                key={i}
                className={`swatch-card ${swatchStyle === "circles" ? "swatch-card-circle" : ""}`}
              >
                {" "}
                <div
                  className={`swatch-color ${swatchStyle === "circles" ? "swatch-circle" : ""}`}
                  style={{ background: color.hex }}
                  onClick={() => handleCopy(color.hex)}
                  onDoubleClick={() => {
                    if (!palette.locked) onEditColor(i);
                  }}
                  title="Click to copy · Double-click to edit"
                >
                  {isDuplicate && (
                    <div className="swatch-duplicate-badge">⚠</div>
                  )}
                </div>
                <div className="swatch-hex">
                  {copiedHex === color.hex ? "copied!" : color.hex}
                </div>
                {!palette.locked && (
                  <button
                    className="swatch-remove"
                    onClick={() => onRemoveColor(i)}
                    title="Remove color"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })
        )}
        {palette.colors.length === 0 && (
          <div
            className="empty-state"
            style={{ height: "auto", paddingTop: 40 }}
          >
            <div className="empty-state-text">
              no colors yet — add one above
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
