use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

// ── Domain type ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: MessageRole,
    pub content: String,
    pub images_json: String,
    pub files_json: String,
    pub tokens_used: Option<i64>,
    pub generation_time_ms: Option<i64>,
    pub prompt_tokens: Option<i64>,
    pub tokens_per_sec: Option<f64>,
    pub total_duration_ms: Option<i64>,
    pub load_duration_ms: Option<i64>,
    pub prompt_eval_duration_ms: Option<i64>,
    pub eval_duration_ms: Option<i64>,
    pub seed: Option<i64>,
    pub created_at: String,
    pub parent_id: Option<String>,
    pub sibling_order: i64,
    pub is_active: bool,
    pub sibling_count: i64,
    pub is_archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
    #[serde(rename = "compact_summary")]
    CompactSummary,
}

impl MessageRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            MessageRole::User => "user",
            MessageRole::Assistant => "assistant",
            MessageRole::System => "system",
            MessageRole::CompactSummary => "compact_summary",
        }
    }
}

impl std::str::FromStr for MessageRole {
    type Err = AppError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "user" => Ok(MessageRole::User),
            "assistant" => Ok(MessageRole::Assistant),
            "system" => Ok(MessageRole::System),
            "compact_summary" => Ok(MessageRole::CompactSummary),
            other => Err(AppError::Internal(format!("Unknown role: '{other}'"))),
        }
    }
}

/// Fields required to insert a new message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewMessage {
    pub conversation_id: String,
    pub role: MessageRole,
    pub content: String,
    pub parent_id: Option<String>,
    pub sibling_order: i64,
    pub is_active: bool,
    pub images_json: Option<String>,
    pub files_json: Option<String>,
    pub tokens_used: Option<i64>,
    pub generation_time_ms: Option<i64>,
    pub prompt_tokens: Option<i64>,
    pub tokens_per_sec: Option<f64>,
    pub total_duration_ms: Option<i64>,
    pub load_duration_ms: Option<i64>,
    pub prompt_eval_duration_ms: Option<i64>,
    pub eval_duration_ms: Option<i64>,
    pub seed: Option<i64>,
}

impl Default for NewMessage {
    fn default() -> Self {
        Self {
            conversation_id: String::new(),
            role: MessageRole::User,
            content: String::new(),
            parent_id: None,
            sibling_order: 0,
            is_active: true,
            images_json: None,
            files_json: None,
            tokens_used: None,
            generation_time_ms: None,
            prompt_tokens: None,
            tokens_per_sec: None,
            total_duration_ms: None,
            load_duration_ms: None,
            prompt_eval_duration_ms: None,
            eval_duration_ms: None,
            seed: None,
        }
    }
}

fn row_to_message(row: &rusqlite::Row<'_>) -> rusqlite::Result<Message> {
    let role_str: String = row.get(2)?;
    let role = role_str.parse::<MessageRole>().unwrap_or(MessageRole::User);
    let is_active_int: i64 = row.get(18)?;
    let is_archived_int: i64 = row.get(20).unwrap_or(0);

    Ok(Message {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        role,
        content: row.get(3)?,
        images_json: row.get(4)?,
        files_json: row.get(5)?,
        tokens_used: row.get(6)?,
        generation_time_ms: row.get(7)?,
        prompt_tokens: row.get(8)?,
        tokens_per_sec: row.get(9)?,
        total_duration_ms: row.get(10)?,
        load_duration_ms: row.get(11)?,
        prompt_eval_duration_ms: row.get(12)?,
        eval_duration_ms: row.get(13)?,
        seed: row.get(14)?,
        created_at: row.get(15)?,
        parent_id: row.get(16)?,
        sibling_order: row.get(17)?,
        is_active: is_active_int != 0,
        sibling_count: row.get(19).unwrap_or(1),
        is_archived: is_archived_int != 0,
    })
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

/// Return all messages on the active path for a conversation in chronological order.
pub fn list_for_conversation(
    conn: &Connection,
    conversation_id: &str,
) -> Result<Vec<Message>, AppError> {
    let mut stmt = conn.prepare(
        "WITH RECURSIVE active_path AS (
             SELECT m.*,
                    (SELECT COUNT(*) FROM messages s WHERE s.parent_id = m.parent_id) as sibling_count
             FROM messages m
             WHERE m.conversation_id = ?1 AND m.parent_id IS NULL AND m.is_archived = 0
             UNION ALL
             SELECT m.*,
                    (SELECT COUNT(*) FROM messages s WHERE s.parent_id = m.parent_id) as sibling_count
             FROM messages m
             JOIN active_path ap ON m.parent_id = ap.id
             WHERE m.is_active = 1 AND m.is_archived = 0
         )
         SELECT id, conversation_id, role, content, images_json, files_json,
                tokens_used, generation_time_ms, prompt_tokens, tokens_per_sec,
                total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
                seed, created_at, parent_id, sibling_order, is_active, sibling_count, is_archived
         FROM active_path ORDER BY created_at ASC",
    )?;

    let rows = stmt.query_map(params![conversation_id], row_to_message)?;
    rows.map(|r| r.map_err(AppError::from))
        .collect::<Result<Vec<_>, _>>()
}

