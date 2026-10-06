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

const DB_FILE_NAME: &str = "alpaka-desktop.db";
/// Fallback location for the DB key when no system keyring is available
/// (see `get_or_create_db_key`). Lives next to the database, mode 0600.
const DB_KEY_FILE_NAME: &str = "db.key";

/// A cloneable, thread-safe handle to the SQLite connection.
pub type DbConn = Arc<Mutex<Connection>>;

/// Open (or create) the application database and return a shared connection.
pub fn open(app_data_dir: &Path) -> Result<DbConn, AppError> {
    let db_path = app_data_dir.join(DB_FILE_NAME);

    // Get or create the encryption key (system keyring, or the key-file fallback)
    let db_key = get_or_create_db_key(app_data_dir)?;

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

/// Returns the SQLCipher key for the database in `app_data_dir`, creating one on first run.
#[cfg(not(feature = "test-mode"))]
fn get_or_create_db_key(app_data_dir: &Path) -> Result<String, AppError> {
    resolve_db_key(app_data_dir, || keyring_db_key().map_err(|e| e.to_string()))
}

/// Key-selection policy behind `get_or_create_db_key`, with the keyring lookup injected.
///
/// The key normally lives in the system keyring (Secret Service). When no keyring
/// is available (minimal window managers, sandboxes, no D-Bus session), a brand-new
/// install falls back to a `0600` key file next to the database instead of refusing
/// to start. Once a key file exists it is always used, so a keyring that appears
/// later never changes the key. An existing keyring-encrypted database is never
/// re-keyed: if the keyring is down, this returns an error rather than generating
/// a key that cannot open it.
#[cfg_attr(feature = "test-mode", allow(dead_code))]
fn resolve_db_key(
    app_data_dir: &Path,
    keyring: impl FnOnce() -> Result<String, String>,
) -> Result<String, AppError> {
    let key_file = app_data_dir.join(DB_KEY_FILE_NAME);
    if key_file.exists() {
        return read_key_file(&key_file);
    }

    match keyring() {
        Ok(key) => Ok(key),
        Err(e) if app_data_dir.join(DB_FILE_NAME).exists() => Err(AppError::Auth(format!(
            "The system keyring is unavailable ({e}), and the existing database is \
             encrypted with a key stored there. Start your keyring service \
             (GNOME Keyring, KWallet) and relaunch."
        ))),
        Err(e) => {
            log::warn!(
                "System keyring unavailable ({e}); storing the database key in {} instead",
                key_file.display()
            );
            create_key_file(&key_file)
        }
    }
}

#[cfg(not(feature = "test-mode"))]
fn keyring_db_key() -> Result<String, keyring::Error> {
    let entry = Entry::new(DB_KEY_SERVICE, DB_KEY_ACCOUNT)?;
    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => {
            let new_key = Uuid::new_v4().simple().to_string();
            entry.set_password(&new_key)?;
            Ok(new_key)
        }
        Err(e) => Err(e),
    }
}

#[cfg_attr(feature = "test-mode", allow(dead_code))]
fn read_key_file(path: &Path) -> Result<String, AppError> {
    let key = std::fs::read_to_string(path)
        .map_err(|e| AppError::Io(format!("Cannot read {}: {e}", path.display())))?;
    let key = key.trim();
    if key.len() != 32 || !key.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::Validation(format!(
            "{} does not contain a valid database key",
            path.display()
        )));
    }
    Ok(key.to_string())
}

#[cfg_attr(feature = "test-mode", allow(dead_code))]
fn create_key_file(path: &Path) -> Result<String, AppError> {
    use std::io::Write;

    let key = Uuid::new_v4().simple().to_string();
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(path)
        .map_err(|e| AppError::Io(format!("Cannot create {}: {e}", path.display())))?;
    file.write_all(key.as_bytes())
        .and_then(|()| file.sync_all())
        .map_err(|e| AppError::Io(format!("Cannot write {}: {e}", path.display())))?;
    Ok(key)
}

// Fixed 32-char hex key for CI/e2e test builds — never touches the Secret Service daemon.
#[cfg(feature = "test-mode")]
fn get_or_create_db_key(_app_data_dir: &Path) -> Result<String, AppError> {
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

fn app_data_dir_of(db_path: &Path) -> &Path {
    db_path.parent().unwrap_or_else(|| Path::new("."))
}

/// Perform a backup of the SQLite database to a new file.
/// Uses the SQLite Backup API to ensure a consistent snapshot even while the source database is open.
pub fn backup_to_path(db_path: &Path, backup_path: &Path) -> Result<(), AppError> {
    let db_key = get_or_create_db_key(app_data_dir_of(db_path))?;
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
    let db_key = get_or_create_db_key(app_data_dir_of(db_path))?;
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

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const KEYRING_KEY: &str = "0123456789abcdef0123456789abcdef";

    fn keyring_ok() -> Result<String, String> {
        Ok(KEYRING_KEY.to_string())
    }

    fn keyring_down() -> Result<String, String> {
        Err("no secret service provider or dbus session found".to_string())
    }

    #[test]
    fn uses_keyring_when_available() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(resolve_db_key(dir.path(), keyring_ok).unwrap(), KEYRING_KEY);
        assert!(!dir.path().join(DB_KEY_FILE_NAME).exists());
    }

    #[test]
    fn fresh_install_without_keyring_creates_private_key_file() {
        let dir = tempfile::tempdir().unwrap();
        let key = resolve_db_key(dir.path(), keyring_down).unwrap();
        assert_eq!(key.len(), 32);
        assert!(key.chars().all(|c| c.is_ascii_hexdigit()));

        let key_file = dir.path().join(DB_KEY_FILE_NAME);
        assert_eq!(std::fs::read_to_string(&key_file).unwrap(), key);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&key_file).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
    }

    #[test]
    fn key_file_wins_over_keyring_once_created() {
        let dir = tempfile::tempdir().unwrap();
        let file_key = resolve_db_key(dir.path(), keyring_down).unwrap();
        // The keyring coming back later must not change the key.
        assert_eq!(resolve_db_key(dir.path(), keyring_ok).unwrap(), file_key);
        assert_eq!(resolve_db_key(dir.path(), keyring_down).unwrap(), file_key);
    }

    #[test]
    fn existing_database_is_never_rekeyed_when_keyring_is_down() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(DB_FILE_NAME), b"encrypted").unwrap();
        let err = resolve_db_key(dir.path(), keyring_down).unwrap_err();
        assert!(matches!(err, AppError::Auth(ref msg) if msg.contains("keyring")));
        assert!(!dir.path().join(DB_KEY_FILE_NAME).exists());
    }

    #[test]
    fn rejects_corrupt_key_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(DB_KEY_FILE_NAME), "not-a-key").unwrap();
        assert!(matches!(
            resolve_db_key(dir.path(), keyring_ok),
            Err(AppError::Validation(_))
        ));
    }

    #[test]
    fn key_file_tolerates_trailing_newline() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join(DB_KEY_FILE_NAME),
            format!("{KEYRING_KEY}\n"),
        )
        .unwrap();
        assert_eq!(
            resolve_db_key(dir.path(), keyring_down).unwrap(),
            KEYRING_KEY
        );
    }
}
