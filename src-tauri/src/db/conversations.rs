use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

const MAX_LIST_LIMIT: usize = 200;

// ── Domain type ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub model: String,
    pub settings_json: String,
    pub pinned: bool,
    pub tags: Vec<String>,
    pub draft_json: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Fields required to create a new conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewConversation {
    pub title: String,
    pub model: String,
    pub settings_json: Option<String>,
    pub tags: Option<Vec<String>>,
}

// ── Mapping ────────────────────────────────────────────────────────────────────

fn row_to_conversation(row: &rusqlite::Row<'_>) -> rusqlite::Result<Conversation> {
    let tags_str: String = row.get(5)?;
    let tags = parse_tags(&tags_str);

    Ok(Conversation {
        id: row.get(0)?,
        title: row.get(1)?,
        model: row.get(2)?,
        settings_json: row.get(3)?,
        pinned: row.get::<_, i64>(4)? != 0,
        tags,
        draft_json: row.get(8)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn parse_tags(raw: &str) -> Vec<String> {
    if raw.is_empty() {
        return Vec::new();
    }
    raw.split(',').map(|s| s.trim().to_owned()).collect()
}

fn serialize_tags(tags: &[String]) -> String {
    tags.join(",")
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

/// Return a page of conversations ordered by pinned desc, then updated_at desc.
pub fn list(conn: &Connection, limit: usize, offset: usize) -> Result<Vec<Conversation>, AppError> {
    let limit = limit.min(MAX_LIST_LIMIT);
    let mut stmt = conn.prepare(
        "SELECT id, title, model, settings_json, pinned, tags, created_at, updated_at, draft_json
         FROM conversations
         ORDER BY pinned DESC, updated_at DESC
         LIMIT ?1 OFFSET ?2",
    )?;

    let rows = stmt.query_map(params![limit as i64, offset as i64], row_to_conversation)?;
    rows.map(|r| r.map_err(AppError::from))
        .collect::<Result<Vec<_>, _>>()
}

/// Helper to get the total count of conversations.
pub fn count(conn: &Connection) -> Result<usize, AppError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM conversations", [], |r| r.get(0))?;
    Ok(count as usize)
}

/// Fetch a single conversation by its UUID.
pub fn get_by_id(conn: &Connection, id: &str) -> Result<Conversation, AppError> {
    conn.query_row(
        "SELECT id, title, model, settings_json, pinned, tags, created_at, updated_at, draft_json
         FROM conversations WHERE id = ?1",
        params![id],
        row_to_conversation,
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Conversation '{id}' not found"))
        }
        other => AppError::from(other),
    })
}

/// Insert a new conversation and return it.
pub fn create(conn: &Connection, new: NewConversation) -> Result<Conversation, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let tags = serialize_tags(&new.tags.unwrap_or_default());
    let settings_json = new.settings_json.unwrap_or_else(|| "{}".to_owned());

    conn.execute(
        "INSERT INTO conversations
             (id, title, model, settings_json, pinned, tags, created_at, updated_at, draft_json)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?6, NULL)",
        params![id, new.title, new.model, settings_json, tags, now],
    )?;

    get_by_id(conn, &id)
}

/// Rename a conversation's title and bump updated_at.
pub fn update_title(conn: &Connection, id: &str, title: &str) -> Result<(), AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let changed = conn.execute(
        "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Conversation '{id}' not found")));
    }
    Ok(())
}

/// Update the model for a conversation and bump updated_at.
pub fn update_model(conn: &Connection, id: &str, model: &str) -> Result<(), AppError> {
    let changed = conn.execute(
        "UPDATE conversations
         SET model = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ?2",
        rusqlite::params![model, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Conversation '{id}' not found")));
    }
    Ok(())
}

/// Persist generation settings for a conversation.
pub fn update_settings(conn: &Connection, id: &str, settings_json: &str) -> Result<(), AppError> {
    let changed = conn.execute(
        "UPDATE conversations
         SET settings_json = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ?2",
        rusqlite::params![settings_json, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Conversation '{id}' not found")));
    }
    Ok(())
}

/// Pin or un-pin a conversation.
pub fn set_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<(), AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let changed = conn.execute(
        "UPDATE conversations SET pinned = ?1, updated_at = ?2 WHERE id = ?3",
        params![pinned as i64, now, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Conversation '{id}' not found")));
    }
    Ok(())
}

/// Update (or create) the system prompt for a conversation by modifying the first 'system' message.
pub fn update_system_prompt(
    conn: &Connection,
    id: &str,
    system_prompt: &str,
) -> Result<(), AppError> {
    // Check if a system message already exists for this conversation
    let existing_id: Option<String> = conn.query_row(
        "SELECT id FROM messages WHERE conversation_id = ?1 AND role = 'system' ORDER BY created_at ASC LIMIT 1",
        params![id],
        |row| row.get(0)
    ).optional().map_err(AppError::from)?;

    if let Some(msg_id) = existing_id {
        // Update existing
        conn.execute(
            "UPDATE messages SET content = ?1 WHERE id = ?2",
            params![system_prompt, msg_id],
        )?;
    } else {
        // Create new
        crate::db::messages::create(
            conn,
            crate::db::messages::NewMessage {
                conversation_id: id.to_string(),
                role: crate::db::messages::MessageRole::System,
                content: system_prompt.to_string(),
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
                thinking: None,
                tool_calls_json: None,
                tool_name: None,
            },
        )?;
    }

    // Touch conversation's updated_at
    touch_updated_at(conn, id)?;
    Ok(())
}

/// Update the draft JSON for a conversation.
pub fn update_draft(conn: &Connection, id: &str, draft_json: Option<&str>) -> Result<(), AppError> {
    let changed = conn.execute(
        "UPDATE conversations SET draft_json = ?1 WHERE id = ?2",
        params![draft_json, id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Conversation '{id}' not found")));
    }
    Ok(())
}

/// Touch updated_at whenever a new message arrives.
pub fn touch_updated_at(conn: &Connection, id: &str) -> Result<(), AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

/// Permanently delete a conversation and all its messages (cascade).
pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    let changed = conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("Conversation '{id}' not found")));
    }
    Ok(())
}

