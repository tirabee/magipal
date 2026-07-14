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
- [x] WCAG contrast checker — a grid of every color pair, each cell drawn in the colors it reports on
- [ ] Harmony suggester for an existing color
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
- [x] GPL (GIMP, Krita, Inkscape, Aseprite)
- [x] ASE / Adobe Swatch Exchange
- [x] Indexed RGB JSON

## Comfort & Accessibility

- [x] Light / dark theme
- [x] Swatch styles: squares, circles, continuous bar
- [x] Keyboard shortcuts, with an in-app reference (`?`)
- [x] Accessibility settings — interface scaling (real webview zoom, so click targets grow too), high-contrast mode, always-show-controls, `prefers-reduced-motion`
- [x] Default themes meet WCAG AA, enforced by `theme.test.ts` parsing `App.css`
- [ ] Smooth transitions between palette selections
- [ ] Drag to reorder colors within a palette
- [ ] Quick Grab button — pick a color without a palette selected

## Blocked

- [ ] **Re-enable the system-wide eyedropper.** Built and working, but disabled behind `EYEDROPPER_DISABLED` in `App.tsx`: a Chromium 150 regression leaks a mouse hook after `EyeDropper.open()` resolves and freezes the app. Fix verified in Chrome Beta, expected in Chromium 151 (~28 July 2026). Flip the flag once WebView2 updates — the rest of the eyedropper code is untouched.

## Release plan

**0.9.0 — Windows, unsigned.** Ships with the auto-updater, so every later fix
reaches users automatically. Gathers real bug reports during the Chromium wait.

**1.0 — when Chromium 151 lands** (~28 July 2026) and the eyedropper can be
turned back on. Every 0.9.x user gets it via the updater.

**Then, in rough order:**

- [ ] GitHub Actions CI — a prerequisite for both of the next two
- [ ] Code signing via the [SignPath Foundation](https://signpath.org/), which is
      free for open-source projects but requires evidence of real use (downloads,
      stars, community discussion). That evidence doesn't exist yet, so this is a
      1.1+ goal — it gates nothing. Until then Windows shows a SmartScreen
      warning on install, explained in the README.
      **Unsigned SmartScreen reputation attaches to the file hash, so every new
      release starts from zero.** With a certificate it accrues to the cert and
      carries across releases — which is the real reason to get one eventually.
- [ ] Mac build + `.dmg`. Needs CI (Tauri can't cross-compile from Windows) and,
      to avoid the "unidentified developer" wall, a $99/yr Apple Developer
      account.
- [ ] Lospec "Open in App" (`lospec-palette://` URI handler)
- [ ] Floating / draggable "sticky note" ramp panel
- [ ] Per-palette inspiration images
- [ ] Pixel preview canvas

## Shipped for release

- [x] Auto-updater, signed, checking GitHub Releases on launch — had to ship in
      0.9.0, since a Tauri app can't be taught to update itself afterwards
- [x] LICENSE (MIT), and JetBrains Mono bundled under its OFL rather than fetched
      from Google on every launch
- [x] Version single-sourced from `tauri.conf.json`, with a test that fails if
      `package.json` or `Cargo.toml` drift from it
- [x] `CONTRIBUTING.md` and `RELEASING.md`

## Health

- [x] Rust tests: persistence, corruption handling, palette lock, color limits
- [x] Frontend tests (Vitest): color math, palette generation, color vision, storage helpers, undo history, theme contrast, version consistency
- [x] Notes commit on blur rather than on every keystroke
- [x] Dead code deleted (`TitleBar.tsx`, `pick_color_from_screen`)
- [x] No startup theme flash — the theme is cached in localStorage and applied before React mounts
- [ ] Every mutation does save → reload (three disk reads); `save_palette` could return the new `AppData` instead. Deferred past 0.9.0 deliberately: it touches every mutation path for a saving of microseconds on an 18 KB file, which is a poor trade right before a release.
