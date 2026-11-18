mod attachment_commands;
mod attachment_storage;
mod diary_commands;
mod diary_storage;
mod error;
mod external_link;
mod platform;
#[cfg(target_os = "macos")]
mod scroll_phase;
mod workspace;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let settings_path = workspace::settings_path(app.handle())
                .map_err(|error| std::io::Error::other(error.message))?;
            app.manage(workspace::WorkspaceState::new(settings_path));
            #[cfg(target_os = "macos")]
            scroll_phase::install(app.handle());
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            workspace::get_workspace_status,
            workspace::choose_diary_root,
            workspace::save_ui_preferences,
            workspace::save_theme,
            diary_commands::list_diaries,
            diary_commands::read_diary,
            diary_commands::save_diary,
            diary_commands::rename_diary,
            diary_commands::trash_diary,
            attachment_commands::import_attachment,
            attachment_commands::preview_attachment,
            attachment_commands::open_attachment,
            external_link::open_external_link,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