/// Full-text search across title and a join on message content.
///
/// Searches titles first, then falls back to message content.
/// Deduplicated; limited to 50 results.
pub fn search(conn: &Connection, query: &str) -> Result<Vec<Conversation>, AppError> {
    let pattern = format!("%{query}%");
    let mut stmt = conn.prepare(
        "SELECT DISTINCT c.id, c.title, c.model,
                c.settings_json, c.pinned, c.tags, c.created_at, c.updated_at, c.draft_json
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.title  LIKE ?1
            OR m.content LIKE ?1
         ORDER BY c.pinned DESC, c.updated_at DESC
         LIMIT 50",
    )?;

    let rows = stmt.query_map(params![pattern], row_to_conversation)?;
    rows.map(|r| r.map_err(AppError::from))
        .collect::<Result<Vec<_>, _>>()
}

/// Fetch the conversation and its active messages — shared by all export formats.
pub(crate) fn fetch_export_data(
    conn: &Connection,
    conversation_id: &str,
) -> Result<(Conversation, Vec<crate::db::messages::Message>), AppError> {
    let conv = get_by_id(conn, conversation_id)?;
    let msgs = crate::db::messages::list_for_conversation(conn, conversation_id)?;
    Ok((conv, msgs))
}

/// Export a conversation to a JSON file.
pub fn export_to_path(
    conn: &Connection,
    conversation_id: &str,
    path: &std::path::Path,
) -> Result<(), AppError> {
    let (conv, msgs) = fetch_export_data(conn, conversation_id)?;
    let json_str = serde_json::to_string_pretty(&serde_json::json!({
        "conversation": conv,
        "messages": msgs,
    }))?;
    std::fs::write(path, json_str)?;
    Ok(())
}

