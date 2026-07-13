use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

// ── Windows Title Bar Config ────────────────────────────────────────
#[cfg(target_os = "windows")]
fn set_titlebar_color(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::COLORREF;
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR,
    };

    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            // COLORREF is 0x00BBGGRR — reversed from normal hex
            // --bg-panel: #16213e
            let caption_color = COLORREF(0x003e2116);
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_CAPTION_COLOR,
                &caption_color as *const _ as *const _,
                std::mem::size_of::<COLORREF>() as u32,
            );

            // --text-primary: #e8e8f0
            let text_color = COLORREF(0x00f0e8e8);
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_TEXT_COLOR,
                &text_color as *const _ as *const _,
                std::mem::size_of::<COLORREF>() as u32,
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn set_titlebar_color(_window: &tauri::WebviewWindow) {}

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
    locked: Option<bool>,
    notes: Option<String>,
    author: Option<String>,
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

#[tauri::command]
fn export_palette_json(app: tauri::AppHandle, palette_id: String) -> Result<String, String> {
    let data = load_data(&app);
    let palette = data
        .palettes
        .iter()
        .find(|p| p.id == palette_id)
        .ok_or("Palette not found")?;

    let mut rgb_arrays: Vec<[u8; 3]> = palette
        .colors
        .iter()
        .filter_map(|c| {
            let hex = c.hex.trim_start_matches('#');
            if hex.len() == 6 {
                let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
                let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
                let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
                Some([r, g, b])
            } else {
                None
            }
        })
        .collect();

    // Pad to 50 slots with [0, 0, 0]
    while rgb_arrays.len() < 50 {
        rgb_arrays.push([0, 0, 0]);
    }
    // Truncate if somehow over 50
    rgb_arrays.truncate(50);

    serde_json::to_string_pretty(&rgb_arrays).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_preference(app: tauri::AppHandle, key: String) -> Option<String> {
    let path = app
        .path()
        .app_data_dir()
        .expect("could not resolve app data dir")
        .join("preferences.json");
    if path.exists() {
        let contents = fs::read_to_string(&path).unwrap_or_default();
        let prefs: serde_json::Value = serde_json::from_str(&contents).unwrap_or_default();
        prefs[key].as_str().map(|s| s.to_string())
    } else {
        None
    }
}

#[tauri::command]
fn set_preference(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .expect("could not resolve app data dir")
        .join("preferences.json");
    let mut prefs: serde_json::Value = if path.exists() {
        let contents = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&contents).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    prefs[key] = serde_json::Value::String(value);
    let json = serde_json::to_string_pretty(&prefs).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn rename_palette(app: tauri::AppHandle, id: String, name: String) -> Result<(), String> {
    let mut data = load_data(&app);
    if let Some(p) = data.palettes.iter_mut().find(|p| p.id == id) {
        p.name = name;
    }
    save_data(&app, &data)
}

#[tauri::command]
fn rename_folder(app: tauri::AppHandle, old_name: String, new_name: String) -> Result<(), String> {
    let mut data = load_data(&app);
    // Rename the folder
    if let Some(f) = data.folders.iter_mut().find(|f| **f == old_name) {
        *f = new_name.clone();
    }
    // Update all palettes that reference the old folder name
    for palette in data.palettes.iter_mut() {
        if palette.folder.as_deref() == Some(&old_name) {
            palette.folder = Some(new_name.clone());
        }
    }
    save_data(&app, &data)
}

#[tauri::command]
async fn pick_color_from_screen() -> Result<Option<String>, String> {
    use std::process::Command;

    // Use PowerShell to invoke the Windows color picker
    let output = Command::new("powershell")
        .args([
            "-Command",
            r#"
            Add-Type -AssemblyName System.Windows.Forms
            Add-Type -AssemblyName System.Drawing
            $dialog = New-Object System.Windows.Forms.ColorDialog
            $dialog.FullOpen = $true
            if ($dialog.ShowDialog() -eq 'OK') {
                $c = $dialog.Color
                '{0:X2}{1:X2}{2:X2}' -f $c.R, $c.G, $c.B
            }
            "#,
        ])
        .output()
        .map_err(|e| e.to_string())?;

    let hex = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if hex.is_empty() {
        Ok(None)
    } else {
        Ok(Some(format!("#{}", hex.to_lowercase())))
    }
}

#[tauri::command]
fn toggle_palette_lock(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut data = load_data(&app);
    if let Some(p) = data.palettes.iter_mut().find(|p| p.id == id) {
        p.locked = Some(!p.locked.unwrap_or(false));
    }
    save_data(&app, &data)
}

#[tauri::command]
fn export_palette_ase(app: tauri::AppHandle, palette_id: String) -> Result<Vec<u8>, String> {
    let data = load_data(&app);
    let palette = data
        .palettes
        .iter()
        .find(|p| p.id == palette_id)
        .ok_or("Palette not found")?;

    let mut bytes: Vec<u8> = Vec::new();

    // ASE file signature
    bytes.extend_from_slice(b"ASEF");
    // Version 1.0
    bytes.extend_from_slice(&[0x00, 0x01, 0x00, 0x00]);

    let mut blocks: Vec<u8> = Vec::new();
    let mut block_count: u32 = 0;

    // Group start block
    {
        blocks.extend_from_slice(&[0xc0, 0x01]); // block type: group start
        let group_name = &palette.name;
        let group_utf16: Vec<u16> = group_name
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let mut group_body: Vec<u8> = Vec::new();
        group_body.extend_from_slice(&(group_utf16.len() as u16).to_be_bytes());
        for unit in group_utf16 {
            group_body.extend_from_slice(&unit.to_be_bytes());
        }
        blocks.extend_from_slice(&(group_body.len() as u32).to_be_bytes());
        blocks.extend_from_slice(&group_body);
        block_count += 1;
    }

    // Color blocks
    for color in &palette.colors {
        let hex = color.hex.trim_start_matches('#');
        if hex.len() != 6 {
            continue;
        }
        let r = u8::from_str_radix(&hex[0..2], 16).map_err(|e| e.to_string())? as f32 / 255.0;
        let g = u8::from_str_radix(&hex[2..4], 16).map_err(|e| e.to_string())? as f32 / 255.0;
        let b = u8::from_str_radix(&hex[4..6], 16).map_err(|e| e.to_string())? as f32 / 255.0;

        blocks.extend_from_slice(&[0x00, 0x01]); // block type: color

        let mut body: Vec<u8> = Vec::new();

        // Color name: use custom name if set, otherwise hex without #
        let name = color.name.as_deref().unwrap_or(hex);
        let name_utf16: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
        body.extend_from_slice(&(name_utf16.len() as u16).to_be_bytes());
        for unit in name_utf16 {
            body.extend_from_slice(&unit.to_be_bytes());
        }

        // Color model: RGB
        body.extend_from_slice(b"RGB ");

        // RGB float values big-endian
        body.extend_from_slice(&r.to_be_bytes());
        body.extend_from_slice(&g.to_be_bytes());
        body.extend_from_slice(&b.to_be_bytes());

        // Color type: 0 = global
        body.extend_from_slice(&[0x00, 0x00]);

        blocks.extend_from_slice(&(body.len() as u32).to_be_bytes());
        blocks.extend_from_slice(&body);
        block_count += 1;
    }

    // Group end block
    {
        blocks.extend_from_slice(&[0xc0, 0x02]); // block type: group end
        blocks.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]); // empty body
        block_count += 1;
    }

    bytes.extend_from_slice(&block_count.to_be_bytes());
    bytes.extend_from_slice(&blocks);

    Ok(bytes)
}
// ── App entry ────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Clone)]
struct LospecPaletteResponse {
    name: String,
    author: String,
    colors: Vec<String>,
}

#[tauri::command]
async fn fetch_lospec_palette(slug: String) -> Result<LospecPaletteResponse, String> {
    let url = format!("https://lospec.com/palette-list/{}.json", slug);
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;

    if response.status().as_u16() == 404 {
        return Err("No palette found with that name. Double-check it matches the Lospec URL slug exactly (e.g. 'nintendo-gameboy-bgb').".to_string());
    }
    if !response.status().is_success() {
        return Err(format!("Lospec returned an error ({})", response.status()));
    }

    response
        .json::<LospecPaletteResponse>()
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            set_titlebar_color(&window);
            Ok(())
        })
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
            export_palette_json,
            get_preference,
            set_preference,
            rename_palette,
            rename_folder,
            export_palette_ase,
            toggle_palette_lock,
            pick_color_from_screen,
            fetch_lospec_palette,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
