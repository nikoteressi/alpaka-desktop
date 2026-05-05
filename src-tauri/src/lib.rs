pub mod auth;
pub mod commands;
pub mod db;
pub mod error;
pub mod ollama;
pub mod services;
pub mod state;
mod system;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::models::list_models,
            commands::models::delete_model,
            commands::models::pull_model,
            commands::models::push_model,
            commands::models::get_model_capabilities,
            commands::model_create::get_modelfile,
            commands::model_create::create_model,
            commands::model_create::cancel_model_create,
            commands::model_path::validate_model_path,
            commands::model_path::apply_model_path,
            commands::auth::login,
            commands::auth::logout,
            commands::auth::get_auth_status,
            commands::auth::check_ollama_signed_in,
            commands::auth::get_ollama_username,
            commands::auth::trigger_ollama_signin,
            commands::auth::set_api_key,
            commands::auth::get_api_key_status,
            commands::auth::delete_api_key,
            commands::auth::validate_api_key,
            commands::hosts::list_hosts,
            commands::hosts::add_host,
            commands::hosts::update_host,
            commands::hosts::delete_host,
            commands::hosts::set_active_host,
            commands::hosts::ping_host,
            commands::chat::get_messages,
            commands::chat::create_conversation,
            commands::chat::list_conversations,
            commands::chat::delete_conversation,
            commands::chat::update_conversation_title,
            commands::chat::update_conversation_model,
            commands::chat::update_conversation_settings,
            commands::chat::set_conversation_pinned,
            commands::chat::update_system_prompt,
            commands::chat::update_chat_draft,
            commands::chat::send_message,
            commands::chat::stop_generation,
            commands::chat::export_conversation,
            commands::chat::backup_database,
            commands::chat::restore_database,
            commands::chat::compact_conversation,
            commands::service::start_ollama,
            commands::service::stop_ollama,
            commands::service::ollama_service_status,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::settings::delete_setting,
            commands::settings::delete_all_settings,
            commands::proxy::get_proxy_config,
            commands::proxy::save_proxy,
            commands::proxy::delete_proxy,
            commands::proxy::test_proxy,
            commands::model_settings::get_model_defaults,
            commands::model_settings::set_model_defaults,
            commands::model_settings::reset_model_defaults,
            commands::model_user_data::toggle_model_favorite,
            commands::model_user_data::set_model_tags,
            commands::model_user_data::list_model_user_data,
            commands::folders::link_folder,
            commands::folders::unlink_folder,
            commands::folders::get_folder_contexts,
            commands::folders::list_folder_files,
            commands::folders::update_included_files,
            commands::folders::estimate_tokens,
            commands::library::search_ollama_library,
            commands::library::get_library_tags,
            commands::library::get_library_model_readme,
            commands::library::get_user_models,
            commands::system_info::detect_hardware,
            commands::system::report_active_view,
            commands::system::open_browser,
            commands::model_updates::get_models_with_updates,
            commands::model_updates::check_model_updates,
            commands::attachments::read_image_file,
        ])
        .setup(|app| {
            // ── Logging (MED-08: enabled in all builds) ────────────────────────
            let log_level = log::LevelFilter::Info;
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .build(),
            )?;

            // ── Keyring health check ───────────────────────────────────────────
            #[cfg(not(feature = "test-mode"))]
            if !crate::auth::keyring::check_keyring_available() {
                log::warn!(
                    "System keyring is unavailable. Credentials cannot be stored securely. \
                     Ensure your D-Bus session is running and the secret service daemon is active."
                );
            }

            // ── Database ───────────────────────────────────────────────────────
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Could not resolve app data directory");

            std::fs::create_dir_all(&app_data_dir)?;

            let db_path = app_data_dir.join("alpaka-desktop.db");
            let db_conn = db::open(&app_data_dir).expect("Failed to open SQLite database");

            // ── Shared state ───────────────────────────────────────────────────
            let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();
            let state = AppState::new(db_conn, db_path).map_err(|e| {
                tauri::Error::Io(std::io::Error::other(format!(
                    "Failed to build HTTP client: {e}"
                )))
            })?;
            *state
                .health_loop_shutdown
                .lock()
                .expect("health_loop_shutdown lock") = Some(shutdown_tx);
            app.manage(state);

            // ── System Tray ────────────────────────────────────────────────────
            #[cfg(not(feature = "test-mode"))]
            {
                let tray = system::tray::setup(app.handle()).expect("Failed to setup system tray");

                // Listen for theme changes on any window to update the tray icon
                if let Some(window) = app.webview_windows().values().next() {
                    let tray_handle = tray.clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::ThemeChanged(theme) = event {
                            // On Linux, the window theme is the best proxy we have for the tray
                            let _ = system::tray::update_icon(&tray_handle, *theme);
                        }
                    });
                }
            }

            // ── Hosts Manager ──────────────────────────────────────────────────
            #[cfg(feature = "test-mode")]
            drop(shutdown_rx);
            #[cfg(not(feature = "test-mode"))]
            {
                let health_handle =
                    commands::hosts::start_host_health_loop(app.handle().clone(), shutdown_rx);
                *app.state::<AppState>().health_loop_handle.lock().unwrap() = Some(health_handle);
            }

            // ── Model update check loop ────────────────────────────────────────
            #[cfg(not(feature = "test-mode"))]
            {
                let (upd_shutdown_tx, upd_shutdown_rx) = tokio::sync::oneshot::channel();
                *app.state::<AppState>()
                    .update_check_loop_shutdown
                    .lock()
                    .unwrap() = Some(upd_shutdown_tx);
                let _ = tauri::async_runtime::spawn(
                    crate::services::model_updates::run_update_check_loop(
                        app.handle().clone(),
                        upd_shutdown_rx,
                    ),
                );
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
