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
use keyring::Entry;
use rusqlite::{params, Connection};
use uuid::Uuid;

const DB_KEY_SERVICE: &str = "alpaka-desktop-internal";
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
    seed_default_host(&conn)?;
    Ok(Arc::new(Mutex::new(conn)))
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

fn get_or_create_db_key() -> Result<String, AppError> {
    let entry = Entry::new(DB_KEY_SERVICE, DB_KEY_ACCOUNT)?;
    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => {
            let new_key = Uuid::new_v4().to_string().replace("-", "");
            entry.set_password(&new_key)?;
            Ok(new_key)
        }
        Err(e) => Err(AppError::from(e)),
    }
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
