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

#[derive(Serialize, Deserialize, Clone, PartialEq)]
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

/// Write JSON without ever leaving a half-written file on disk.
///
/// `fs::write` truncates the target and then writes into it, so a crash
/// mid-write destroys the old contents without producing valid new ones.
/// Writing to a sibling temp file and renaming avoids that: rename is atomic
/// on the same volume, so the target is always either entirely the old file
/// or entirely the new one.
fn write_json_atomic<T: Serialize>(path: &std::path::Path, value: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| format!("could not write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("could not replace {}: {e}", path.display()))?;
    Ok(())
}

/// Move an unreadable data file aside so its bytes survive for hand-recovery
/// instead of being overwritten by the next save.
fn quarantine(path: &std::path::Path) -> Option<std::path::PathBuf> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let backup = path.with_file_name(format!("magipal.corrupt-{stamp}.json"));
    fs::rename(path, &backup).ok().map(|_| backup)
}

/// A missing file is a legitimate empty state (fresh install). A file that
/// exists but does not parse is an error, NOT an empty state — reporting it as
/// empty would let the next save overwrite recoverable data with nothing.
fn load_data_at(path: &std::path::Path) -> Result<AppData, String> {
    if !path.exists() {
        return Ok(AppData::default());
    }
    let contents =
        fs::read_to_string(path).map_err(|e| format!("could not read {}: {e}", path.display()))?;
    if contents.trim().is_empty() {
        return Ok(AppData::default());
    }
    serde_json::from_str(&contents).map_err(|e| {
        let note = match quarantine(path) {
            Some(backup) => format!("The damaged file was moved to {}.", backup.display()),
            None => "The damaged file could not be moved aside.".to_string(),
        };
        format!("magipal.json is damaged and could not be read ({e}). {note}")
    })
}

fn load_data(app: &tauri::AppHandle) -> Result<AppData, String> {
    load_data_at(&get_data_path(app))
}

fn save_data(app: &tauri::AppHandle, data: &AppData) -> Result<(), String> {
    write_json_atomic(&get_data_path(app), data)
}

// ── Commands ─────────────────────────────────────────────────────

#[tauri::command]
fn load_palettes(app: tauri::AppHandle) -> Result<AppData, String> {
    load_data(&app)
}

/// The lock lives here rather than at each UI call site, so no frontend path --
/// present or future -- can add colors to a locked palette by forgetting to
/// check. Unlocking goes through toggle_palette_lock, which is unaffected.
/// Name and notes are deliberately still editable; the lock protects the colors.
fn check_lock(existing: &Palette, incoming: &Palette) -> Result<(), String> {
    if existing.locked.unwrap_or(false) && existing.colors != incoming.colors {
        return Err("This palette is locked. Unlock it before changing its colors.".to_string());
    }
    Ok(())
}

#[tauri::command]
fn save_palette(app: tauri::AppHandle, palette: Palette) -> Result<(), String> {
    let mut data = load_data(&app)?;
    if let Some(existing) = data.palettes.iter_mut().find(|p| p.id == palette.id) {
        check_lock(existing, &palette)?;
        *existing = palette;
    } else {
        data.palettes.push(palette);
    }
    save_data(&app, &data)
}

#[tauri::command]
fn delete_palette(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut data = load_data(&app)?;
    data.palettes.retain(|p| p.id != id);
    save_data(&app, &data)
}

#[tauri::command]
fn save_folder(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let mut data = load_data(&app)?;
    if !data.folders.contains(&name) {
        data.folders.push(name);
    }
    save_data(&app, &data)
}

#[tauri::command]
fn delete_folder(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let mut data = load_data(&app)?;
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
    let mut data = load_data(&app)?;
    for (i, id) in ids.iter().enumerate() {
        if let Some(p) = data.palettes.iter_mut().find(|p| p.id == *id) {
            p.order = Some(i as i64);
        }
    }
    save_data(&app, &data)
}

#[tauri::command]
fn reorder_folders(app: tauri::AppHandle, names: Vec<String>) -> Result<(), String> {
    let mut data = load_data(&app)?;
    data.folders = names;
    save_data(&app, &data)
}

#[tauri::command]
fn move_palette_to_folder(
    app: tauri::AppHandle,
    palette_id: String,
    folder: Option<String>,
) -> Result<(), String> {
    let mut data = load_data(&app)?;
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
    write_json_atomic(&path, &colors)
}

#[tauri::command]
fn export_palette_json(app: tauri::AppHandle, palette_id: String) -> Result<String, String> {
    let data = load_data(&app)?;
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
    write_json_atomic(&path, &prefs)
}

#[tauri::command]
fn rename_palette(app: tauri::AppHandle, id: String, name: String) -> Result<(), String> {
    let mut data = load_data(&app)?;
    if let Some(p) = data.palettes.iter_mut().find(|p| p.id == id) {
        p.name = name;
    }
    save_data(&app, &data)
}

