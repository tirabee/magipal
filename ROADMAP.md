# Magipal Roadmap

## Core

- [x] Sidebar palette list with swatches
- [x] Palette selection + color swatch view
- [x] Click to copy hex value
- [x] Create / rename / delete palettes
- [x] Add / remove / edit individual colors
- [x] Manual color picker (HSV, with recent colors)
- [x] Persist palettes to disk (atomic writes; a damaged data file is quarantined rather than overwritten)
- [x] Lock / unlock a palette (enforced on save, not just in the UI)
- [x] Optional color count limit per palette
- [x] Per-color names and per-palette notes
- [x] Duplicate color detection
- [x] Non-destructive sorting (hue / saturation / lightness / luminance)
- [x] **Undo / redo** — whole-state snapshots (session-only, 100 deep), so every data change is undoable, including ones added later. All mutations funnel through `App.mutate()`.

## Organization

- [x] Folders, with full drag-and-drop (reorder, move in and out, unfolder)
- [ ] Tag palettes with moods / vibes
- [ ] Tag cloud modal

## Color Tools

- [x] Shade / highlight ramp generator, with hue shifting
- [x] Palette randomizer (monochrome / analogous / complementary / triadic / tetradic)
- [x] Dither test (Bayer 4×4, adjustable zoom)
- [x] Color blindness simulator (protanopia / deuteranopia / tritanopia) with confusable-pair detection
- [ ] Harmony suggester for an existing color
- [ ] WCAG contrast checker — `relativeLuminance()` in `color.ts` is already correct (gamma-linearized), so build on that
- [ ] Palette merging with duplicate detection

## Import

- [x] Import from PNG swatch grid
- [x] Import from PNG by clicking pixels
- [x] Bulk hex paste
- [x] Import from Lospec by slug or URL, with author byline
- [ ] Lospec "Open in App" (`lospec-palette://` URI handler) — deferred until there's an installer to test registration against

## Export

- [x] Hex list
- [x] CSS variables
- [x] GPL (GIMP)
- [x] PNG swatch sheet
- [x] ASE (Aseprite / Photoshop) — carries color names
- [x] Indexed RGB JSON

## Comfort & Accessibility

- [x] Light / dark theme
- [x] Swatch styles: squares, circles, continuous bar
- [x] Keyboard shortcuts, with an in-app reference (`?`)
- [ ] Accessibility settings (font scaling, contrast modes)
- [ ] Smooth transitions between palette selections
- [ ] Drag to reorder colors within a palette
- [ ] Quick Grab button — pick a color without a palette selected

## Blocked

- [ ] **Re-enable the system-wide eyedropper.** Built and working, but disabled behind `EYEDROPPER_DISABLED` in `App.tsx`: a Chromium 150 regression leaks a mouse hook after `EyeDropper.open()` resolves and freezes the app. Fix verified in Chrome Beta, expected in Chromium 151 (~28 July 2026). Flip the flag once WebView2 updates — the rest of the eyedropper code is untouched.

## After 1.0

- [ ] Mac build + `.dmg`
- [ ] GitHub Actions CI
- [ ] In-app updater
- [ ] Floating / draggable "sticky note" ramp panel
- [ ] Per-palette inspiration images
- [ ] Pixel preview canvas

## Health

- [x] Rust tests: persistence, corruption handling, palette lock, color limits
- [x] Frontend tests (Vitest): color math, palette generation, color vision, storage helpers, undo history
- [x] Notes commit on blur rather than on every keystroke
- [ ] `CONTRIBUTING.md` before open-sourcing
- [ ] Delete dead code: `TitleBar.tsx`, `pick_color_from_screen` (+ its `storage.ts` wrapper)
- [ ] Every mutation does save → reload (three disk reads); `save_palette` could return the new `AppData` instead
- [ ] `usePreferences` returns a `loaded` flag that nothing uses, so the theme flashes dark on startup
