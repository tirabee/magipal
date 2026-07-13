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
  remainingCapacity,
  colorLimit,
} from "./storage";
import type { Palette, AppData } from "./storage";
import type { Destination } from "./DestinationPicker";
import { hexToHsl, relativeLuminance } from "./color";
import { Sidebar } from "./Sidebar";
import { ImportPngModal } from "./ImportPngModal";
import { ColorPickerModal } from "./ColorPickerModal";
import { EyedropperModal } from "./EyedropperModal";
import { usePreferences } from "./usePreferences";
import { SettingsPopover } from "./SettingsPopover";
import { ConfirmModal } from "./ConfirmModal";
import { useConfirm } from "./useConfirm";
import { InputModal } from "./InputModal";
import { NewPaletteModal } from "./NewPaletteModal";
import { ExportMenu } from "./ExportMenu";
import { BulkImportModal } from "./BulkImportModal";
import { LospecImportModal } from "./LospecImportModal";
import { RampModal } from "./RampModal";
import { DitherTestPanel } from "./DitherTest";
import "./App.css";

// Temporarily disabled: a Chromium/WebView2 regression freezes all mouse
// input after EyeDropper.open() resolves. Fix already verified in Chrome
// Beta, expected in stable Chromium 151 (~July 28, 2026).
// Tracking: https://github.com/brave/brave-browser/issues/56888
const EYEDROPPER_DISABLED = true;
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
  const [showLospecImport, setShowLospecImport] = useState(false);
  const [rampBaseColor, setRampBaseColor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Load from disk on startup. A rejection here means the data file exists but
  // is unreadable — surface it instead of rendering an empty app, which would
  // invite the user to start saving over recoverable data.
  useEffect(() => {
    loadPalettes()
      .then(setData)
      .catch((e) => setLoadError(String(e)))
      .finally(() => setLoading(false));
  }, []);

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

  const handleNewPalette = async (name: string, maxColors?: number) => {
    const palette = newPalette(name, undefined, maxColors);
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
    if (remainingCapacity(selectedPalette) < 1) return;
    const updated = {
      ...selectedPalette,
      colors: [...selectedPalette.colors, { hex }],
    };
    await savePalette(updated);
    const refreshed = await loadPalettes();
    setData(refreshed);
    setShowColorPicker(false);
  };

  /**
   * The one path colors take into a palette, whatever the source. This was five
   * near-identical copies, which is exactly why the lock check existed in the
   * ramp copy and was missing from the other four.
   *
   * The lock is also enforced in Rust's save_palette, so a bug here cannot
   * corrupt a locked palette -- this guard just avoids a pointless round-trip.
   */
  const importColors = async (
    hexes: string[],
    destination: Destination,
    opts: {
      newName?: string;
      author?: string;
      /** Ramps generate shades that may already exist; other sources import as-is. */
      skipDuplicates?: boolean;
    } = {},
  ) => {
    if (destination === "new") {
      const palette = newPalette(opts.newName ?? "Imported Palette");
      palette.colors = hexes.map((hex) => ({ hex }));
      if (opts.author) palette.author = opts.author;
      await savePalette(palette);
      setData(await loadPalettes());
      setSelectedId(palette.id);
      return;
    }

    const target = data.palettes.find((p) => p.id === destination);
    if (!target || target.locked) return;

    const existing = new Set(target.colors.map((c) => c.hex.toLowerCase()));
    const wanted = opts.skipDuplicates
      ? hexes.filter((hex) => !existing.has(hex.toLowerCase()))
      : hexes;

    // A capped palette takes what fits. Rejecting the whole import over a
    // near-miss is punitive; truncating silently is dishonest -- so ask.
    const room = remainingCapacity(target);
    if (room < 1) {
      await confirm({
        message: `"${target.name}" is full (${colorLimit(target)} colors). Remove a color to make room.`,
        confirmLabel: "OK",
      });
      return;
    }
    let incoming = wanted;
    if (wanted.length > room) {
      const dropped = wanted.length - room;
      const proceed = await confirm({
        message: `"${target.name}" has room for ${room} more ${room === 1 ? "color" : "colors"}. Add the first ${room} and skip the other ${dropped}?`,
        confirmLabel: `Add ${room}`,
      });
      if (!proceed) return;
      incoming = wanted.slice(0, room);
    }

    await savePalette({
      ...target,
      colors: [...target.colors, ...incoming.map((hex) => ({ hex }))],
    });
    setData(await loadPalettes());
  };

  /**
   * Import modals default their destination to the current palette, so a locked
   * one must not be offered as "current" -- it still appears in the list below,
   * disabled and marked with a lock.
   */
  const importTargetId = selectedPalette?.locked ? null : selectedId;

  const handleEyedropper = async () => {
    if (EYEDROPPER_DISABLED) return;
    try {
      // @ts-ignore
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      setEyedropperColor(result.sRGBHex);
    } catch {
      // User cancelled
    }
  };

  if (loadError) {
    return (
      <div className="app">
        <div className="titlebar">
          <span className="titlebar-name">Magipal</span>
        </div>
        <div className="empty-state" style={{ gridColumn: "1/-1" }}>
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-text">
            Magipal couldn&rsquo;t read your saved palettes.
          </div>
          <div className="empty-state-detail">{loadError}</div>
          <div className="empty-state-detail">
            Your palettes have not been deleted, and Magipal will not save over
            them. Close the app and check the data folder before continuing.
          </div>
        </div>
      </div>
    );
  }

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
      <div className="titlebar" style={{ position: "relative" }}>
        <span className="titlebar-name">Magipal</span>
        <span className="titlebar-sep">—</span>
        <span className="titlebar-file">
          {selectedPalette ? selectedPalette.name : "no palette selected"}
        </span>
        <button
          className="settings-btn"
          onClick={() => setShowSettings((s) => !s)}
          title="Settings"
        >
          ⚙️
        </button>
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
      </div>

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
          <button className="btn" onClick={() => setShowLospecImport(true)}>
            Import{" "}
            <svg
              className="lospec-logo"
              viewBox="0 0 83 20"
              role="img"
              aria-label="Lospec"
              fill="currentColor"
            >
              <path d="M7 16H6V0H0v20h13v-7H7zm7 4h13V0H14v20zm6-16h1v12h-1V4zm15 4V4h1v3h5V0H28v12h7v4h-1v-3h-6v7h13V8zm7 12h6v-5h7V0H42v20zm6-16h1v7h-1V4zm8 16h13v-7h-6v3h-1v-4h7V8h-7V4h1v3h6V0H56zM83 8V0H70v20h13v-7h-6v3h-1V4h1v4z" />
            </svg>
          </button>
          <button
            className="eyedropper-btn"
            onClick={handleEyedropper}
            disabled={EYEDROPPER_DISABLED}
            title={
              EYEDROPPER_DISABLED
                ? "Temporarily disabled — a Chromium bug freezes the app after picking a color. Fix expected late July 2026."
                : "Pick color from screen"
            }
          >
            🔍
          </button>
        </div>
        <div className="main-content">
          {selectedPalette ? (
            <PaletteView
              key={selectedPalette.id}
              palette={selectedPalette}
              onUpdated={handlePaletteUpdated}
              onAddColor={() => setShowColorPicker(true)}
              onExportClick={() => setShowExportMenu((s) => !s)}
              swatchStyle={swatchStyle}
              onEditColor={setEditingColorIndex}
              onRemoveColor={handleRemoveColor}
              onToggleLock={handleToggleLock}
              onGenerateRamp={setRampBaseColor}
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
          currentPaletteId={importTargetId}
          onImport={async (colors, destination, newName) => {
            await importColors(colors, destination, {
              newName: newName ?? "Imported Palette",
            });
            setShowImportPng(false);
          }}
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
          currentPaletteId={importTargetId}
          onImport={async (colors, destination, newName) => {
            await importColors(colors, destination, {
              newName: newName ?? "Bulk Import",
            });
            setShowBulkImport(false);
          }}
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
        <NewPaletteModal
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
          currentPaletteId={importTargetId}
          onImport={async (color, destination, newName) => {
            await importColors([color], destination, {
              newName: newName ?? "Picked Colors",
            });
            setEyedropperColor(null);
          }}
          onClose={() => setEyedropperColor(null)}
        />
      )}

      {showLospecImport && (
        <LospecImportModal
          palettes={data.palettes}
          currentPaletteId={importTargetId}
          onImport={async (lospec, destination) => {
            await importColors(
              lospec.colors.map((hex) => `#${hex}`),
              destination,
              { newName: lospec.name, author: lospec.author },
            );
            setShowLospecImport(false);
          }}
          onClose={() => setShowLospecImport(false)}
        />
      )}

      {rampBaseColor && (
        <RampModal
          baseColor={rampBaseColor}
          palettes={data.palettes}
          currentPaletteId={importTargetId}
          onImport={async (ramp, destination, newName) => {
            await importColors(ramp, destination, {
              newName: newName ?? "Shade Ramp",
              skipDuplicates: true,
            });
            setRampBaseColor(null);
          }}
          onClose={() => setRampBaseColor(null)}
        />
      )}
    </div>
  );
}

