use chrono::Utc;
use rusqlite::params;
use uuid::Uuid;

use crate::error::AppError;

pub fn create(
    conn: &rusqlite::Connection,
    conversation_id: &str,
    archived_count: usize,
) -> Result<(), AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "INSERT INTO compaction_events (id, conversation_id, archived_count, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![id, conversation_id, archived_count as i64, now],
    )?;
    Ok(())
}