/// Export a conversation to a Markdown file.
pub fn export_to_markdown_path(
    conn: &Connection,
    conversation_id: &str,
    path: &std::path::Path,
) -> Result<(), AppError> {
    let (conv, msgs) = fetch_export_data(conn, conversation_id)?;
    let mut out = format!(
        "# {}\n\nModel: {}\nDate: {}\n\n---\n\n",
        conv.title, conv.model, conv.created_at
    );
    for msg in &msgs {
        let label = match msg.role {
            crate::db::messages::MessageRole::User => "User",
            crate::db::messages::MessageRole::Assistant => "Assistant",
            crate::db::messages::MessageRole::System => "System",
            crate::db::messages::MessageRole::CompactSummary => continue,
        };
        let clean = crate::services::chat::strip_history_content(&msg.content);
        out.push_str(&format!("**{}:**\n\n{}\n\n---\n\n", label, clean));
    }
    std::fs::write(path, out)?;
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
    fn create_and_list() {
        let conn = in_memory_conn();
        let new = NewConversation {
            title: "Hello".into(),
            model: "llama3".into(),
            settings_json: None,
            tags: Some(vec!["test".into()]),
        };
        let conv = create(&conn, new).unwrap();
        assert_eq!(conv.title, "Hello");
        assert_eq!(conv.tags, vec!["test"]);

        let list = list(&conn, 10, 0).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, conv.id);
    }

    #[test]
    fn update_title_and_pin() {
        let conn = in_memory_conn();
        let conv = create(
            &conn,
            NewConversation {
                title: "Old".into(),
                model: "m".into(),
                settings_json: None,
                tags: None,
            },
        )
        .unwrap();

        update_title(&conn, &conv.id, "New").unwrap();
        set_pinned(&conn, &conv.id, true).unwrap();

        let updated = get_by_id(&conn, &conv.id).unwrap();
        assert_eq!(updated.title, "New");
        assert!(updated.pinned);
    }

    #[test]
    fn delete_conversation() {
        let conn = in_memory_conn();
        let conv = create(
            &conn,
            NewConversation {
                title: "Tmp".into(),
                model: "m".into(),
                settings_json: None,
                tags: None,
            },
        )
        .unwrap();

        delete(&conn, &conv.id).unwrap();
        assert!(list(&conn, 10, 0).unwrap().is_empty());
    }

    #[test]
    fn update_settings_persists_json() {
        let conn = in_memory_conn();
        let conv = create(
            &conn,
            NewConversation {
                title: "Settings test".into(),
                model: "llama3".into(),
                settings_json: None,
                tags: None,
            },
        )
        .unwrap();

        let json = r#"{"temperature":0.8,"top_p":0.9}"#;
        update_settings(&conn, &conv.id, json).unwrap();

        let updated = get_by_id(&conn, &conv.id).unwrap();
        assert_eq!(updated.settings_json, json);
    }

    #[test]
    fn update_settings_missing_id_returns_not_found() {
        let conn = in_memory_conn();
        let result = update_settings(&conn, "nonexistent-id", "{}");
        assert!(matches!(result, Err(AppError::NotFound(_))));
    }

    #[test]
    fn search_by_title() {
        let conn = in_memory_conn();
        create(
            &conn,
            NewConversation {
                title: "Rust programming".into(),
                model: "m".into(),
                settings_json: None,
                tags: None,
            },
        )
        .unwrap();

        let results = search(&conn, "Rust").unwrap();
        assert_eq!(results.len(), 1);

        let empty = search(&conn, "Python").unwrap();
        assert!(empty.is_empty());
    }

    #[test]
    fn fetch_export_data_returns_conversation_and_messages() {
        let conn = in_memory_conn();
        let conv = create(
            &conn,
            NewConversation {
                title: "Export Test".into(),
                model: "llama3".into(),
                settings_json: None,
                tags: None,
            },
        )
        .unwrap();
        crate::db::messages::create(
            &conn,
            crate::db::messages::NewMessage {
                conversation_id: conv.id.clone(),
                role: crate::db::messages::MessageRole::User,
                content: "Hello".into(),
                ..Default::default()
            },
        )
        .unwrap();

        let (fetched_conv, msgs) = fetch_export_data(&conn, &conv.id).unwrap();
        assert_eq!(fetched_conv.title, "Export Test");
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].content, "Hello");
    }

    #[test]
    fn export_to_markdown_path_creates_file() {
        let conn = in_memory_conn();
        let conv = create(
            &conn,
            NewConversation {
                title: "MD Export".into(),
                model: "gemma3".into(),
                settings_json: None,
                tags: None,
            },
        )
        .unwrap();
        crate::db::messages::create(
            &conn,
            crate::db::messages::NewMessage {
                conversation_id: conv.id.clone(),
                role: crate::db::messages::MessageRole::User,
                content: "Hi there".into(),
                ..Default::default()
            },
        )
        .unwrap();
        crate::db::messages::create(
            &conn,
            crate::db::messages::NewMessage {
                conversation_id: conv.id.clone(),
                role: crate::db::messages::MessageRole::Assistant,
                content: "Hello!".into(),
                ..Default::default()
            },
        )
        .unwrap();
        crate::db::messages::create(
            &conn,
            crate::db::messages::NewMessage {
                conversation_id: conv.id.clone(),
                role: crate::db::messages::MessageRole::CompactSummary,
                content: "should_be_skipped".into(),
                ..Default::default()
            },
        )
        .unwrap();

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.md");
        export_to_markdown_path(&conn, &conv.id, &path).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("# MD Export"));
        assert!(content.contains("**User:**"));
        assert!(content.contains("Hi there"));
        assert!(content.contains("**Assistant:**"));
        assert!(content.contains("Hello!"));
        assert!(!content.contains("should_be_skipped"));
    }

    #[test]
    fn export_to_markdown_strips_think_and_tool_call_tags() {
        let conn = in_memory_conn();
        let conv = create(
            &conn,
            NewConversation {
                title: "Strip Test".into(),
                model: "llama3".into(),
                settings_json: None,
                tags: None,
            },
        )
        .unwrap();
        crate::db::messages::create(
            &conn,
            crate::db::messages::NewMessage {
                conversation_id: conv.id.clone(),
                role: crate::db::messages::MessageRole::Assistant,
                content: "<think>internal reasoning</think>Answer<tool_call>{}</tool_call>".into(),
                ..Default::default()
            },
        )
        .unwrap();

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("strip.md");
        export_to_markdown_path(&conn, &conv.id, &path).unwrap();

        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("Answer"));
        assert!(!content.contains("<think>"));
        assert!(!content.contains("</think>"));
        assert!(!content.contains("<tool_call>"));
        assert!(!content.contains("</tool_call>"));
        assert!(!content.contains("internal reasoning"));
    }
}
