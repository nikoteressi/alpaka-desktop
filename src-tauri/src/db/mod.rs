pub mod compaction_events;
pub mod conversations;
pub mod folders;
pub mod hosts;
pub mod messages;
pub mod migrations;
pub mod model_settings;
pub mod model_user_data;
pub mod repo;
pub mod settings;

use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use crate::error::AppError;
#[cfg(not(feature = "test-mode"))]
use keyring::Entry;
use rusqlite::{params, Connection};
use uuid::Uuid;

#[cfg(not(feature = "test-mode"))]
const DB_KEY_SERVICE: &str = "alpaka-desktop-internal";
#[cfg(not(feature = "test-mode"))]
const DB_KEY_ACCOUNT: &str = "database-encryption-key";

/// A cloneable, thread-safe handle to the SQLite connection.
pub type DbConn = Arc<Mutex<Connection>>;

/// Open (or create) the application database and return a shared connection.
pub fn open(app_data_dir: &Path) -> Result<DbConn, AppError> {
    let db_path = app_data_dir.join("alpaka-desktop.db");

    // Get or create the encryption key from the system keyring
    let db_key = get_or_create_db_key()?;

    // Open the database connection (creates file if not exists)
    let conn = Connection::open(&db_path).map_err(AppError::from)?;

    // Validate key is hex-only before interpolating into PRAGMA.
    // (UUID v4 → remove hyphens → 32 hex chars, no SQL-injectable chars)
    debug_assert!(
        db_key.chars().all(|c| c.is_ascii_hexdigit() || c == '-'),
        "DB key must be a UUID — no special characters allowed"
    );
    let safe_key = db_key.replace('-', "");
    conn.execute_batch(&format!("PRAGMA key = '{}';", safe_key))
        .map_err(AppError::from)?;

    finalize_open(conn)
}

/// Completes the database opening process (PRAGMAs, migrations, seeding).
fn finalize_open(conn: Connection) -> Result<DbConn, AppError> {
    configure_connection(&conn)?;
    migrations::run(&conn)?;
    backfill_thinking_and_strip(&conn)?;
    seed_default_host(&conn)?;
    Ok(Arc::new(Mutex::new(conn)))
}

/// One-time startup hook: extracts <think> content to the `thinking` column
/// and strips all XML from `content` for pre-migration assistant messages.
/// Guarded by the `thinking_backfill_v1` settings key — runs exactly once.
pub fn backfill_thinking_and_strip(conn: &rusqlite::Connection) -> Result<(), AppError> {
    if settings::get(conn, "thinking_backfill_v1")?.as_deref() == Some("done") {
        return Ok(());
    }

    let targets: Vec<(String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT id, content FROM messages
             WHERE role = 'assistant' AND thinking IS NULL AND content LIKE '%<think%'",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(AppError::from)?
    };

    for (id, content) in targets {
        let (thinking, clean) = extract_thinking_from_content(&content);
        conn.execute(
            "UPDATE messages SET thinking = ?1, content = ?2 WHERE id = ?3",
            rusqlite::params![thinking, clean, id],
        )?;
    }

    settings::set(conn, "thinking_backfill_v1", "done")?;
    tracing::info!("thinking_backfill_v1: backfill complete");
    Ok(())
}