// ── Color Sorting ─────────────────────────────────────────────────

type SortMode = "default" | "hue" | "saturation" | "lightness" | "luminance";

/// A color paired with its position in the palette's saved (on-disk) array.
/// Sorting reorders the view, so a color's position on screen is not its
/// position in storage — every edit/remove/rename must address `index`, never
/// the index of the loop that rendered it.
type PositionedColor = { color: Color; index: number };

function sortColors(colors: Color[], mode: SortMode): PositionedColor[] {
  const positioned = colors.map((color, index) => ({ color, index }));
  if (mode === "default") return positioned;
  return positioned.sort((a, b) => {
    const [ah, as_, al] = hexToHsl(a.color.hex);
    const [bh, bs, bl] = hexToHsl(b.color.hex);
    switch (mode) {
      case "hue":
        return ah - bh;
      case "saturation":
        return bs - as_;
      case "lightness":
        return bl - al;
      case "luminance":
        return (
          relativeLuminance(b.color.hex) - relativeLuminance(a.color.hex)
        );
      default:
        return 0;
    }
  });
}

/// Counted over the palette's own colors, not the rendered list, so both the
/// grid and bar views agree on what counts as a duplicate.
function countHex(colors: Color[], hex: string): number {
  const target = hex.toLowerCase();
  return colors.filter((c) => c.hex.toLowerCase() === target).length;
}
// ── Palette View (main area) ──────────────────────────────────────

