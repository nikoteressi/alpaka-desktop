use alpaka_desktop_lib::db;
use alpaka_desktop_lib::db::folders::{
    add_folder_context, delete_folder_context, get_by_conversation, update_folder_context,
    NewFolderContext,
};
use rusqlite::Connection;
/// Integration tests for the folders command module and db/folders.rs layer.
use std::fs;
use std::io::Write;
use tempfile::tempdir;

// ── DB layer helpers ───────────────────────────────────────────────────────────

fn in_memory_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;",
    )
    .unwrap();
    db::migrations::run(&conn).unwrap();
    conn
}

/// Insert a minimal conversation row so FK constraints are satisfied.
fn seed_conversation(conn: &Connection, id: &str) {
    conn.execute(
        "INSERT OR IGNORE INTO conversations (id, title, model, system_prompt, settings_json, pinned, tags, created_at, updated_at)
         VALUES (?1, 'test', 'llama3', '', '{}', 0, '', datetime('now'), datetime('now'))",
        rusqlite::params![id],
    )
    .unwrap();
}

// ── DB layer: update_folder_context ───────────────────────────────────────────

#[test]
fn test_update_folder_context_changes_files_and_tokens() {
    let conn = in_memory_db();
    seed_conversation(&conn, "conv-upd-1");

    let ctx = add_folder_context(
        &conn,
        NewFolderContext {
            conversation_id: "conv-upd-1".into(),
            path: "/tmp/test-project".into(),
            included_files_json: None,
            auto_refresh: false,
            estimated_tokens: 100,
        },
    )
    .unwrap();

    let new_files = Some("[\"src/main.rs\",\"Cargo.toml\"]".to_string());
    update_folder_context(&conn, &ctx.id, new_files.clone(), 500).unwrap();

    let updated = db::folders::get_folder_context(&conn, &ctx.id).unwrap();
    assert_eq!(
        updated.included_files_json, new_files,
        "included_files_json should have been updated"
    );
    assert_eq!(
        updated.estimated_tokens, 500,
        "estimated_tokens should have been updated"
    );
}

#[test]
fn test_update_folder_context_not_found() {
    let conn = in_memory_db();

    let result = update_folder_context(&conn, "nonexistent-id", None, 0);
    assert!(result.is_err(), "Should error on unknown folder context id");
    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("not found") || err.contains("Not found"),
        "Error message should mention 'not found': {err}"
    );
}

// ── DB layer: delete_folder_context ───────────────────────────────────────────

#[test]
fn test_delete_folder_context_removes_record() {
    let conn = in_memory_db();
    seed_conversation(&conn, "conv-del-1");

    let ctx = add_folder_context(
        &conn,
        NewFolderContext {
            conversation_id: "conv-del-1".into(),
            path: "/tmp/delete-me".into(),
            included_files_json: None,
            auto_refresh: false,
            estimated_tokens: 10,
        },
    )
    .unwrap();

    delete_folder_context(&conn, &ctx.id).unwrap();

    let remaining = get_by_conversation(&conn, "conv-del-1").unwrap();
    assert!(
        remaining.is_empty(),
        "Expected no folder contexts after deletion"
    );
}

#[test]
fn test_delete_folder_context_not_found() {
    let conn = in_memory_db();

    let result = delete_folder_context(&conn, "no-such-id");
    assert!(
        result.is_err(),
        "Should error when deleting a non-existent context"
    );
}

#[test]
fn test_delete_only_removes_targeted_context() {
    let conn = in_memory_db();
    seed_conversation(&conn, "conv-del-2");

    let ctx1 = add_folder_context(
        &conn,
        NewFolderContext {
            conversation_id: "conv-del-2".into(),
            path: "/tmp/folder-a".into(),
            included_files_json: None,
            auto_refresh: false,
            estimated_tokens: 10,
        },
    )
    .unwrap();

    let ctx2 = add_folder_context(
        &conn,
        NewFolderContext {
            conversation_id: "conv-del-2".into(),
            path: "/tmp/folder-b".into(),
            included_files_json: None,
            auto_refresh: false,
            estimated_tokens: 20,
        },
    )
    .unwrap();

    delete_folder_context(&conn, &ctx1.id).unwrap();

    let remaining = get_by_conversation(&conn, "conv-del-2").unwrap();
    assert_eq!(remaining.len(), 1, "Only ctx1 should have been deleted");
    assert_eq!(remaining[0].id, ctx2.id);
}

// ── Command layer: list_folder_files ──────────────────────────────────────────

