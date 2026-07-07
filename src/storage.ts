import { invoke } from '@tauri-apps/api/core'

// ── Types ────────────────────────────────────────────────────────

export interface Color {
  hex: string
  name?: string
}

export interface Palette {
  id: string
  name: string
  colors: Color[]
  folder?: string
  created_at: number
}

export interface AppData {
  palettes: Palette[]
  folders: string[]
}

// ── Commands ─────────────────────────────────────────────────────

export async function loadPalettes(): Promise<AppData> {
  return invoke<AppData>('load_palettes')
}

export async function savePalette(palette: Palette): Promise<void> {
  return invoke('save_palette', { palette })
}

export async function deletePalette(id: string): Promise<void> {
  return invoke('delete_palette', { id })
}

export async function saveFolder(name: string): Promise<void> {
  return invoke('save_folder', { name })
}

export async function deleteFolder(name: string): Promise<void> {
  return invoke('delete_folder', { name })
}

export async function reorderPalettes(ids: string[]): Promise<void> {
  return invoke('reorder_palettes', { ids })
}

export async function reorderFolders(names: string[]): Promise<void> {
  return invoke('reorder_folders', { names })
}

export async function movePaletteToFolder(paletteId: string, folder: string | null): Promise<void> {
  return invoke('move_palette_to_folder', { paletteId, folder })
}

export async function getRecentColors(): Promise<string[]> {
  return invoke('get_recent_colors')
}

export async function addRecentColor(hex: string): Promise<void> {
  return invoke('add_recent_color', { hex })
}

export async function exportPaletteJson(paletteId: string): Promise<string> {
  return invoke('export_palette_json', { paletteId })
}

export async function getPreference(key: string): Promise<string | null> {
  return invoke('get_preference', { key })
}

export async function setPreference(key: string, value: string): Promise<void> {
  return invoke('set_preference', { key, value })
}

export async function renamePalette(id: string, name: string): Promise<void> {
  return invoke('rename_palette', { id, name })
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
  return invoke('rename_folder', { oldName, newName })
}

export async function exportPaletteAse(paletteId: string): Promise<number[]> {
  return invoke('export_palette_ase', { paletteId })
}
// ── Helpers ──────────────────────────────────────────────────────

export function newPalette(name: string, folder?: string): Palette {
  return {
    id: crypto.randomUUID(),
    name,
    colors: [],
    folder,
    created_at: Date.now(),
  }
}
