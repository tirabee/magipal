use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

// ── Data structures ──────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
struct Color {
    hex: String,
    name: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Palette {
    id: String,
    name: String,
    colors: Vec<Color>,
    folder: Option<String>,
    created_at: u64,
    order: Option<i64>,
}

#[derive(Serialize, Deserialize)]
struct AppData {
    palettes: Vec<Palette>,
    folders: Vec<String>,
}

impl Default for AppData {
    fn default() -> Self {
        AppData {
            palettes: vec![],
            folders: vec![],
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────

fn get_data_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("could not resolve app data dir");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("magipal.json")
}

fn load_data(app: &tauri::AppHandle) -> AppData {
    let path = get_data_path(app);
    if path.exists() {
        let contents = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&contents).unwrap_or_default()
    } else {
        AppData::default()
    }
}

fn save_data(app: &tauri::AppHandle, data: &AppData) -> Result<(), String> {
    let path = get_data_path(app);
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Commands ─────────────────────────────────────────────────────

#[tauri::command]
fn load_palettes(app: tauri::AppHandle) -> AppData {
    load_data(&app)
}

#[tauri::command]
fn save_palette(app: tauri::AppHandle, palette: Palette) -> Result<(), String> {
    let mut data = load_data(&app);
    if let Some(existing) = data.palettes.iter_mut().find(|p| p.id == palette.id) {
        *existing = palette;
    } else {
        data.palettes.push(palette);
    }
    save_data(&app, &data)
}

#[tauri::command]
fn delete_palette(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut data = load_data(&app);
    data.palettes.retain(|p| p.id != id);
    save_data(&app, &data)
}

#[tauri::command]
fn save_folder(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let mut data = load_data(&app);
    if !data.folders.contains(&name) {
        data.folders.push(name);
    }
    save_data(&app, &data)
}

#[tauri::command]
fn delete_folder(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let mut data = load_data(&app);
    data.folders.retain(|f| *f != name);
    // Remove folder association from palettes
    for palette in data.palettes.iter_mut() {
        if palette.folder.as_deref() == Some(&name) {
            palette.folder = None;
        }
    }
    save_data(&app, &data)
}

#[tauri::command]
fn reorder_palettes(app: tauri::AppHandle, ids: Vec<String>) -> Result<(), String> {
    let mut data = load_data(&app);
    for (i, id) in ids.iter().enumerate() {
        if let Some(p) = data.palettes.iter_mut().find(|p| p.id == *id) {
            p.order = Some(i as i64);
        }
    }
    save_data(&app, &data)
}

#[tauri::command]
fn reorder_folders(app: tauri::AppHandle, names: Vec<String>) -> Result<(), String> {
    let mut data = load_data(&app);
    data.folders = names;
    save_data(&app, &data)
}

#[tauri::command]
fn move_palette_to_folder(
    app: tauri::AppHandle,
    palette_id: String,
    folder: Option<String>,
) -> Result<(), String> {
    let mut data = load_data(&app);
    if let Some(p) = data.palettes.iter_mut().find(|p| p.id == palette_id) {
        p.folder = folder;
    }
    save_data(&app, &data)
}

#[tauri::command]
fn get_recent_colors(app: tauri::AppHandle) -> Vec<String> {
    let path = app
        .path()
        .app_data_dir()
        .expect("could not resolve app data dir")
        .join("recent_colors.json");
    if path.exists() {
        let contents = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&contents).unwrap_or_default()
    } else {
        vec![]
    }
}

#[tauri::command]
fn add_recent_color(app: tauri::AppHandle, hex: String) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .expect("could not resolve app data dir")
        .join("recent_colors.json");
    let mut colors: Vec<String> = if path.exists() {
        let contents = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&contents).unwrap_or_default()
    } else {
        vec![]
    };
    colors.retain(|c| c != &hex);
    colors.insert(0, hex);
    colors.truncate(32);
    let json = serde_json::to_string(&colors).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}
// ── App entry ────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_palettes,
            save_palette,
            delete_palette,
            save_folder,
            delete_folder,
            reorder_palettes,
            reorder_folders,
            move_palette_to_folder,
            get_recent_colors,
            add_recent_color,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
