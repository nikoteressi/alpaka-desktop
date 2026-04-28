use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

// ── Domain type ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Host {
    pub id: String,
    pub name: String,
    pub url: String,
    pub is_default: bool,
    pub is_active: bool,
    pub last_ping_status: PingStatus,
    pub last_ping_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PingStatus {
    Online,
    Offline,
    Unknown,
}

impl PingStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            PingStatus::Online => "online",
            PingStatus::Offline => "offline",
            PingStatus::Unknown => "unknown",
        }
    }
}

impl std::str::FromStr for PingStatus {
    type Err = AppError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "online" => Ok(PingStatus::Online),
            "offline" => Ok(PingStatus::Offline),
            _ => Ok(PingStatus::Unknown),
        }
    }
}

/// Fields required to add a new host.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewHost {
    pub name: String,
    pub url: String,
    pub is_default: Option<bool>,
}

// ── Mapping ────────────────────────────────────────────────────────────────────

fn row_to_host(row: &rusqlite::Row<'_>) -> rusqlite::Result<Host> {
    let status_str: String = row.get(4)?;
    let last_ping_status = status_str
        .parse::<PingStatus>()
        .unwrap_or(PingStatus::Unknown);

    Ok(Host {
        id: row.get(0)?,
        name: row.get(1)?,
        url: row.get(2)?,
        is_default: row.get::<_, i64>(3)? != 0,
        is_active: row.get::<_, i64>(5)? != 0,
        last_ping_status,
        last_ping_at: row.get(6)?,
        created_at: row.get(7)?,
    })
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

/// Return all hosts ordered by creation date.
pub fn list_all(conn: &Connection) -> Result<Vec<Host>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, url, is_default, last_ping_status, is_active, last_ping_at, created_at
         FROM hosts ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([], row_to_host)?;
    rows.map(|r| r.map_err(AppError::from))
        .collect::<Result<Vec<_>, _>>()
}

/// Fetch a single host by UUID.
pub fn get_by_id(conn: &Connection, id: &str) -> Result<Host, AppError> {
    conn.query_row(
        "SELECT id, name, url, is_default, last_ping_status, is_active, last_ping_at, created_at
         FROM hosts WHERE id = ?1",
        params![id],
        row_to_host,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Host '{id}' not found"))
        }
        other => AppError::from(other),
    })
}

/// Insert a new host and return it.
pub fn create(conn: &Connection, new: NewHost) -> Result<Host, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let is_default = new.is_default.unwrap_or(false);

    // If this is the first host, make it default + active.
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM hosts", [], |r| r.get(0))?;
    let effective_default = is_default || count == 0;

    conn.execute(
        "INSERT INTO hosts (id, name, url, is_default, is_active, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            new.name,
            new.url,
            effective_default as i64,
            effective_default as i64, // first host is also active
            now
        ],
    )?;

    get_by_id(conn, &id)
}

/// Update a host's display name and URL.
pub fn update(conn: &Connection, id: &str, name: &str, url: &str) -> Result<(), AppError> {
    let changed = conn.execute(
        "UPDATE hosts SET name = ?1, url = ?2 WHERE id = ?3",
        params![name, url, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Host '{id}' not found")));
    }
    Ok(())
}

/// Set exactly one host as active (clears all others first).
pub fn set_active(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("UPDATE hosts SET is_active = 0", [])?;
    let changed = conn.execute("UPDATE hosts SET is_active = 1 WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Host '{id}' not found")));
    }
    Ok(())
}

/// Record the result of a background health-check ping.
pub fn update_ping_status(
    conn: &Connection,
    id: &str,
    status: &PingStatus,
) -> Result<(), AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "UPDATE hosts SET last_ping_status = ?1, last_ping_at = ?2 WHERE id = ?3",
        params![status.as_str(), now, id],
    )?;
    Ok(())
}

/// Delete a host (and its associated model_cache rows via cascade).
pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    let changed = conn.execute("DELETE FROM hosts WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Host '{id}' not found")));
    }
    Ok(())
}

// ── Tests ──────────────────────────────────────────────────────────────────────

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
    fn create_first_host_becomes_default_and_active() {
        let conn = in_memory_conn();
        let host = create(
            &conn,
            NewHost {
                name: "Local".into(),
                url: "http://localhost:11434".into(),
                is_default: None,
            },
        )
        .unwrap();
        assert!(host.is_default);
        assert!(host.is_active);
    }

    #[test]
    fn set_active_clears_others() {
        let conn = in_memory_conn();
        let h1 = create(
            &conn,
            NewHost {
                name: "H1".into(),
                url: "http://h1:11434".into(),
                is_default: None,
            },
        )
        .unwrap();
        let h2 = create(
            &conn,
            NewHost {
                name: "H2".into(),
                url: "http://h2:11434".into(),
                is_default: None,
            },
        )
        .unwrap();

        set_active(&conn, &h2.id).unwrap();

        let updated_h1 = get_by_id(&conn, &h1.id).unwrap();
        let updated_h2 = get_by_id(&conn, &h2.id).unwrap();
        assert!(!updated_h1.is_active);
        assert!(updated_h2.is_active);
    }

    #[test]
    fn update_ping_status_records_online() {
        let conn = in_memory_conn();
        let host = create(
            &conn,
            NewHost {
                name: "H".into(),
                url: "http://h:11434".into(),
                is_default: None,
            },
        )
        .unwrap();
        update_ping_status(&conn, &host.id, &PingStatus::Online).unwrap();
        let updated = get_by_id(&conn, &host.id).unwrap();
        assert_eq!(updated.last_ping_status, PingStatus::Online);
        assert!(updated.last_ping_at.is_some());
    }
}