function SwatchLabel({
  color,
  copied,
  locked,
  onRename,
}: {
  color: Color;
  copied: boolean;
  locked?: boolean;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = (e: React.MouseEvent) => {
    if (locked) return;
    e.stopPropagation();
    setDraft(color.name ?? "");
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    onRename(draft.trim());
  };

  if (copied) return <div className="swatch-hex">copied!</div>;

  if (editing) {
    return (
      <div className="swatch-hex" style={{ background: color.hex }}>
        <input
          className="swatch-name-input"
          value={draft}
          autoFocus
          placeholder={color.hex}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div
      className="swatch-hex"
      title={color.name ? `${color.name} — ${color.hex}` : "Click to add name"}
      onClick={startEditing}
      style={{ cursor: locked ? "default" : "text" }}
    >
      {color.name ? (
        <span className="swatch-name">{color.name}</span>
      ) : (
        color.hex
      )}
    </div>
  );
}
function PaletteView({
  palette,
  onUpdated,
  onAddColor,
  onExportClick,
  swatchStyle,
  onEditColor,
  onRemoveColor,
  onToggleLock,
  onGenerateRamp,
}: {
  palette: Palette;
  onUpdated: () => void;
  onAddColor: () => void;
  onExportClick: () => void;
  swatchStyle: "squares" | "circles" | "bar";
  onEditColor: (index: number) => void;
  onRemoveColor: (index: number) => void;
  onToggleLock: () => void;
  onGenerateRamp: (hex: string) => void;
}) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [showDither, setShowDither] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [segmentWidth, setSegmentWidth] = useState(999);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  // Each entry carries the color's real position in palette.colors, so sorting
  // the view never misdirects an edit at the wrong slot on disk.
  const displayColors = sortColors(palette.colors, sortMode);
  const limit = colorLimit(palette);
  const isFull = remainingCapacity(palette) < 1;

  // Measure each bar segment so labels can flip to vertical when cramped.
  useEffect(() => {
    if (swatchStyle !== "bar") return;
    const el = barRef.current;
    if (!el) return;
    const measure = () => {
      const count = displayColors.length;
      setSegmentWidth(count > 0 ? el.clientWidth / count : 999);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [swatchStyle, displayColors.length]);

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
          <div className="palette-title-group">
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
            {palette.author && (
              <span className="palette-author-inline">
                via Lospec · by {palette.author}
              </span>
            )}
            {limit !== null && (
              <span
                className={`palette-limit-badge ${isFull ? "palette-limit-badge-full" : ""}`}
                title={
                  isFull
                    ? "This palette is full"
                    : `Limited to ${limit} colors`
                }
              >
                {palette.colors.length} / {limit}
              </span>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select
            className="sort-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            title="Sort colors"
          >
            <option value="default">Sort: default</option>
            <option value="hue">Sort: hue</option>
            <option value="saturation">Sort: saturation</option>
            <option value="lightness">Sort: lightness</option>
            <option value="luminance">Sort: luminance</option>
          </select>
          <button
            className={`btn ${showDither ? "btn-accent" : ""}`}
            onClick={() => setShowDither((s) => !s)}
            title="Toggle dither test view"
          >
            🎲 Dither
          </button>
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
            <button
              className="btn btn-accent"
              onClick={onAddColor}
              disabled={isFull}
              title={
                isFull
                  ? `Full — this palette is limited to ${limit} colors`
                  : "Add a color"
              }
            >
              + Add Color
            </button>
          )}
        </div>
      </div>
      {/* Palette Notes */}
      <div className="palette-notes-wrap">
        {!palette.locked ? (
          <textarea
            className="palette-notes"
            placeholder="Add a note about this palette…"
            value={palette.notes ?? ""}
            onChange={async (e) => {
              const updated = { ...palette, notes: e.target.value };
              await savePalette(updated);
              onUpdated();
            }}
            rows={1}
            spellCheck={false}
          />
        ) : (
          palette.notes && (
            <div className="palette-notes-readonly">{palette.notes}</div>
          )
        )}
      </div>
      {showDither ? (
        <DitherTestPanel colors={displayColors.map((e) => e.color)} />
      ) : (
        <div
          className={`palette-swatches ${swatchStyle === "bar" ? "palette-swatches-bar" : ""}`}
        >
          {swatchStyle === "bar" ? (
            // Continuous bar view
            <div className="swatch-bar-wrap" ref={barRef}>
              <div className="swatch-bar">
                {displayColors.map(({ color, index }) => {
                  const isDuplicate = countHex(palette.colors, color.hex) > 1;
                  return (
                    <div
                      key={index}
                      className="swatch-bar-segment"
                      style={{ background: color.hex, flex: 1 }}
                      onClick={() => handleCopy(color.hex)}
                      onDoubleClick={() => {
                        if (!palette.locked) onEditColor(index);
                      }}
                      title={
                        palette.locked
                          ? "Click to copy"
                          : "Click to copy · Double-click to edit"
                      }
                    >
                      {isDuplicate && (
                        <div className="swatch-duplicate-badge">⚠</div>
                      )}
                      {!palette.locked && (
                        <button
                          className="bar-segment-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveColor(index);
                          }}
                          title="Remove color"
                        >
                          ×
                        </button>
                      )}
                      <button
                        className="swatch-ramp-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateRamp(color.hex);
                        }}
                        title="Generate shade/highlight ramp"
                      >
                        🌗
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="swatch-bar-labels">
                {displayColors.map(({ color, index }) => (
                  <div
                    key={index}
                    className="swatch-bar-label"
                    style={{ flex: 1 }}
                    title={
                      color.name ? `${color.name} — ${color.hex}` : color.hex
                    }
                  >
                    <span
                      className={
                        segmentWidth < 40
                          ? "label-vertical"
                          : "label-horizontal"
                      }
                    >
                      {copiedHex === color.hex
                        ? "✓"
                        : (color.name ?? color.hex)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Squares or circles view
            displayColors.map(({ color, index }) => {
              const isDuplicate = countHex(palette.colors, color.hex) > 1;
              return (
                <div
                  key={index}
                  className={`swatch-card ${swatchStyle === "circles" ? "swatch-card-circle" : ""}`}
                >
                  {" "}
                  <div
                    className={`swatch-color ${swatchStyle === "circles" ? "swatch-circle" : ""}`}
                    style={{ background: color.hex }}
                    onClick={() => handleCopy(color.hex)}
                    onDoubleClick={() => {
                      if (!palette.locked) onEditColor(index);
                    }}
                    title={
                      palette.locked
                        ? "Click to copy"
                        : "Click to copy · Double-click to edit"
                    }
                  >
                    {isDuplicate && (
                      <div className="swatch-duplicate-badge">⚠</div>
                    )}
                    <button
                      className="swatch-ramp-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenerateRamp(color.hex);
                      }}
                      title="Generate shade/highlight ramp"
                    >
                      🌗
                    </button>
                  </div>
                  <SwatchLabel
                    color={color}
                    copied={copiedHex === color.hex}
                    locked={palette.locked}
                    onRename={async (name) => {
                      const updatedColors = palette.colors.map((c, i) =>
                        i === index ? { ...c, name: name || undefined } : c,
                      );
                      const updated = { ...palette, colors: updatedColors };
                      await savePalette(updated);
                      onUpdated();
                    }}
                  />
                  {!palette.locked && (
                    <button
                      className="swatch-remove"
                      onClick={() => onRemoveColor(index)}
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
      )}
    </div>
  );
}

export default App;
