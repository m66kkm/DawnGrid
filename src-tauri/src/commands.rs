use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use xlsx_sidecar::{
    CellRange, RangeResult, WorkbookMetadata, WorkbookSessions,
};

pub struct AppState {
    pub sessions: Mutex<WorkbookSessions>,
}

#[tauri::command]
pub fn open_workbook(
    state: State<AppState>,
    path: String,
    locale: Option<String>,
) -> Result<WorkbookMetadata, String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let path_buf = PathBuf::from(&path);
    let loc = locale.as_deref().unwrap_or("zh");
    sessions
        .open_with_locale(&path_buf, loc, None)
        .map_err(|e| format!("Failed to open workbook: {}", e))
}

#[tauri::command]
pub fn read_range(
    state: State<AppState>,
    session_id: String,
    sheet_id: String,
    start_row: usize,
    end_row: usize,
    start_column: usize,
    end_column: usize,
) -> Result<RangeResult, String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let range = CellRange {
        start_row,
        end_row,
        start_column,
        end_column,
    };
    sessions
        .read_range(&session_id, &sheet_id, &range)
        .map_err(|e| format!("Failed to read range: {}", e))
}

#[tauri::command]
pub fn close_workbook(state: State<AppState>, session_id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions
        .close(&session_id)
        .map_err(|e| format!("Failed to close workbook: {}", e))
}

#[tauri::command]
pub fn get_system_fonts() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        use std::collections::BTreeSet;
        use winreg::enums::*;
        use winreg::RegKey;

        let mut font_names = BTreeSet::new();
        let paths = [
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"),
            (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"),
        ];

        for (hkey, subkey) in paths {
            if let Ok(reg_key) = RegKey::predef(hkey).open_subkey(subkey) {
                for (name, _) in reg_key.enum_values().flatten() {
                    let cleaned = if let Some(idx) = name.find('(') {
                        name[..idx].trim()
                    } else {
                        name.trim()
                    };

                    for part in cleaned.split('&') {
                        let mut part = part.trim();
                        let suffixes = [
                            " Bold Italic", " Bold", " Italic", " Light Italic",
                            " Light", " Semibold", " SemiBold", " Medium",
                            " Black", " Heavy", " ExtraBold", " Thin", " ExtraLight", " Regular"
                        ];
                        for s in &suffixes {
                            if part.ends_with(s) {
                                part = part[..part.len() - s.len()].trim();
                            }
                        }
                        if !part.is_empty() {
                            font_names.insert(part.to_string());
                        }
                    }
                }
            }
        }

        if !font_names.is_empty() {
            return font_names.into_iter().collect();
        }
    }

    vec![
        "Aptos".to_string(),
        "Arial".to_string(),
        "Calibri".to_string(),
        "Cambria".to_string(),
        "Comic Sans MS".to_string(),
        "Consolas".to_string(),
        "Courier New".to_string(),
        "Georgia".to_string(),
        "Impact".to_string(),
        "Microsoft YaHei".to_string(),
        "Segoe UI".to_string(),
        "SimHei".to_string(),
        "SimSun".to_string(),
        "Tahoma".to_string(),
        "Times New Roman".to_string(),
        "Trebuchet MS".to_string(),
        "Verdana".to_string(),
    ]
}