#[tokio::test]
async fn test_list_folder_files_returns_text_files() {
    let dir = tempdir().unwrap();
    let base = dir.path();

    // Text file at root
    fs::write(base.join("hello.txt"), "hello world").unwrap();

    // Text file in subdirectory
    let sub = base.join("src");
    fs::create_dir(&sub).unwrap();
    fs::write(sub.join("main.rs"), "fn main() {}").unwrap();

    // Binary file (should be excluded)
    let mut bin = fs::File::create(base.join("data.bin")).unwrap();
    bin.write_all(&[0x00, 0x01, 0x02, 0x03]).unwrap();

    let path_str = base.to_string_lossy().to_string();
    let files = alpaka_desktop_lib::commands::folders::list_folder_files(path_str)
        .await
        .unwrap();

    assert!(
        files.iter().any(|f| f.contains("hello.txt")),
        "Expected hello.txt in file list, got: {:?}",
        files
    );
    assert!(
        files.iter().any(|f| f.contains("main.rs")),
        "Expected src/main.rs in file list, got: {:?}",
        files
    );
    assert!(
        !files.iter().any(|f| f.contains("data.bin")),
        "Binary file data.bin should be excluded, but found it in: {:?}",
        files
    );
}

#[tokio::test]
async fn test_list_folder_files_empty_directory() {
    let dir = tempdir().unwrap();
    let path_str = dir.path().to_string_lossy().to_string();

    let files = alpaka_desktop_lib::commands::folders::list_folder_files(path_str)
        .await
        .unwrap();

    assert!(
        files.is_empty(),
        "Expected empty list for empty directory, got: {:?}",
        files
    );
}

// ── Command layer: estimate_tokens ────────────────────────────────────────────

#[tokio::test]
async fn test_estimate_tokens_whole_folder() {
    let dir = tempdir().unwrap();
    let base = dir.path();

    // Write a file with exactly 400 ASCII characters → 100 tokens (chars / 4)
    let content = "a".repeat(400);
    fs::write(base.join("content.txt"), &content).unwrap();

    let path_str = base.to_string_lossy().to_string();
    let tokens = alpaka_desktop_lib::commands::folders::estimate_tokens(path_str, None)
        .await
        .unwrap();

    // The formula is total_chars / 4; chars per file wrapped in header:
    // "\n--- File: content.txt ---\n{400 chars}\n" = 400 + some overhead
    // We just verify it's non-zero and proportional.
    assert!(
        tokens > 0,
        "Token estimate should be > 0 for non-empty file"
    );
}

#[tokio::test]
async fn test_estimate_tokens_specific_files() {
    let dir = tempdir().unwrap();
    let base = dir.path();

    // File A: 400 chars
    let content_a = "x".repeat(400);
    fs::write(base.join("a.txt"), &content_a).unwrap();

    // File B: 800 chars (should be excluded from estimate when only a.txt is selected)
    let content_b = "y".repeat(800);
    fs::write(base.join("b.txt"), &content_b).unwrap();

    let path_str = base.to_string_lossy().to_string();

    // Estimate only for a.txt (relative path)
    let tokens_a = alpaka_desktop_lib::commands::folders::estimate_tokens(
        path_str.clone(),
        Some(vec!["a.txt".to_string()]),
    )
    .await
    .unwrap();

    // Estimate only for b.txt
    let tokens_b = alpaka_desktop_lib::commands::folders::estimate_tokens(
        path_str.clone(),
        Some(vec!["b.txt".to_string()]),
    )
    .await
    .unwrap();

    // b.txt has double the characters, so its token estimate must be higher
    assert!(
        tokens_b > tokens_a,
        "b.txt ({} tokens) should have more tokens than a.txt ({} tokens)",
        tokens_b,
        tokens_a
    );

    // Combined estimate should equal tokens_a + tokens_b
    let tokens_both = alpaka_desktop_lib::commands::folders::estimate_tokens(
        path_str,
        Some(vec!["a.txt".to_string(), "b.txt".to_string()]),
    )
    .await
    .unwrap();

    assert_eq!(
        tokens_both,
        tokens_a + tokens_b,
        "Combined estimate should equal sum of individual estimates"
    );
}

// ── DB layer: update_folder_context round-trip ────────────────────────────────

#[test]
fn test_update_folder_context_roundtrip_with_real_conversation() {
    let conn = in_memory_db();

    // Create a real conversation via the conversations module (not a raw INSERT)
    let conv = db::conversations::create(
        &conn,
        db::conversations::NewConversation {
            title: "Folder test".into(),
            model: "llama3".into(),
            settings_json: None,
            tags: None,
        },
    )
    .unwrap();

    // Add a folder context
    let ctx = add_folder_context(
        &conn,
        NewFolderContext {
            conversation_id: conv.id.clone(),
            path: "/home/user/project".into(),
            included_files_json: Some("[\"README.md\"]".into()),
            auto_refresh: true,
            estimated_tokens: 200,
        },
    )
    .unwrap();

    assert_eq!(ctx.conversation_id, conv.id);
    assert!(ctx.auto_refresh);
    assert_eq!(ctx.estimated_tokens, 200);

    // Update it
    update_folder_context(
        &conn,
        &ctx.id,
        Some("[\"README.md\",\"src/main.rs\"]".into()),
        350,
    )
    .unwrap();

    // Verify via get_by_conversation
    let list = get_by_conversation(&conn, &conv.id).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].estimated_tokens, 350);
    assert!(
        list[0]
            .included_files_json
            .as_deref()
            .unwrap_or("")
            .contains("src/main.rs"),
        "included_files_json should contain src/main.rs"
    );
}
