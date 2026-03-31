pub mod db;
pub mod error;
pub mod state;
mod system;
pub mod auth;
pub mod ollama;
pub mod commands;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::models::list_models,
            commands::models::delete_model,
            commands::models::pull_model,
            commands::auth::login,
            commands::auth::logout,
            commands::auth::get_auth_status,
            commands::hosts::list_hosts,
            commands::hosts::add_host,
            commands::hosts::update_host,
            commands::hosts::delete_host,
            commands::hosts::set_active_host,
            commands::hosts::ping_host,
            commands::chat::send_message,
            commands::chat::export_conversation,
            commands::chat::backup_database,
            commands::service::start_ollama,
            commands::service::stop_ollama,
            commands::service::ollama_service_status,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::settings::delete_setting,
            commands::folders::link_folder,
            commands::folders::unlink_folder,
            commands::folders::list_folder_files,
            commands::folders::update_included_files,
            commands::folders::estimate_tokens,
        ])
        .setup(|app| {
            // ── Logging ────────────────────────────────────────────────────────
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }

            // ── Database ───────────────────────────────────────────────────────
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Could not resolve app data directory");

            std::fs::create_dir_all(&app_data_dir)?;

            let db_conn = db::open(&app_data_dir)
                .expect("Failed to open SQLite database");

            // ── Shared state ───────────────────────────────────────────────────
            app.manage(AppState::new(db_conn));

            // ── System Tray ────────────────────────────────────────────────────
            system::tray::setup(app.handle()).expect("Failed to setup system tray");

            // ── Hosts Manager ──────────────────────────────────────────────────
            commands::hosts::start_host_health_loop(app.handle().clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
