use rusqlite::Connection;

use crate::db::DbConn;
use crate::error::AppError;
use crate::ollama::types::ChatOptions;

pub fn get(conn: &Connection, model_name: &str) -> Result<Option<ChatOptions>, AppError> {
    let result: rusqlite::Result<String> = conn.query_row(
        "SELECT defaults_json FROM model_settings WHERE model_name = ?1",
        rusqlite::params![model_name],
        |row| row.get(0),
    );
    match result {
        Ok(json) => {
            let opts: ChatOptions =
                serde_json::from_str(&json).map_err(|e| AppError::Internal(e.to_string()))?;
            if opts.temperature.is_none()
                && opts.top_p.is_none()
                && opts.top_k.is_none()
                && opts.num_predict.is_none()
                && opts.num_ctx.is_none()
                && opts.repeat_penalty.is_none()
                && opts.repeat_last_n.is_none()
                && opts.seed.is_none()
                && opts.stop.is_none()
            {
                Ok(None)
            } else {
                Ok(Some(opts))
            }
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::from(e)),
    }
}

pub fn set(conn: &Connection, model_name: &str, defaults: &ChatOptions) -> Result<(), AppError> {
    let json = serde_json::to_string(defaults).map_err(|e| AppError::Internal(e.to_string()))?;
    conn.execute(
        "INSERT OR REPLACE INTO model_settings (model_name, defaults_json, updated_at)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
        rusqlite::params![model_name, json],
    )?;
    Ok(())
}

pub async fn get_async(db: DbConn, model_name: String) -> Result<Option<ChatOptions>, AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        get(&conn, &model_name)
    })
    .await?
}

pub async fn set_async(
    db: DbConn,
    model_name: String,
    defaults: ChatOptions,
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        set(&conn, &model_name, &defaults)
    })
    .await?
}

pub fn delete(conn: &Connection, model_name: &str) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM model_settings WHERE model_name = ?1",
        rusqlite::params![model_name],
    )?;
    Ok(())
}

pub async fn delete_async(db: DbConn, model_name: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        delete(&conn, &model_name)
    })
    .await?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    fn in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )
        .unwrap();
        crate::db::migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn test_get_missing_model_returns_none() {
        let conn = in_memory_db();
        let result = get(&conn, "nonexistent:7b").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_set_and_get_defaults() {
        let conn = in_memory_db();
        let opts = ChatOptions {
            temperature: Some(0.1),
            top_k: Some(20),
            num_ctx: Some(8192),
            ..Default::default()
        };
        set(&conn, "qwen2.5-coder:14b", &opts).unwrap();
        let retrieved = get(&conn, "qwen2.5-coder:14b").unwrap().unwrap();
        assert_eq!(retrieved.temperature, Some(0.1));
        assert_eq!(retrieved.top_k, Some(20));
        assert_eq!(retrieved.num_ctx, Some(8192));
    }

    #[test]
    fn test_upsert_overwrites_previous_value() {
        let conn = in_memory_db();
        let first = ChatOptions {
            temperature: Some(0.5),
            ..Default::default()
        };
        set(&conn, "llama3:latest", &first).unwrap();
        let second = ChatOptions {
            temperature: Some(0.9),
            ..Default::default()
        };
        set(&conn, "llama3:latest", &second).unwrap();
        let result = get(&conn, "llama3:latest").unwrap().unwrap();
        assert_eq!(result.temperature, Some(0.9));
    }

    #[test]
    fn test_all_none_chatops_returns_none() {
        let conn = in_memory_db();
        let empty = ChatOptions::default();
        set(&conn, "empty-model:latest", &empty).unwrap();
        let result = get(&conn, "empty-model:latest").unwrap();
        assert!(result.is_none(), "all-None ChatOptions should return None");
    }

    #[tokio::test]
    async fn test_async_round_trip() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )
        .unwrap();
        crate::db::migrations::run(&conn).unwrap();
        let db = Arc::new(Mutex::new(conn));

        let opts = ChatOptions {
            temperature: Some(0.3),
            ..Default::default()
        };
        set_async(db.clone(), "llama3:latest".to_string(), opts)
            .await
            .unwrap();

        let result = get_async(db.clone(), "llama3:latest".to_string())
            .await
            .unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().temperature, Some(0.3));
    }
}
