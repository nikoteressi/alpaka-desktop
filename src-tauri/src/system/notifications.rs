use crate::db;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;

/// Generic helper to send notifications with optional focus check.
pub fn send_notification<R: Runtime>(
    app: &AppHandle<R>,
    title: &str,
    body: &str,
    relevant_conversation_id: Option<&str>,
) {
    let state = match app.try_state::<crate::state::AppState>() {
        Some(s) => s,
        None => return,
    };

    // 1. Check if notifications are enabled in settings
    let enabled = {
        let db_conn = state.db.clone();
        let conn = match db_conn.lock() {
            Ok(c) => c,
            Err(_) => return,
        };

        match db::settings::get(&conn, "notificationsEnabled") {
            Ok(Some(val)) => val == "true" || val == "\"true\"",
            _ => true,
        }
    };

    if !enabled {
        return;
    }

    // 2. Smart Focus Check
    // We only skip the notification if:
    // a) The window is focused AND
    // b) The user is already looking at the relevant content (active_view == chat && active_conv == relevant_id)
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(true) = window.is_focused() {
            let is_chat_view = *state.is_chat_view.lock().unwrap();
            let current_conv = state.active_conversation_id.lock().unwrap();

            let should_skip = match relevant_conversation_id {
                Some(relevant_id) => is_chat_view && current_conv.as_deref() == Some(relevant_id),
                None => false, // Global notifications (backup, model pull) show even if focused
            };

            if should_skip {
                log::debug!(
                    "Skipping notification '{}' because user is already looking at it",
                    title
                );
                return;
            }
        }
    }

    // 3. Show notification
    log::debug!("Triggering OS notification: {} - {}", title, body);
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .icon("ollama-desktop")
        .show();
}

pub fn notify_model_created<R: Runtime>(app: &AppHandle<R>, name: &str) {
    send_notification(
        app,
        "Model Created",
        &format!("Model '{}' is ready to use.", name),
        None,
    );
}

pub fn notify_model_create_failed<R: Runtime>(app: &AppHandle<R>, name: &str, error: &str) {
    send_notification(
        app,
        "Model Creation Failed",
        &format!("Failed to create '{}': {}", name, error),
        None,
    );
}

pub fn notify_model_create_cancelled<R: Runtime>(app: &AppHandle<R>, name: &str) {
    send_notification(
        app,
        "Model Creation Cancelled",
        &format!("Creation of '{}' was cancelled.", name),
        None,
    );
}

pub fn notify_model_pulled<R: Runtime>(app: &AppHandle<R>, name: &str) {
    send_notification(
        app,
        "Model Downloaded",
        &format!("Model '{}' is ready to use.", name),
        None,
    );
}

pub fn notify_model_pull_failed<R: Runtime>(app: &AppHandle<R>, name: &str, error: &str) {
    send_notification(
        app,
        "Download Failed",
        &format!("Failed to download '{}': {}", name, error),
        None,
    );
}

pub fn notify_host_offline<R: Runtime>(app: &AppHandle<R>, name: &str) {
    send_notification(
        app,
        "Host Offline",
        &format!("Host '{}' is currently unreachable.", name),
        None,
    );
}

pub fn notify_backup_success<R: Runtime>(app: &AppHandle<R>, path: &str) {
    send_notification(
        app,
        "Backup Success",
        &format!("Database backup saved to {}", path),
        None,
    );
}

pub fn notify_restore_success<R: Runtime>(app: &AppHandle<R>) {
    send_notification(
        app,
        "Database Restored",
        "Chat history and settings have been successfully restored.",
        None,
    );
}

pub fn notify_db_operation_failed<R: Runtime>(app: &AppHandle<R>, operation: &str, error: &str) {
    send_notification(
        app,
        "Database Error",
        &format!("Failed to {}: {}", operation, error),
        None,
    );
}

pub fn notify_generation_complete<R: Runtime>(
    app: &AppHandle<R>,
    model_name: &str,
    conversation_id: &str,
) {
    send_notification(
        app,
        "Generation Complete",
        &format!("Model '{}' has finished the response.", model_name),
        Some(conversation_id),
    );
}

pub fn notify_generation_failed<R: Runtime>(
    app: &AppHandle<R>,
    error: &str,
    conversation_id: &str,
) {
    send_notification(
        app,
        "Generation Failed",
        &format!("Error: {}", error),
        Some(conversation_id),
    );
}
