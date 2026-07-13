import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// tauri.conf.json is the authoritative version: it is what gets stamped into the
// binary and what the updater compares against. (Its `version` field only accepts
// a literal semver -- pointing it at package.json silently falls back to the
// Cargo.toml version instead, which is a great way to ship a 0.9.0 labelled
// 0.1.0.) The frontend reads the same file so the status bar can never disagree
// with the app it is running in; version.test.ts keeps the other two in step.
// Resolved relative to this file, not to the working directory -- a bare
// "./src-tauri/..." breaks the moment the config is loaded from anywhere else.
const { version } = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./src-tauri/tauri.conf.json", import.meta.url)),
    "utf-8",
  ),
);

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  define: {
    __APP_VERSION__: JSON.stringify(version),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
