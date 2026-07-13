# 🎨 Magipal

A desktop color palette manager built for pixel artists, indie game developers, and anyone who loves to play with colors and swatches!

---

## Features

- **Palette management** — Create, rename, and delete palettes; add and remove individual colors
- **System-wide eyedropper** — Pick any color from anywhere on your screen
- **Manual color picker** — Fine-tune colors without leaving the app
- **PNG import** — Import palettes directly from swatch grid images
- **Lospec API Integration** — Import palettes directly from Lospec slug or URL
- **Multi-format exports** — Export palettes in various formats for use in other tools like GIMP, Adobe Photoshop, Aseprite, and more.
- **Click-to-copy hex** — One click copies any hex value to your clipboard
- **Options to fit your mood** — Light & Dark mode available, along with multiple swatch types: square, circle, and bar.
- **Dither Test** — Test color dithering in multiple sizes and color combinations

---

## Planned Features

- Analogous palette generation
- Palette folders and mood/vibe tags
- WCAG accessibility / contrast checker
- Harmony suggester (complementary, triadic, analogous)

See [ROADMAP.md](./ROADMAP.md) for the full picture.

---

## Known Issues

- Large palettes in bar mode have an issue where the hex codes will truncate (dependent on window size)
- Circle view is distorted when colors are named - naming functionality still in debate
- A [Chromium Update](https://issues.chromium.org/issues/531658990) broke the eyedropper function, expected fix end of July 2026.

---

## Tech Stack

- [Tauri](https://tauri.app/) — cross-platform desktop shell (Rust)
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — UI
- [Vite](https://vitejs.dev/) — build tooling

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri CLI: `npm install -g @tauri-apps/cli`

### Install & Run

```bash
git clone https://github.com/tirabee/magipal.git
cd magipal
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

---

## About

Magipal is an independent project by [tirabee](https://github.com/tirabee)

Made with love for anyone who enjoys colors and creativity. ♥

---

## License

MIT