fn extract_thinking_from_content(content: &str) -> (Option<String>, String) {
    let thinking = if let Some(open) = content.find("<think") {
        if let Some(tag_end) = content[open..].find('>') {
            let inner_start = open + tag_end + 1;
            if let Some(close) = content.find("</think>") {
                if close >= inner_start {
                    Some(content[inner_start..close].to_string())
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let clean = strip_xml_blocks(content);
    (thinking, clean)
}

fn strip_xml_blocks(content: &str) -> String {
    let mut result = String::with_capacity(content.len());
    let mut remaining = content;
    loop {
        let think_pos = remaining.find("<think");
        let tool_pos = remaining.find("<tool_call");
        let (tag_start, end_tag) = match (think_pos, tool_pos) {
            (None, None) => break,
            (Some(t), None) => (t, "</think>"),
            (None, Some(t)) => (t, "</tool_call>"),
            (Some(a), Some(b)) => {
                if a <= b {
                    (a, "</think>")
                } else {
                    (b, "</tool_call>")
                }
            }
        };
        result.push_str(&remaining[..tag_start]);
        remaining = &remaining[tag_start..];
        if let Some(end_pos) = remaining.find(end_tag) {
            remaining = &remaining[end_pos + end_tag.len()..];
        } else {
            remaining = "";
            break;
        }
    }
    result.push_str(remaining);
    result.trim().to_owned()
}

fn configure_connection(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )
    .map_err(AppError::from)
}

pub fn seed_default_host(conn: &Connection) -> Result<(), AppError> {
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM hosts WHERE name = 'Local'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if count == 0 {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO hosts (id, name, url, is_default, is_active) VALUES (?1, 'Local', 'http://localhost:11434', 1, 1)",
            params![id],
        ).map_err(AppError::from)?;
    }
    Ok(())
}

#[cfg(not(feature = "test-mode"))]
fn get_or_create_db_key() -> Result<String, AppError> {
    let entry = Entry::new(DB_KEY_SERVICE, DB_KEY_ACCOUNT)?;
    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => {
            let new_key = Uuid::new_v4().to_string().replace('-', "");
            entry.set_password(&new_key)?;
            Ok(new_key)
        }
        Err(e) => Err(AppError::from(e)),
    }
}

// Fixed 32-char hex key for CI/e2e test builds — never touches the Secret Service daemon.
#[cfg(feature = "test-mode")]
fn get_or_create_db_key() -> Result<String, AppError> {
    Ok("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4".to_string())
}

/// Locks the DB connection and runs `f` with a reference to it.
/// Returns `AppError::Db` if the lock is poisoned, otherwise propagates `f`'s result.
pub fn with_db<T, F>(db: &DbConn, f: F) -> Result<T, AppError>
where
    F: FnOnce(&rusqlite::Connection) -> Result<T, AppError>,
{
    let conn = db
        .lock()
        .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
    f(&conn)
}

/// Spawns a blocking task that locks `db` and runs `f`.
/// Use this from async Tauri commands to avoid blocking the Tokio runtime.
pub async fn spawn_db<T, F>(db: DbConn, f: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce(&rusqlite::Connection) -> Result<T, AppError> + Send + 'static,
{
    tokio::task::spawn_blocking(move || with_db(&db, f))
        .await
        .map_err(|e| AppError::Internal(format!("DB task panicked: {e}")))?
}

/// Low-level SQLite backup: copies all pages from `src` into `dst` using the SQLite Backup API.
/// Caller is responsible for any encryption setup on the connections.
pub(crate) fn backup_connections(src: &Connection, dst: &mut Connection) -> Result<(), AppError> {
    let backup =
        rusqlite::backup::Backup::new(src, dst).map_err(|e| AppError::Db(e.to_string()))?;
    backup
        .run_to_completion(100, std::time::Duration::from_millis(250), None)
        .map_err(|e| AppError::Db(e.to_string()))
}

/// Perform a backup of the SQLite database to a new file.
/// Uses the SQLite Backup API to ensure a consistent snapshot even while the source database is open.
pub fn backup_to_path(db_path: &Path, backup_path: &Path) -> Result<(), AppError> {
    let db_key = get_or_create_db_key()?;
    let safe_key = db_key.replace('-', "");

    let src = Connection::open(db_path).map_err(|e| AppError::Db(e.to_string()))?;
    src.execute_batch(&format!("PRAGMA key = '{}';", safe_key))
        .map_err(AppError::from)?;

    let mut dst = Connection::open(backup_path).map_err(|e| AppError::Db(e.to_string()))?;
    dst.execute_batch(&format!("PRAGMA key = '{}';", safe_key))
        .map_err(AppError::from)?;

    backup_connections(&src, &mut dst)
}

/// Restore the SQLite database from a backup file.
///
/// This is a high-availability operation that:
/// 1. Creates an automatic safety backup of the current database.
/// 2. Restores data from the provided backup file into the active connection.
/// 3. Re-runs migrations to ensure schema consistency.
pub fn restore_from_path(
    db_conn: DbConn,
    db_path: &Path,
    backup_path: &Path,
) -> Result<(), AppError> {
    let db_key = get_or_create_db_key()?;
    let safe_key = db_key.replace('-', "");

    // 1. Automatic Safety Backup
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let safety_path = db_path.with_extension(format!("safety-backup-{}.db", timestamp));

    log::info!("Creating safety backup at {}", safety_path.display());
    backup_to_path(db_path, &safety_path)?;

    // 2. Open the source (backup) file
    let src = Connection::open(backup_path).map_err(|e| AppError::Db(e.to_string()))?;
    src.execute_batch(&format!("PRAGMA key = '{}';", safe_key))
        .map_err(AppError::from)?;

    // 3. Lock the destination (active) connection
    let mut dst = db_conn
        .lock()
        .map_err(|_| AppError::Db("Database lock poisoned".into()))?;

    // 4. Perform the restore using the SQLite Backup API
    // Note: This replaces all pages in the destination with pages from the source.
    {
        let backup = rusqlite::backup::Backup::new(&src, &mut dst)
            .map_err(|e| AppError::Db(e.to_string()))?;
        backup
            .run_to_completion(100, std::time::Duration::from_millis(250), None)
            .map_err(|e| AppError::Db(e.to_string()))?;
    }

    // 5. Ensure schema is brought up to date for the current app version
    migrations::run(&dst)?;

    log::info!(
        "Database successfully restored from {}",
        backup_path.display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn in_memory_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrations::run(&conn).unwrap();
        conn.execute(
            "INSERT INTO conversations (id, title, model) VALUES ('c1', 'T', 'm')",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn backfill_extracts_think_and_strips_xml() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content) VALUES ('m1', 'c1', 'assistant', ?1)",
            rusqlite::params!["<think>I reasoned here</think>The answer is 42"],
        )
        .unwrap();

        backfill_thinking_and_strip(&conn).unwrap();

        let (thinking, content): (Option<String>, String) = conn
            .query_row(
                "SELECT thinking, content FROM messages WHERE id = 'm1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(thinking.as_deref(), Some("I reasoned here"));
        assert_eq!(content, "The answer is 42");
    }

    #[test]
    fn backfill_is_idempotent() {
        let conn = in_memory_conn();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content) VALUES ('m2', 'c1', 'assistant', 'plain text')",
            [],
        )
        .unwrap();
        backfill_thinking_and_strip(&conn).unwrap();
        backfill_thinking_and_strip(&conn).unwrap(); // runs twice — must not error
        let done: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'thinking_backfill_v1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(done, "done");
    }

    #[test]
    fn extract_thinking_from_content_with_timed_tag() {
        // The streaming layer uses <think time=X> format
        let content = "<think time=123>I thought</think>The answer";
        let (thinking, clean) = extract_thinking_from_content(content);
        assert_eq!(thinking.as_deref(), Some("I thought"));
        assert_eq!(clean, "The answer");
    }

    #[test]
    fn strip_xml_blocks_removes_tool_calls() {
        let content = "Here is <tool_call>{\"name\":\"search\"}</tool_call> some text";
        let clean = strip_xml_blocks(content);
        assert_eq!(clean, "Here is  some text".trim());
    }
}