#[tauri::command]
fn rename_folder(app: tauri::AppHandle, old_name: String, new_name: String) -> Result<(), String> {
    let mut data = load_data(&app)?;
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
    let mut data = load_data(&app)?;
    if let Some(p) = data.palettes.iter_mut().find(|p| p.id == id) {
        p.locked = Some(!p.locked.unwrap_or(false));
    }
    save_data(&app, &data)
}

#[tauri::command]
fn export_palette_ase(app: tauri::AppHandle, palette_id: String) -> Result<Vec<u8>, String> {
    let data = load_data(&app)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("magipal-test-{tag}-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn palette(name: &str) -> Palette {
        Palette {
            id: name.to_string(),
            name: name.to_string(),
            colors: vec![Color {
                hex: "#ff0000".into(),
                name: None,
            }],
            folder: None,
            created_at: 0,
            order: None,
            locked: None,
            notes: None,
            author: None,
        }
    }

    #[test]
    fn missing_file_is_an_empty_app_not_an_error() {
        let dir = temp_dir("missing");
        let data = load_data_at(&dir.join("magipal.json")).expect("fresh install must load");
        assert!(data.palettes.is_empty());
    }

    #[test]
    fn damaged_file_errors_instead_of_reporting_empty() {
        // The disaster this fix exists to prevent: a truncated file used to
        // parse as "no palettes", and the next save would overwrite it.
        let dir = temp_dir("damaged");
        let path = dir.join("magipal.json");
        fs::write(&path, r#"{"palettes":[{"id":"a","na"#).unwrap();

        let result = load_data_at(&path);
        assert!(result.is_err(), "a truncated file must not load as empty");
    }

    #[test]
    fn damaged_file_is_quarantined_not_destroyed() {
        let dir = temp_dir("quarantine");
        let path = dir.join("magipal.json");
        let junk = r#"{"palettes":[{"id":"a","na"#;
        fs::write(&path, junk).unwrap();

        let _ = load_data_at(&path);

        let salvaged: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with("magipal.corrupt-"))
            .collect();
        assert_eq!(salvaged.len(), 1, "damaged bytes must be preserved");
        assert_eq!(fs::read_to_string(salvaged[0].path()).unwrap(), junk);
    }

    fn locked(mut p: Palette) -> Palette {
        p.locked = Some(true);
        p
    }

    fn with_colors(mut p: Palette, hexes: &[&str]) -> Palette {
        p.colors = hexes
            .iter()
            .map(|h| Color {
                hex: h.to_string(),
                name: None,
            })
            .collect();
        p
    }

    #[test]
    fn locked_palette_refuses_added_colors() {
        let existing = locked(with_colors(palette("Shipped"), &["#ff0000"]));
        let incoming = with_colors(palette("Shipped"), &["#ff0000", "#00ff00"]);
        assert!(check_lock(&existing, &incoming).is_err());
    }

    #[test]
    fn locked_palette_refuses_removed_or_edited_colors() {
        let existing = locked(with_colors(palette("Shipped"), &["#ff0000", "#00ff00"]));

        let removed = with_colors(palette("Shipped"), &["#ff0000"]);
        assert!(check_lock(&existing, &removed).is_err());

        let edited = with_colors(palette("Shipped"), &["#ff0000", "#0000ff"]);
        assert!(check_lock(&existing, &edited).is_err());
    }

    #[test]
    fn locked_palette_still_accepts_notes_and_rename() {
        // The lock protects the colors, not the metadata.
        let existing = locked(with_colors(palette("Shipped"), &["#ff0000"]));
        let mut renamed = with_colors(palette("Shipped"), &["#ff0000"]);
        renamed.name = "Shipped v2".into();
        renamed.notes = Some("final".into());
        assert!(check_lock(&existing, &renamed).is_ok());
    }

    #[test]
    fn unlocked_palette_accepts_color_changes() {
        let existing = with_colors(palette("Draft"), &["#ff0000"]);
        let incoming = with_colors(palette("Draft"), &["#ff0000", "#00ff00"]);
        assert!(check_lock(&existing, &incoming).is_ok());
    }

    #[test]
    fn atomic_write_round_trips() {
        let dir = temp_dir("roundtrip");
        let path = dir.join("magipal.json");
        let data = AppData {
            palettes: vec![palette("Dawn")],
            folders: vec!["Games".into()],
        };

        write_json_atomic(&path, &data).unwrap();
        let loaded = load_data_at(&path).unwrap();

        assert_eq!(loaded.palettes.len(), 1);
        assert_eq!(loaded.palettes[0].name, "Dawn");
        assert_eq!(loaded.folders, vec!["Games".to_string()]);
    }

    #[test]
    fn atomic_write_leaves_no_temp_file_behind() {
        let dir = temp_dir("notmp");
        let path = dir.join("magipal.json");
        write_json_atomic(&path, &AppData::default()).unwrap();

        assert!(!path.with_extension("json.tmp").exists());
    }
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
