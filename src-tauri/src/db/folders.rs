use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderContext {
    pub id: String,
    pub conversation_id: String,
    pub path: String,
    pub included_files_json: Option<String>,
    pub auto_refresh: bool,
    pub estimated_tokens: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewFolderContext {
    pub conversation_id: String,
    pub path: String,
    pub included_files_json: Option<String>,
    pub auto_refresh: bool,
    pub estimated_tokens: i64,
}

fn row_to_folder_context(row: &rusqlite::Row<'_>) -> rusqlite::Result<FolderContext> {
    Ok(FolderContext {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        path: row.get(2)?,
        included_files_json: row.get(3)?,
        auto_refresh: row.get::<_, i64>(4)? != 0,
        estimated_tokens: row.get(5)?,
        created_at: row.get(6)?,
    })
}

pub fn add_folder_context(
    conn: &Connection,
    new: NewFolderContext,
) -> Result<FolderContext, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    conn.execute(
        "INSERT INTO folder_contexts (id, conversation_id, path, included_files_json, auto_refresh, estimated_tokens, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            new.conversation_id,
            new.path,
            new.included_files_json,
            new.auto_refresh as i64,
            new.estimated_tokens,
            now
        ],
    )?;

    get_folder_context(conn, &id)
}

pub fn get_folder_context(conn: &Connection, id: &str) -> Result<FolderContext, AppError> {
    conn.query_row(
        "SELECT id, conversation_id, path, included_files_json, auto_refresh, estimated_tokens, created_at 
         FROM folder_contexts WHERE id = ?1",
        params![id],
        row_to_folder_context,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Folder context '{id}' not found")),
        other => AppError::from(other),
    })
}

pub fn get_by_conversation(
    conn: &Connection,
    conversation_id: &str,
) -> Result<Vec<FolderContext>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, path, included_files_json, auto_refresh, estimated_tokens, created_at 
         FROM folder_contexts WHERE conversation_id = ?1 ORDER BY created_at ASC"
    )?;

    let rows = stmt.query_map(params![conversation_id], row_to_folder_context)?;
    rows.map(|r| r.map_err(AppError::from))
        .collect::<Result<Vec<_>, _>>()
}

pub fn get_by_conversation_and_path(
    conn: &Connection,
    conversation_id: &str,
    path: &str,
) -> Result<Option<FolderContext>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, path, included_files_json, auto_refresh, estimated_tokens, created_at 
         FROM folder_contexts WHERE conversation_id = ?1 AND path = ?2"
    )?;

    let mut rows = stmt.query_map(params![conversation_id, path], row_to_folder_context)?;
    if let Some(result) = rows.next() {
        return Ok(Some(result.map_err(AppError::from)?));
    }
    Ok(None)
}

pub fn delete_folder_context(conn: &Connection, id: &str) -> Result<(), AppError> {
    let changed = conn.execute("DELETE FROM folder_contexts WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound(format!(
            "Folder context '{id}' not found"
        )));
    }
    Ok(())
}

pub fn update_folder_context(
    conn: &Connection,
    id: &str,
    included_files_json: Option<String>,
    estimated_tokens: i64,
) -> Result<(), AppError> {
    let changed = conn.execute(
        "UPDATE folder_contexts SET included_files_json = ?1, estimated_tokens = ?2 WHERE id = ?3",
        params![included_files_json, estimated_tokens, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!(
            "Folder context '{id}' not found"
        )));
    }
    Ok(())
}

pub fn update_token_estimate(conn: &Connection, id: &str, tokens: i64) -> Result<(), AppError> {
    let changed = conn.execute(
        "UPDATE folder_contexts SET estimated_tokens = ?1 WHERE id = ?2",
        params![tokens, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!(
            "Folder context '{id}' not found"
        )));
    }
    Ok(())
}

pub fn set_auto_refresh_flag(conn: &Connection, id: &str, enabled: bool) -> Result<(), AppError> {
    let changed = conn.execute(
        "UPDATE folder_contexts SET auto_refresh = ?1 WHERE id = ?2",
        params![enabled as i64, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!(
            "Folder context '{id}' not found"
        )));
    }
    Ok(())
}

