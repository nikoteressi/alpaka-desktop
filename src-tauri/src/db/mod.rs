pub mod conversations;
pub mod hosts;
pub mod messages;
pub mod migrations;
pub mod settings;
pub mod folders;

use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use rusqlite::Connection;

use crate::error::AppError;

// ── Shared connection type ─────────────────────────────────────────────────────

/// A cloneable, thread-safe handle to the SQLite connection.
/// All db sub-modules receive `&Connection` (sync); callers wrap
/// the lock acquisition in `tokio::task::spawn_blocking`.
pub type DbConn = Arc<Mutex<Connection>>;

// ── Initialization ─────────────────────────────────────────────────────────────

/// Open (or create) the application database and return a shared connection.
///
/// Call once at app startup from the Tauri `setup` hook.
/// The returned `DbConn` is placed in `AppState` and shared across commands.
pub fn open(app_data_dir: &Path) -> Result<DbConn, AppError> {
    let db_path = app_data_dir.join("ollama-desktop.db");
    let conn = Connection::open(&db_path).map_err(AppError::from)?;
    configure_connection(&conn)?;
    migrations::run(&conn)?;
    Ok(Arc::new(Mutex::new(conn)))
}

/// Apply recommended SQLite PRAGMAs for a WAL-mode desktop app.
fn configure_connection(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         PRAGMA synchronous   = NORMAL;
         PRAGMA busy_timeout  = 5000;",
    )
    .map_err(AppError::from)
}
