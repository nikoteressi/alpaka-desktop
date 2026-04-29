use rusqlite::Connection;

use crate::db::DbConn;
use crate::error::AppError;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct ModelUserDataRow {
    pub name: String,
    pub is_favorite: bool,
    pub tags: Vec<String>,
}

/// Toggle is_favorite for a model. Upserts the row. Returns the new is_favorite state.
pub fn toggle_favorite(conn: &Connection, name: &str) -> Result<bool, AppError> {
    let current: i32 = match conn.query_row(
        "SELECT is_favorite FROM model_user_data WHERE name = ?1",
        rusqlite::params![name],
        |row| row.get(0),
    ) {
        Ok(v) => v,
        Err(rusqlite::Error::QueryReturnedNoRows) => 0,
        Err(e) => return Err(AppError::from(e)),
    };

    let new_favorite = current == 0;
    let new_favorite_int = if new_favorite { 1 } else { 0 };

    conn.execute(
        "INSERT INTO model_user_data (name, is_favorite, tags_json, updated_at)
         VALUES (?1, ?2, '[]', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT(name) DO UPDATE SET is_favorite = excluded.is_favorite, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')",
        rusqlite::params![name, new_favorite_int],
    )?;

    Ok(new_favorite)
}

/// Set (replace) all user tags for a model. Upserts the row.
pub fn set_tags(conn: &Connection, name: &str, tags: &[String]) -> Result<(), AppError> {
    let tags_json = serde_json::to_string(tags).map_err(|e| AppError::Internal(e.to_string()))?;

    conn.execute(
        "INSERT INTO model_user_data (name, is_favorite, tags_json, updated_at)
         VALUES (?1, 0, ?2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT(name) DO UPDATE SET tags_json = excluded.tags_json, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')",
        rusqlite::params![name, tags_json],
    )?;

    Ok(())
}

/// Return all rows in model_user_data.
pub fn list_all(conn: &Connection) -> Result<Vec<ModelUserDataRow>, AppError> {
    let mut stmt = conn.prepare("SELECT name, is_favorite, tags_json FROM model_user_data")?;

    let rows = stmt.query_map([], |row| {
        let name: String = row.get(0)?;
        let is_favorite: i32 = row.get(1)?;
        let tags_json: String = row.get(2)?;

        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_else(|e| {
            tracing::warn!("Failed to parse tags_json for model '{}': {}", name, e);
            Vec::new()
        });

        Ok(ModelUserDataRow {
            name,
            is_favorite: is_favorite != 0,
            tags,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }

    Ok(result)
}

/// Async wrapper for toggle_favorite.
pub async fn toggle_favorite_async(db: DbConn, name: String) -> Result<bool, AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        toggle_favorite(&conn, &name)
    })
    .await?
}

/// Async wrapper for set_tags.
pub async fn set_tags_async(db: DbConn, name: String, tags: Vec<String>) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        set_tags(&conn, &name, &tags)
    })
    .await?
}

