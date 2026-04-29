use rusqlite::Connection;

use crate::error::AppError;

// ── Migration definitions ──────────────────────────────────────────────────────

struct Migration {
    version: i64,
    description: &'static str,
    sql: &'static str,
}

/// All migrations in ascending version order.
/// Add a new `Migration` entry here for every future schema change.
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        description: "v1.0.0 baseline schema",
        sql: include_str!("sql/001_init_v1.sql"),
    },
    Migration {
        version: 2,
        description: "model_settings table",
        sql: include_str!("sql/002_model_settings.sql"),
    },
];

// ── Runner ─────────────────────────────────────────────────────────────────────

/// Apply any migrations that have not yet been applied, in version order.
///
/// Safe to call on every startup — already-applied migrations are skipped.
pub fn run(conn: &Connection) -> Result<(), AppError> {
    create_versions_table_if_missing(conn)?;
    let applied_through = highest_applied_version(conn)?;

    for migration in MIGRATIONS {
        if migration.version <= applied_through {
            continue;
        }

        conn.execute_batch(migration.sql).map_err(|e| {
            AppError::Db(format!(
                "Migration v{} ('{}') failed: {e}",
                migration.version, migration.description
            ))
        })?;

        record_migration(conn, migration.version, migration.description)?;

        tracing::info!(
            version = migration.version,
            description = migration.description,
            "Applied migration"
        );
    }

    Ok(())
}

// ── Helpers ────────────────────────────────────────────────────────────────────

fn create_versions_table_if_missing(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_versions (
             version     INTEGER PRIMARY KEY,
             description TEXT    NOT NULL,
             applied_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         );",
    )
    .map_err(AppError::from)
}

fn highest_applied_version(conn: &Connection) -> Result<i64, AppError> {
    conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_versions",
        [],
        |row| row.get::<_, i64>(0),
    )
    .map_err(AppError::from)
}

fn record_migration(conn: &Connection, version: i64, description: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO schema_versions (version, description) VALUES (?1, ?2)",
        rusqlite::params![version, description],
    )
    .map(|_| ())
    .map_err(AppError::from)
}