/// Insert a new message and return it.
pub fn create(conn: &Connection, new: NewMessage) -> Result<Message, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let images_json = new.images_json.unwrap_or_else(|| "[]".to_owned());
    let files_json = new.files_json.unwrap_or_else(|| "[]".to_owned());
    let is_active_int: i64 = if new.is_active { 1 } else { 0 };

    conn.execute(
        "INSERT INTO messages
             (id, conversation_id, role, content, images_json, files_json,
              tokens_used, generation_time_ms, prompt_tokens, tokens_per_sec,
              total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
              seed, created_at, parent_id, sibling_order, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
        params![
            id,
            new.conversation_id,
            new.role.as_str(),
            new.content,
            images_json,
            files_json,
            new.tokens_used,
            new.generation_time_ms,
            new.prompt_tokens,
            new.tokens_per_sec,
            new.total_duration_ms,
            new.load_duration_ms,
            new.prompt_eval_duration_ms,
            new.eval_duration_ms,
            new.seed,
            now,
            new.parent_id,
            new.sibling_order,
            is_active_int,
        ],
    )?;

    conn.query_row(
        "SELECT id, conversation_id, role, content, images_json, files_json,
                tokens_used, generation_time_ms, prompt_tokens, tokens_per_sec,
                total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
                seed, created_at, parent_id, sibling_order, is_active, 1 as sibling_count, is_archived
         FROM messages WHERE id = ?1",
        params![id],
        row_to_message,
    )
    .map_err(AppError::from)
}

/// Delete all messages that belong to a conversation.
///
/// Normally triggered by CASCADE on conversation delete, but exposed for
/// explicit bulk-delete scenarios (e.g. "clear chat history").
pub fn delete_for_conversation(
    conn: &Connection,
    conversation_id: &str,
) -> Result<usize, AppError> {
    conn.execute(
        "DELETE FROM messages WHERE conversation_id = ?1",
        params![conversation_id],
    )
    .map_err(AppError::from)
}

/// Returns all sibling messages with the given parent_id, ordered by sibling_order.
pub fn get_siblings(conn: &Connection, parent_id: &str) -> Result<Vec<Message>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, role, content, images_json, files_json,
                tokens_used, generation_time_ms, prompt_tokens, tokens_per_sec,
                total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
                seed, created_at, parent_id, sibling_order, is_active,
                (SELECT COUNT(*) FROM messages s WHERE s.parent_id = ?1) as sibling_count, is_archived
         FROM messages WHERE parent_id = ?1 ORDER BY sibling_order ASC",
    )?;
    let rows = stmt.query_map(params![parent_id], row_to_message)?;
    rows.map(|r| r.map_err(AppError::from))
        .collect::<Result<Vec<_>, _>>()
}

