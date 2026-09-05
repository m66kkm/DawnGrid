pub mod commands;

use commands::{close_workbook, get_system_fonts, open_workbook, read_range, AppState};
use std::sync::Mutex;
use xlsx_sidecar::WorkbookSessions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        sessions: Mutex::new(WorkbookSessions::new()),
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_workbook,
            read_range,
            close_workbook,
            get_system_fonts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

