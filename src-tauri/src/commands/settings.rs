use std::collections::HashMap;
use tauri::{command, State};

use crate::db;
use crate::error::AppError;
use crate::state::AppState;

const ALLOWED_SETTING_KEYS: &[&str] = &[
    "theme",
    "sidebarCollapsed",
    "fontSize",
    "compactMode",
    "chatOptions",
    "cloud",
    "autoUpdate",
    "exposeNetwork",
    "modelPath",
    "serverUrl",
    "showPerformanceMetrics",
    "notificationsEnabled",
    "globalSystemPrompt",
    "systemFormattingEnabled",
    "systemFormattingTemplate",
    "systemSearchTemplate",
    "systemFolderTemplate",
    "presets",
    "defaultPresetId",
    "userPresets",
];

fn validate_setting_key(key: &str) -> Result<(), AppError> {
    if ALLOWED_SETTING_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(AppError::Validation(format!("unknown setting key: {key}")))
    }
}

#[command]
pub async fn get_setting(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, AppError> {
    db::settings::get_async(state.db.clone(), key).await
}

#[command]
pub async fn set_setting(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    validate_setting_key(&key)?;
    db::settings::set_async(state.db.clone(), key, value).await
}

#[command]
pub async fn get_all_settings(
    state: State<'_, AppState>,
) -> Result<HashMap<String, String>, AppError> {
    db::settings::get_all_async(state.db.clone()).await
}

#[command]
pub async fn delete_setting(state: State<'_, AppState>, key: String) -> Result<(), AppError> {
    validate_setting_key(&key)?;
    db::settings::delete_async(state.db.clone(), key).await
}

#[command]
pub async fn delete_all_settings(state: State<'_, AppState>) -> Result<(), AppError> {
    db::settings::clear_all_async(state.db.clone()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};

    use crate::db::migrations;

    fn in_memory_db() -> db::DbConn {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )
        .unwrap();
        migrations::run(&conn).unwrap();
        Arc::new(Mutex::new(conn))
    }

    #[tokio::test]
    async fn test_settings_commands() {
        let db_conn = in_memory_db();

        let set_db = db_conn.clone();
        tokio::task::spawn_blocking(move || {
            let conn = set_db.lock().unwrap();
            db::settings::set(&conn, "theme", "\"dark\"")
        })
        .await
        .unwrap()
        .unwrap();

        let get_db = db_conn.clone();
        let val = tokio::task::spawn_blocking(move || {
            let conn = get_db.lock().unwrap();
            db::settings::get(&conn, "theme")
        })
        .await
        .unwrap()
        .unwrap();
        assert_eq!(val, Some("\"dark\"".to_owned()));

        let get_all_db = db_conn.clone();
        let all = tokio::task::spawn_blocking(move || {
            let conn = get_all_db.lock().unwrap();
            db::settings::get_all(&conn)
        })
        .await
        .unwrap()
        .unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all["theme"], "\"dark\"");
    }

    #[test]
    fn test_validate_setting_key_known_keys_pass() {
        for key in ALLOWED_SETTING_KEYS {
            assert!(
                validate_setting_key(key).is_ok(),
                "expected {key} to be allowed"
            );
        }
    }

    #[test]
    fn test_validate_setting_key_unknown_key_rejected() {
        assert!(validate_setting_key("__proto__").is_err());
        assert!(validate_setting_key("constructor").is_err());
        assert!(validate_setting_key("arbitrary_key").is_err());
        assert!(validate_setting_key("").is_err());
    }
}