/// Async wrapper for list_all.
pub async fn list_all_async(db: DbConn) -> Result<Vec<ModelUserDataRow>, AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        list_all(&conn)
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
    fn test_toggle_favorite_new_model() {
        let conn = in_memory_db();
        let result = toggle_favorite(&conn, "llama3:latest").unwrap();
        assert!(result);

        let current: i32 = conn
            .query_row(
                "SELECT is_favorite FROM model_user_data WHERE name = ?1",
                rusqlite::params!["llama3:latest"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(current, 1);
    }

    #[test]
    fn test_toggle_favorite_twice() {
        let conn = in_memory_db();
        let first = toggle_favorite(&conn, "qwen2.5:latest").unwrap();
        assert!(first);

        let second = toggle_favorite(&conn, "qwen2.5:latest").unwrap();
        assert!(!second);

        let current: i32 = conn
            .query_row(
                "SELECT is_favorite FROM model_user_data WHERE name = ?1",
                rusqlite::params!["qwen2.5:latest"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(current, 0);
    }

    #[test]
    fn test_set_tags_new_model() {
        let conn = in_memory_db();
        let tags = vec!["favorite".to_string(), "work".to_string()];
        set_tags(&conn, "mistral:latest", &tags).unwrap();

        let tags_json: String = conn
            .query_row(
                "SELECT tags_json FROM model_user_data WHERE name = ?1",
                rusqlite::params!["mistral:latest"],
                |row| row.get(0),
            )
            .unwrap();

        let retrieved: Vec<String> = serde_json::from_str(&tags_json).unwrap();
        assert_eq!(retrieved, vec!["favorite", "work"]);
    }

    #[test]
    fn test_set_tags_overwrites_previous() {
        let conn = in_memory_db();
        let first_tags = vec!["old".to_string()];
        set_tags(&conn, "phi:latest", &first_tags).unwrap();

        let second_tags = vec!["new1".to_string(), "new2".to_string()];
        set_tags(&conn, "phi:latest", &second_tags).unwrap();

        let tags_json: String = conn
            .query_row(
                "SELECT tags_json FROM model_user_data WHERE name = ?1",
                rusqlite::params!["phi:latest"],
                |row| row.get(0),
            )
            .unwrap();

        let retrieved: Vec<String> = serde_json::from_str(&tags_json).unwrap();
        assert_eq!(retrieved, vec!["new1", "new2"]);
    }

    #[test]
    fn test_list_all_empty() {
        let conn = in_memory_db();
        let result = list_all(&conn).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_list_all_multiple_rows() {
        let conn = in_memory_db();
        toggle_favorite(&conn, "model1:latest").unwrap();
        set_tags(&conn, "model2:latest", &vec!["tag1".to_string()]).unwrap();

        let result = list_all(&conn).unwrap();
        assert_eq!(result.len(), 2);

        let model1 = result.iter().find(|r| r.name == "model1:latest").unwrap();
        assert!(model1.is_favorite);
        assert!(model1.tags.is_empty());

        let model2 = result.iter().find(|r| r.name == "model2:latest").unwrap();
        assert!(!model2.is_favorite);
        assert_eq!(model2.tags, vec!["tag1"]);
    }

    #[tokio::test]
    async fn test_toggle_favorite_async() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )
        .unwrap();
        crate::db::migrations::run(&conn).unwrap();
        let db = Arc::new(Mutex::new(conn));

        let result = toggle_favorite_async(db.clone(), "async-model:latest".to_string())
            .await
            .unwrap();
        assert!(result);
    }

    #[test]
    fn set_tags_preserves_is_favorite() {
        let conn = in_memory_db();
        let model_name = "test-model:latest";

        // Setup: toggle favorite ON
        toggle_favorite(&conn, model_name).unwrap();
        let is_favorite_before: i32 = conn
            .query_row(
                "SELECT is_favorite FROM model_user_data WHERE name = ?1",
                rusqlite::params![model_name],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(is_favorite_before, 1);

        // Then set_tags
        set_tags(
            &conn,
            model_name,
            &vec!["tag1".to_string(), "tag2".to_string()],
        )
        .unwrap();

        // Assert: is_favorite is still 1 after set_tags
        let is_favorite_after: i32 = conn
            .query_row(
                "SELECT is_favorite FROM model_user_data WHERE name = ?1",
                rusqlite::params![model_name],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(is_favorite_after, 1);

        // Also verify tags were set
        let tags_json: String = conn
            .query_row(
                "SELECT tags_json FROM model_user_data WHERE name = ?1",
                rusqlite::params![model_name],
                |row| row.get(0),
            )
            .unwrap();
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap();
        assert_eq!(tags, vec!["tag1", "tag2"]);
    }

    #[test]
    fn toggle_favorite_preserves_tags() {
        let conn = in_memory_db();
        let model_name = "test-model2:latest";

        // Setup: set_tags to ["code", "fast"]
        set_tags(
            &conn,
            model_name,
            &vec!["code".to_string(), "fast".to_string()],
        )
        .unwrap();
        let tags_json_before: String = conn
            .query_row(
                "SELECT tags_json FROM model_user_data WHERE name = ?1",
                rusqlite::params![model_name],
                |row| row.get(0),
            )
            .unwrap();
        let tags_before: Vec<String> = serde_json::from_str(&tags_json_before).unwrap();
        assert_eq!(tags_before, vec!["code", "fast"]);

        // Then toggle_favorite
        toggle_favorite(&conn, model_name).unwrap();

        // Assert: tags are still ["code", "fast"] after toggle
        let tags_json_after: String = conn
            .query_row(
                "SELECT tags_json FROM model_user_data WHERE name = ?1",
                rusqlite::params![model_name],
                |row| row.get(0),
            )
            .unwrap();
        let tags_after: Vec<String> = serde_json::from_str(&tags_json_after).unwrap();
        assert_eq!(tags_after, vec!["code", "fast"]);

        // Also verify is_favorite was toggled (should be 1 since it started at 0)
        let is_favorite: i32 = conn
            .query_row(
                "SELECT is_favorite FROM model_user_data WHERE name = ?1",
                rusqlite::params![model_name],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(is_favorite, 1);
    }
}
