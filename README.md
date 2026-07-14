# 🎨 Magipal

A desktop color palette manager built for pixel artists, indie game developers, and anyone who loves to play with colors and swatches!

---

## Features

### Organize

- **Undo / redo** — Every change is undoable, right back to deleting a whole palette by mistake
- **Palettes and folders** — Create, rename, delete, and drag palettes between folders
- **Palette lock** — Freeze a finished palette so its colors can't be changed by accident
- **Color limits** — Optionally cap a palette at 4, 8, 16, 32 (or any) colors, enforced on save
- **Names and notes** — Name individual colors and keep per-palette notes; color names carry through to ASE and GPL exports
- **Duplicate detection** — Repeated colors are flagged automatically

### Create

- **Manual color picker** — HSV picker with recent colors
- **Shade & highlight ramps** — Generate ramps from any color, with optional hue shifting
- **Palette randomizer** — Generate palettes from color harmonies (monochrome, analogous, complementary, triadic, tetradic)
- **Non-destructive sorting** — Sort by hue, saturation, lightness, or luminance without touching what's saved

### Check

- **Color blindness simulator** — Preview your palette under protanopia, deuteranopia, and tritanopia, and get told exactly which pairs of colors become indistinguishable
- **WCAG contrast checker** — Every pair of colors in a grid, with its contrast ratio and pass level. Each cell is drawn in the very colors it's reporting on, so you can see the answer as well as read it
- **Dither test** — Preview Bayer 4×4 ordered dithering between any two colors

### Import & Export

- **Lospec** — Import any palette by slug or URL, with author attribution
- **PNG import** — Sample from a swatch grid or click individual pixels
- **Bulk hex import** — Paste a list of hex codes
- **Multi-format export** — hex list, CSS variables, GPL (GIMP, Krita, Inkscape, **Aseprite**), ASE / Adobe Swatch Exchange (Photoshop, Illustrator, Affinity), PNG swatch sheet, indexed JSON

> **Heads up:** for Aseprite, export **GPL**, not ASE. Aseprite uses `.ase` for its *own* sprite files, which is a different format that merely shares the extension with Adobe Swatch Exchange — hand Aseprite an `.ase` palette and it won't open it.

### Comfort & Accessibility

- **Keyboard shortcuts** — Press `?` in the app for the full list
- **Light & dark themes**, and three swatch styles: squares, circles, and a continuous bar
- **Interface scaling** — 100% to 175%. Scales the whole UI, including click targets, not just the text
- **High contrast mode**, and default themes that meet WCAG AA
- **Always-show controls** — for anyone who can't hover precisely
- **Click to copy** — One click copies any hex to your clipboard

---

## Planned

- Tags and a tag cloud
- Harmony suggester for an existing color
- Mac build

See [ROADMAP.md](./ROADMAP.md) for the full picture.

---

## "Windows protected your PC" — is Magipal safe?

Yes. Here's exactly what's happening.

When you run the installer, Windows may show a blue **SmartScreen** warning saying the publisher is unrecognized. To continue, click **More info → Run anyway**.

This is not a virus warning. Windows shows it for any application that hasn't been signed with a paid code-signing certificate, which currently costs a few hundred dollars a year. Magipal is a free, one-person project and hasn't bought one yet.

You do not have to take my word for any of this:

- **All the source code is right here.** Read it. Nothing is hidden.
- **You can build it yourself** from this repository (see below) and get the same app.
- **Magipal makes no network requests** except when you explicitly import a palette from Lospec, and when it checks GitHub for a new version. It doesn't phone home, and it has no analytics.
- **Your palettes never leave your machine.** They're plain JSON in your app-data folder — go and look.

I intend to get the app signed once the project qualifies for a free open-source certificate through the [SignPath Foundation](https://signpath.org/), which requires a track record of real use. Until then, the warning is the price of a free tool. Sorry about that — I'd rather explain it honestly than pretend it isn't there.

---

## Known Issues

- **The system-wide eyedropper is temporarily disabled.** A [Chromium 150 regression](https://issues.chromium.org/issues/531658990) leaks a mouse hook after the picker closes, freezing the app. The fix is verified in Chrome Beta and expected in Chromium 151 (~late July 2026); the feature will be re-enabled once WebView2 catches up.
- Hex labels in bar mode get cramped on very large palettes. Labels rotate to vertical when space is tight, but it isn't perfect yet.
- **Windows shows a SmartScreen warning on install** because the app isn't code-signed yet — see above.

---

## Tech Stack

- [Tauri](https://tauri.app/) — cross-platform desktop shell (Rust)
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — UI
- [Vite](https://vitejs.dev/) — build tooling
- [Vitest](https://vitest.dev/) — frontend tests

Palettes are stored as plain JSON in your OS app-data directory. Writes are atomic, and Magipal refuses to overwrite a data file it can't read — so a crash mid-save can't cost you your palettes.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri CLI: `npm install -g @tauri-apps/cli`

### Install and run

```bash
git clone https://github.com/tirabee/magipal.git
cd magipal
npm install
npm run tauri dev
```

### Run the tests

```bash
npm test                     # frontend: color math, storage helpers, undo history
cd src-tauri && cargo test   # backend: persistence, palette lock, color limits
```

### Build a release

See [RELEASING.md](./RELEASING.md) — releases must be signed, or the auto-updater
can't offer them.

---

## Contributing

Bug reports are welcome with no ceremony. For anything larger, please open an
issue first — see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## About

Magipal is an independent project by [tirabee](https://github.com/tirabee)

Made with love for anyone who enjoys colors and creativity. ♥

Magipal runs entirely on your machine. It makes no network requests except when you explicitly import a palette from Lospec.

---

## License

Magipal is MIT licensed — see [LICENSE](./LICENSE).

It bundles [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), licensed under the SIL Open Font License 1.1 — see [licenses/OFL-JetBrainsMono.txt](./licenses/OFL-JetBrainsMono.txt).

The app icon is the palette glyph from [Noto Emoji](https://github.com/googlefonts/noto-emoji), licensed under Apache 2.0 — see [licenses/Apache-2.0-NotoEmoji.txt](./licenses/Apache-2.0-NotoEmoji.txt).