/// Inserts a new active sibling under `parent_id`, deactivating existing siblings.
///
/// Enforces a maximum of 5 siblings: if already at 5, the oldest inactive sibling
/// and its entire subtree are deleted first (ON DELETE CASCADE handles descendants).
/// The new sibling gets sibling_order = max(existing) + 1.
pub fn create_sibling(
    conn: &Connection,
    parent_id: &str,
    mut new: NewMessage,
) -> Result<Message, AppError> {
    let siblings = get_siblings(conn, parent_id)?;

    let next_order = siblings
        .iter()
        .map(|s| s.sibling_order)
        .max()
        .map(|m| m + 1)
        .unwrap_or(0);
    new.sibling_order = next_order;
    new.parent_id = Some(parent_id.to_owned());
    new.is_active = true;

    // All four operations must succeed together; wrap in a transaction so a
    // failed INSERT cannot leave siblings deactivated with no active replacement.
    let tx = conn.unchecked_transaction()?;

    if siblings.len() >= 5 {
        if let Some(oldest_inactive) = siblings.iter().find(|s| !s.is_active) {
            conn.execute(
                "DELETE FROM messages WHERE id = ?1",
                params![oldest_inactive.id],
            )?;
        }
    }

    conn.execute(
        "UPDATE messages SET is_active = 0 WHERE parent_id = ?1",
        params![parent_id],
    )?;

    let msg = create(conn, new)?;
    tx.commit()?;
    Ok(msg)
}

fn set_active_sibling_inner(conn: &Connection, message_id: &str) -> Result<(), AppError> {
    let parent_id: Option<String> = conn.query_row(
        "SELECT parent_id FROM messages WHERE id = ?1",
        params![message_id],
        |row| row.get(0),
    )?;

    if let Some(pid) = parent_id {
        conn.execute(
            "UPDATE messages SET is_active = 0 WHERE parent_id = ?1",
            params![pid],
        )?;
    }

    conn.execute(
        "UPDATE messages SET is_active = 1 WHERE id = ?1",
        params![message_id],
    )?;

    Ok(())
}

/// Makes the target message active; deactivates all other messages with the same parent_id.
pub fn set_active_sibling(conn: &Connection, message_id: &str) -> Result<(), AppError> {
    let tx = conn.unchecked_transaction()?;
    set_active_sibling_inner(conn, message_id)?;
    tx.commit()?;
    Ok(())
}

/// Deletes the given message and all its descendants (entire subtree via ON DELETE CASCADE).
pub fn truncate_after(conn: &Connection, message_id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM messages WHERE id = ?1", params![message_id])?;
    Ok(())
}

