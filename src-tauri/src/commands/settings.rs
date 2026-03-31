use std::collections::HashMap;
use tauri::{command, State};

use crate::db;
use crate::error::AppError;
use crate::state::AppState;

#[command]
pub async fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, AppError> {
    db::settings::get_async(state.db.clone(), key).await
}

#[command]
pub async fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), AppError> {
    db::settings::set_async(state.db.clone(), key, value).await
}

#[command]
pub async fn get_all_settings(state: State<'_, AppState>) -> Result<HashMap<String, String>, AppError> {
    db::settings::get_all_async(state.db.clone()).await
}

#[command]
pub async fn delete_setting(state: State<'_, AppState>, key: String) -> Result<(), AppError> {
    db::settings::delete_async(state.db.clone(), key).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};
    use rusqlite::Connection;
    
    use crate::db::migrations;

    // Helper to create an in-memory db with schema
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
        // Because Tauri's `State` isn't easily instantiable outside of a running app context,
        // we test the core logic that the commands run, using the exact same closure blocks.
        let db_conn = in_memory_db();

        // set_setting logic
        let set_db = db_conn.clone();
        tokio::task::spawn_blocking(move || {
            let conn = set_db.lock().unwrap();
            db::settings::set(&conn, "theme", "\"dark\"")
        })
        .await
        .unwrap()
        .unwrap();

        // get_setting logic
        let get_db = db_conn.clone();
        let val = tokio::task::spawn_blocking(move || {
            let conn = get_db.lock().unwrap();
            db::settings::get(&conn, "theme")
        })
        .await
        .unwrap()
        .unwrap();
        assert_eq!(val, Some("\"dark\"".to_owned()));

        // get_all_settings logic
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
}