pub fn get_auto_refresh_contexts(
    conn: &Connection,
    conversation_id: &str,
) -> Result<Vec<FolderContext>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, path, included_files_json, auto_refresh, estimated_tokens, created_at
         FROM folder_contexts WHERE conversation_id = ?1 AND auto_refresh = 1",
    )?;
    let rows = stmt.query_map(params![conversation_id], row_to_folder_context)?;
    rows.map(|r| r.map_err(AppError::from))
        .collect::<Result<Vec<_>, _>>()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn in_memory_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )
        .unwrap();
        migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn test_add_and_get_folder_context() {
        let conn = in_memory_conn();
        // Since conversation_id references conversations(id), we need a dummy conversation.
        conn.execute("INSERT INTO conversations (id) VALUES ('dummy-conv')", [])
            .unwrap();

        let new_ctx = NewFolderContext {
            conversation_id: "dummy-conv".into(),
            path: "/a/b/c".into(),
            included_files_json: Some("[\"a.txt\"]".into()),
            auto_refresh: true,
            estimated_tokens: 1234,
        };

        let ctx = add_folder_context(&conn, new_ctx.clone()).unwrap();
        assert_eq!(ctx.conversation_id, "dummy-conv");
        assert_eq!(ctx.path, "/a/b/c");
        assert!(ctx.auto_refresh);
        assert_eq!(ctx.estimated_tokens, 1234);

        let fetched = get_folder_context(&conn, &ctx.id).unwrap();
        assert_eq!(fetched.id, ctx.id);
    }

    #[test]
    fn test_get_by_conversation() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO conversations (id) VALUES ('conv1'), ('conv2')",
            [],
        )
        .unwrap();

        add_folder_context(
            &conn,
            NewFolderContext {
                conversation_id: "conv1".into(),
                path: "/path/1".into(),
                included_files_json: None,
                auto_refresh: false,
                estimated_tokens: 10,
            },
        )
        .unwrap();
        add_folder_context(
            &conn,
            NewFolderContext {
                conversation_id: "conv1".into(),
                path: "/path/2".into(),
                included_files_json: None,
                auto_refresh: false,
                estimated_tokens: 20,
            },
        )
        .unwrap();

        let list1 = get_by_conversation(&conn, "conv1").unwrap();
        assert_eq!(list1.len(), 2);

        let list2 = get_by_conversation(&conn, "conv2").unwrap();
        assert_eq!(list2.len(), 0);
    }

    #[test]
    fn update_token_estimate_changes_only_tokens() {
        let conn = in_memory_conn();
        conn.execute("INSERT INTO conversations (id) VALUES ('c1')", [])
            .unwrap();
        let ctx = add_folder_context(
            &conn,
            NewFolderContext {
                conversation_id: "c1".into(),
                path: "/a".into(),
                included_files_json: Some("[\"a.txt\"]".into()),
                auto_refresh: false,
                estimated_tokens: 10,
            },
        )
        .unwrap();

        update_token_estimate(&conn, &ctx.id, 999).unwrap();

        let fetched = get_folder_context(&conn, &ctx.id).unwrap();
        assert_eq!(fetched.estimated_tokens, 999);
        // included_files_json must be untouched
        assert_eq!(fetched.included_files_json, Some("[\"a.txt\"]".into()));
    }

    #[test]
    fn set_auto_refresh_flag_toggles_correctly() {
        let conn = in_memory_conn();
        conn.execute("INSERT INTO conversations (id) VALUES ('c1')", [])
            .unwrap();
        let ctx = add_folder_context(
            &conn,
            NewFolderContext {
                conversation_id: "c1".into(),
                path: "/a".into(),
                included_files_json: None,
                auto_refresh: false,
                estimated_tokens: 0,
            },
        )
        .unwrap();

        set_auto_refresh_flag(&conn, &ctx.id, true).unwrap();
        assert!(get_folder_context(&conn, &ctx.id).unwrap().auto_refresh);

        set_auto_refresh_flag(&conn, &ctx.id, false).unwrap();
        assert!(!get_folder_context(&conn, &ctx.id).unwrap().auto_refresh);
    }

    #[test]
    fn get_auto_refresh_contexts_returns_only_enabled() {
        let conn = in_memory_conn();
        conn.execute("INSERT INTO conversations (id) VALUES ('c1')", [])
            .unwrap();

        add_folder_context(
            &conn,
            NewFolderContext {
                conversation_id: "c1".into(),
                path: "/a".into(),
                included_files_json: None,
                auto_refresh: true,
                estimated_tokens: 0,
            },
        )
        .unwrap();
        add_folder_context(
            &conn,
            NewFolderContext {
                conversation_id: "c1".into(),
                path: "/b".into(),
                included_files_json: None,
                auto_refresh: false,
                estimated_tokens: 0,
            },
        )
        .unwrap();

        let results = get_auto_refresh_contexts(&conn, "c1").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "/a");
    }
}
