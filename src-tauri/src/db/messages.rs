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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

impl MessageRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            MessageRole::User => "user",
            MessageRole::Assistant => "assistant",
            MessageRole::System => "system",
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

fn row_to_message(row: &rusqlite::Row<'_>) -> rusqlite::Result<Message> {
    let role_str: String = row.get(2)?;
    let role = role_str.parse::<MessageRole>().unwrap_or(MessageRole::User);
    let is_active_int: i64 = row.get(18)?;

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
             WHERE m.conversation_id = ?1 AND m.parent_id IS NULL
             UNION ALL
             SELECT m.*,
                    (SELECT COUNT(*) FROM messages s WHERE s.parent_id = m.parent_id) as sibling_count
             FROM messages m
             JOIN active_path ap ON m.parent_id = ap.id
             WHERE m.is_active = 1
         )
         SELECT id, conversation_id, role, content, images_json, files_json,
                tokens_used, generation_time_ms, prompt_tokens, tokens_per_sec,
                total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
                seed, created_at, parent_id, sibling_order, is_active, sibling_count
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
                seed, created_at, parent_id, sibling_order, is_active, 1 as sibling_count
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
                (SELECT COUNT(*) FROM messages s WHERE s.parent_id = ?1) as sibling_count
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

/// Makes the target message active; deactivates all other messages with the same parent_id.
pub fn set_active_sibling(conn: &Connection, message_id: &str) -> Result<(), AppError> {
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

/// Deletes the given message and all its descendants (entire subtree via ON DELETE CASCADE).
pub fn truncate_after(conn: &Connection, message_id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM messages WHERE id = ?1", params![message_id])?;
    Ok(())
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

    #[test]
    fn create_and_list_messages() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        create(
            &conn,
            NewMessage {
                conversation_id: cid.clone(),
                role: MessageRole::User,
                content: "Hello".into(),
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
            },
        )
        .unwrap();

        create(
            &conn,
            NewMessage {
                conversation_id: cid.clone(),
                role: MessageRole::Assistant,
                content: "Hi there".into(),
                parent_id: None,
                sibling_order: 0,
                is_active: true,
                images_json: None,
                files_json: None,
                tokens_used: Some(10),
                generation_time_ms: Some(250),
                prompt_tokens: Some(5),
                tokens_per_sec: Some(40.0),
                total_duration_ms: Some(300),
                load_duration_ms: Some(10),
                prompt_eval_duration_ms: Some(40),
                eval_duration_ms: Some(250),
                seed: None,
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

        create(
            &conn,
            NewMessage {
                conversation_id: cid.clone(),
                role: MessageRole::User,
                content: "Bye".into(),
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
            },
        )
        .unwrap();

        let deleted = delete_for_conversation(&conn, &cid).unwrap();
        assert_eq!(deleted, 1);
        assert!(list_for_conversation(&conn, &cid).unwrap().is_empty());
    }

    #[test]
    fn list_follows_active_path_only() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        // Insert root user message (no parent)
        let user_msg = create(
            &conn,
            NewMessage {
                conversation_id: cid.clone(),
                role: MessageRole::User,
                content: "Hello".into(),
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
            },
        )
        .unwrap();

        // Insert two sibling assistant messages with same parent
        let _a1 = create(
            &conn,
            NewMessage {
                conversation_id: cid.clone(),
                role: MessageRole::Assistant,
                content: "Response A".into(),
                parent_id: Some(user_msg.id.clone()),
                sibling_order: 0,
                is_active: false, // inactive
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
            },
        )
        .unwrap();

        let _a2 = create(
            &conn,
            NewMessage {
                conversation_id: cid.clone(),
                role: MessageRole::Assistant,
                content: "Response B".into(),
                parent_id: Some(user_msg.id.clone()),
                sibling_order: 1,
                is_active: true, // active
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

        let user_msg = create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::User, content: "Q".into(),
            parent_id: None, sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::Assistant, content: "A1".into(),
            parent_id: Some(user_msg.id.clone()), sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::Assistant, content: "A2".into(),
            parent_id: Some(user_msg.id.clone()), sibling_order: 1, is_active: false,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        let siblings = get_siblings(&conn, &user_msg.id).unwrap();
        assert_eq!(siblings.len(), 2);
        assert_eq!(siblings[0].content, "A1");
        assert_eq!(siblings[1].content, "A2");
    }

    #[test]
    fn create_sibling_deactivates_existing_and_inserts_new() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let user_msg = create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::User, content: "Q".into(),
            parent_id: None, sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        // First assistant response
        create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::Assistant, content: "A1".into(),
            parent_id: Some(user_msg.id.clone()), sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        // Create a sibling (regenerated response)
        let new_msg = create_sibling(&conn, &user_msg.id, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::Assistant, content: "A2".into(),
            parent_id: Some(user_msg.id.clone()), sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        assert_eq!(new_msg.content, "A2");
        assert!(new_msg.is_active);
        assert_eq!(new_msg.sibling_order, 1); // assigned max+1

        let siblings = get_siblings(&conn, &user_msg.id).unwrap();
        assert_eq!(siblings.len(), 2);
        let inactive = siblings.iter().find(|s| s.content == "A1").unwrap();
        assert!(!inactive.is_active);
    }

    #[test]
    fn set_active_sibling_swaps_active_flag() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let user_msg = create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::User, content: "Q".into(),
            parent_id: None, sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        let a1 = create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::Assistant, content: "A1".into(),
            parent_id: Some(user_msg.id.clone()), sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        let a2 = create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::Assistant, content: "A2".into(),
            parent_id: Some(user_msg.id.clone()), sibling_order: 1, is_active: false,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

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

        let u = create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::User, content: "U".into(),
            parent_id: None, sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        let a = create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::Assistant, content: "A".into(),
            parent_id: Some(u.id.clone()), sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        let _u2 = create(&conn, NewMessage {
            conversation_id: cid.clone(), role: MessageRole::User, content: "U2".into(),
            parent_id: Some(a.id.clone()), sibling_order: 0, is_active: true,
            images_json: None, files_json: None, tokens_used: None,
            generation_time_ms: None, prompt_tokens: None, tokens_per_sec: None,
            total_duration_ms: None, load_duration_ms: None, prompt_eval_duration_ms: None,
            eval_duration_ms: None, seed: None,
        }).unwrap();

        truncate_after(&conn, &a.id).unwrap(); // delete A and everything after

        let msgs = list_for_conversation(&conn, &cid).unwrap();
        assert_eq!(msgs.len(), 1, "only root user message remains");
        assert_eq!(msgs[0].content, "U");
    }

    #[test]
    fn message_has_branching_fields() {
        let conn = in_memory_conn();
        let cid = make_conversation(&conn);

        let msg = create(
            &conn,
            NewMessage {
                conversation_id: cid.clone(),
                role: MessageRole::User,
                content: "hi".into(),
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
            },
        )
        .unwrap();

        assert_eq!(msg.sibling_order, 0);
        assert!(msg.is_active);
        assert!(msg.parent_id.is_none());
        assert_eq!(msg.sibling_count, 1);
    }
}