/// Activates the sibling at `current_order + direction` under the same parent.
pub fn navigate_sibling(
    conn: &Connection,
    message_id: &str,
    direction: i64,
) -> Result<(), AppError> {
    if direction.abs() != 1 {
        return Err(AppError::Internal("direction must be 1 or -1".into()));
    }
    let tx = conn.unchecked_transaction()?;
    let (parent_id, current_order): (Option<String>, i64) = conn.query_row(
        "SELECT parent_id, sibling_order FROM messages WHERE id = ?1",
        params![message_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let parent_id = parent_id
        .ok_or_else(|| AppError::Internal("root messages have no siblings to navigate".into()))?;
    let target_order = current_order + direction;
    let target_id: String = conn.query_row(
        "SELECT id FROM messages WHERE parent_id = ?1 AND sibling_order = ?2",
        params![parent_id, target_order],
        |row| row.get(0),
    )?;
    set_active_sibling_inner(conn, &target_id)?;
    tx.commit()?;
    Ok(())
}

/// Marks all non-archived messages in a conversation as archived.
/// Returns the count of messages that were archived.
pub fn archive_all_for_conversation(
    conn: &Connection,
    conversation_id: &str,
) -> Result<usize, AppError> {
    conn.execute(
        "UPDATE messages SET is_archived = 1 WHERE conversation_id = ?1 AND is_archived = 0",
        params![conversation_id],
    )
    .map_err(AppError::from)
}

/// Returns all archived messages for a conversation in chronological order.
pub fn list_archived_for_conversation(
    conn: &Connection,
    conversation_id: &str,
) -> Result<Vec<Message>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, role, content, images_json, files_json,
                tokens_used, generation_time_ms, prompt_tokens, tokens_per_sec,
                total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
                seed, created_at, parent_id, sibling_order, is_active, 1 as sibling_count, is_archived
         FROM messages
         WHERE conversation_id = ?1 AND is_archived = 1
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![conversation_id], row_to_message)?;
    rows.map(|r| r.map_err(AppError::from))
        .collect::<Result<Vec<_>, _>>()
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{conversations, migrations};

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

    fn make_conversation(conn: &Connection) -> String {
        conversations::create(
            conn,
            conversations::NewConversation {
                title: "Test".into(),
                model: "m".into(),
                settings_json: None,
                tags: None,
            },
        )
        .unwrap()
        .id
    }

    /// Minimal message builder: sets the three required fields; everything else
    /// uses `NewMessage::default()` (all Options → None, sibling_order → 0, is_active → true).
    fn new_msg(cid: &str, role: MessageRole, content: &str) -> NewMessage {
        NewMessage {
            conversation_id: cid.to_owned(),
            role,
            content: content.into(),
            ..Default::default()
        }
    }

    #[test]
    fn create_and_list_messages() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        create(&conn, new_msg(&cid, MessageRole::User, "Hello")).unwrap();

        create(
            &conn,
            NewMessage {
                tokens_used: Some(10),
                generation_time_ms: Some(250),
                prompt_tokens: Some(5),
                tokens_per_sec: Some(40.0),
                total_duration_ms: Some(300),
                load_duration_ms: Some(10),
                prompt_eval_duration_ms: Some(40),
                eval_duration_ms: Some(250),
                ..new_msg(&cid, MessageRole::Assistant, "Hi there")
            },
        )
        .unwrap();

        let msgs = list_for_conversation(&conn, &cid).unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].role, MessageRole::User);
        assert_eq!(msgs[1].tokens_used, Some(10));
    }

    #[test]
    fn delete_all_messages() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        create(&conn, new_msg(&cid, MessageRole::User, "Bye")).unwrap();

        let deleted = delete_for_conversation(&conn, &cid).unwrap();
        assert_eq!(deleted, 1);
        assert!(list_for_conversation(&conn, &cid).unwrap().is_empty());
    }

    #[test]
    fn list_follows_active_path_only() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let user_msg = create(&conn, new_msg(&cid, MessageRole::User, "Hello")).unwrap();

        // Two sibling assistant messages under the same parent; only B is active.
        create(
            &conn,
            NewMessage {
                parent_id: Some(user_msg.id.clone()),
                is_active: false,
                ..new_msg(&cid, MessageRole::Assistant, "Response A")
            },
        )
        .unwrap();

        create(
            &conn,
            NewMessage {
                parent_id: Some(user_msg.id.clone()),
                sibling_order: 1,
                ..new_msg(&cid, MessageRole::Assistant, "Response B")
            },
        )
        .unwrap();

        let msgs = list_for_conversation(&conn, &cid).unwrap();
        assert_eq!(msgs.len(), 2, "only user + active assistant");
        assert_eq!(msgs[1].content, "Response B");
        assert_eq!(msgs[1].sibling_count, 2);
        assert_eq!(msgs[1].sibling_order, 1);
    }

    #[test]
    fn get_siblings_returns_all_with_same_parent() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let user_msg = create(&conn, new_msg(&cid, MessageRole::User, "Q")).unwrap();

        create(
            &conn,
            NewMessage {
                parent_id: Some(user_msg.id.clone()),
                ..new_msg(&cid, MessageRole::Assistant, "A1")
            },
        )
        .unwrap();

        create(
            &conn,
            NewMessage {
                parent_id: Some(user_msg.id.clone()),
                sibling_order: 1,
                is_active: false,
                ..new_msg(&cid, MessageRole::Assistant, "A2")
            },
        )
        .unwrap();

        let siblings = get_siblings(&conn, &user_msg.id).unwrap();
        assert_eq!(siblings.len(), 2);
        assert_eq!(siblings[0].content, "A1");
        assert_eq!(siblings[1].content, "A2");
    }

    #[test]
    fn create_sibling_deactivates_existing_and_inserts_new() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let user_msg = create(&conn, new_msg(&cid, MessageRole::User, "Q")).unwrap();

        create(
            &conn,
            NewMessage {
                parent_id: Some(user_msg.id.clone()),
                ..new_msg(&cid, MessageRole::Assistant, "A1")
            },
        )
        .unwrap();

        let new_msg_result = create_sibling(
            &conn,
            &user_msg.id,
            new_msg(&cid, MessageRole::Assistant, "A2"),
        )
        .unwrap();

        assert_eq!(new_msg_result.content, "A2");
        assert!(new_msg_result.is_active);
        assert_eq!(new_msg_result.sibling_order, 1); // assigned max+1

        let siblings = get_siblings(&conn, &user_msg.id).unwrap();
        assert_eq!(siblings.len(), 2);
        let inactive = siblings.iter().find(|s| s.content == "A1").unwrap();
        assert!(!inactive.is_active);
    }

    #[test]
    fn set_active_sibling_swaps_active_flag() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let user_msg = create(&conn, new_msg(&cid, MessageRole::User, "Q")).unwrap();

        let a1 = create(
            &conn,
            NewMessage {
                parent_id: Some(user_msg.id.clone()),
                ..new_msg(&cid, MessageRole::Assistant, "A1")
            },
        )
        .unwrap();

        let a2 = create(
            &conn,
            NewMessage {
                parent_id: Some(user_msg.id.clone()),
                sibling_order: 1,
                is_active: false,
                ..new_msg(&cid, MessageRole::Assistant, "A2")
            },
        )
        .unwrap();

        set_active_sibling(&conn, &a2.id).unwrap();

        let siblings = get_siblings(&conn, &user_msg.id).unwrap();
        let s1 = siblings.iter().find(|s| s.id == a1.id).unwrap();
        let s2 = siblings.iter().find(|s| s.id == a2.id).unwrap();
        assert!(!s1.is_active);
        assert!(s2.is_active);
    }

    #[test]
    fn truncate_after_deletes_message_and_descendants() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let u = create(&conn, new_msg(&cid, MessageRole::User, "U")).unwrap();

        let a = create(
            &conn,
            NewMessage {
                parent_id: Some(u.id.clone()),
                ..new_msg(&cid, MessageRole::Assistant, "A")
            },
        )
        .unwrap();

        create(
            &conn,
            NewMessage {
                parent_id: Some(a.id.clone()),
                ..new_msg(&cid, MessageRole::User, "U2")
            },
        )
        .unwrap();

        truncate_after(&conn, &a.id).unwrap();

        let msgs = list_for_conversation(&conn, &cid).unwrap();
        assert_eq!(msgs.len(), 1, "only root user message remains");
        assert_eq!(msgs[0].content, "U");
    }

    #[test]
    fn navigate_sibling_switches_active() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let user_msg = create(&conn, new_msg(&cid, MessageRole::User, "Q")).unwrap();

        let a1 = create(
            &conn,
            NewMessage {
                parent_id: Some(user_msg.id.clone()),
                ..new_msg(&cid, MessageRole::Assistant, "A1")
            },
        )
        .unwrap();

        let a2 = create(
            &conn,
            NewMessage {
                parent_id: Some(user_msg.id.clone()),
                sibling_order: 1,
                is_active: false,
                ..new_msg(&cid, MessageRole::Assistant, "A2")
            },
        )
        .unwrap();

        // Navigate forward: a1 (order 0) → a2 (order 1)
        navigate_sibling(&conn, &a1.id, 1).unwrap();

        let siblings = get_siblings(&conn, &user_msg.id).unwrap();
        assert!(!siblings.iter().find(|s| s.id == a1.id).unwrap().is_active);
        assert!(siblings.iter().find(|s| s.id == a2.id).unwrap().is_active);

        // Navigate backward: a2 (order 1) → a1 (order 0)
        navigate_sibling(&conn, &a2.id, -1).unwrap();

        let siblings = get_siblings(&conn, &user_msg.id).unwrap();
        assert!(siblings.iter().find(|s| s.id == a1.id).unwrap().is_active);
        assert!(!siblings.iter().find(|s| s.id == a2.id).unwrap().is_active);
    }

    #[test]
    fn navigate_sibling_errors_on_root_message() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let root = create(&conn, new_msg(&cid, MessageRole::User, "Root")).unwrap();

        assert!(navigate_sibling(&conn, &root.id, 1).is_err());
    }

    #[test]
    fn navigate_sibling_rejects_invalid_direction() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let msg = create(&conn, new_msg(&cid, MessageRole::User, "X")).unwrap();

        assert!(navigate_sibling(&conn, &msg.id, 0).is_err());
        assert!(navigate_sibling(&conn, &msg.id, 2).is_err());
    }

    #[test]
    fn migration_v14_chains_orphaned_roots() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        // Insert messages with explicit distinct timestamps to simulate real-world
        // pre-branching data (same-second timestamps don't exist in production data).
        let u1_id = uuid::Uuid::new_v4().to_string();
        let u2_id = uuid::Uuid::new_v4().to_string();
        conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, images_json, files_json, created_at, parent_id, sibling_order, is_active)
             VALUES (?1, ?2, 'user', 'First', '[]', '[]', '2024-01-01T00:00:00Z', NULL, 0, 1)",
            params![u1_id, cid],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, images_json, files_json, created_at, parent_id, sibling_order, is_active)
             VALUES (?1, ?2, 'user', 'Second', '[]', '[]', '2024-01-01T00:00:01Z', NULL, 0, 1)",
            params![u2_id, cid],
        )
        .unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        // Re-run the migration SQL against this orphaned state.
        conn.execute_batch(include_str!("sql/006_fix_orphan_parent_ids.sql"))
            .unwrap();

        let u2_parent: Option<String> = conn
            .query_row(
                "SELECT parent_id FROM messages WHERE id = ?1",
                params![u2_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(u2_parent.as_deref(), Some(u1_id.as_str()));

        let u1_parent: Option<String> = conn
            .query_row(
                "SELECT parent_id FROM messages WHERE id = ?1",
                params![u1_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(u1_parent.is_none());
    }

    #[test]
    fn message_has_branching_fields() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let msg = create(&conn, new_msg(&cid, MessageRole::User, "hi")).unwrap();

        assert_eq!(msg.sibling_order, 0);
        assert!(msg.is_active);
        assert!(msg.parent_id.is_none());
        assert_eq!(msg.sibling_count, 1);
    }

    #[test]
    fn archive_all_marks_messages_and_returns_count() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        create(&conn, new_msg(&cid, MessageRole::User, "hello")).unwrap();
        create(&conn, new_msg(&cid, MessageRole::Assistant, "hi")).unwrap();

        let n = archive_all_for_conversation(&conn, &cid).unwrap();
        assert_eq!(n, 2);

        // CTE filters is_archived = 0 on both anchor and recursive clauses, so archived
        // messages must not appear in list_for_conversation results.
        let visible = list_for_conversation(&conn, &cid).unwrap();
        assert!(
            visible.is_empty(),
            "archived messages must not appear in live view"
        );

        let n2 = archive_all_for_conversation(&conn, &cid).unwrap();
        assert_eq!(n2, 0, "second call archives nothing (already archived)");
    }

    #[test]
    fn list_archived_returns_archived_messages_in_order() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        create(&conn, new_msg(&cid, MessageRole::User, "first")).unwrap();
        create(&conn, new_msg(&cid, MessageRole::Assistant, "second")).unwrap();

        archive_all_for_conversation(&conn, &cid).unwrap();

        let archived = list_archived_for_conversation(&conn, &cid).unwrap();
        assert_eq!(archived.len(), 2);
        assert!(archived.iter().all(|m| m.is_archived));
        assert_eq!(archived[0].content, "first");
        assert_eq!(archived[1].content, "second");
    }

    #[test]
    fn compact_summary_role_roundtrips() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let msg = create(
            &conn,
            new_msg(&cid, MessageRole::CompactSummary, "summary text"),
        )
        .unwrap();
        assert_eq!(msg.role, MessageRole::CompactSummary);
        assert_eq!(msg.role.as_str(), "compact_summary");
    }
}
