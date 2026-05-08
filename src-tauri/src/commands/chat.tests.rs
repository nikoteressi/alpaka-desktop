use crate::db;
use crate::db::conversations::NewConversation;
use crate::db::messages::{MessageRole, NewMessage};
use rusqlite::Connection;
use serde_json::json;
use std::fs;
use uuid::Uuid;

#[test]
fn test_export_conversation_to_path_red() {
    let dir = std::env::temp_dir().join(Uuid::new_v4().to_string());
    fs::create_dir_all(&dir).unwrap();
    let db_path = dir.join("test.db");
    let conn = Connection::open(&db_path).unwrap();
    db::migrations::run(&conn).unwrap();

    let conv = db::conversations::create(
        &conn,
        NewConversation {
            title: "Test".into(),
            model: "llama3".into(),
            settings_json: None,
            tags: None,
        },
    )
    .unwrap();

    db::messages::create(
        &conn,
        NewMessage {
            conversation_id: conv.id.clone(),
            role: MessageRole::User,
            content: "Hello from test".into(),
            ..Default::default()
        },
    )
    .unwrap();

    let export_path = dir.join("export.json");
    db::conversations::export_to_path(&conn, &conv.id, &export_path).unwrap();

    // Should have created a file
    assert!(export_path.exists(), "Export file was not created");
    let content = fs::read_to_string(&export_path).unwrap();
    assert!(
        content.contains("Hello from test"),
        "Exported JSON does not contain the message"
    );
}

#[test]
fn test_backup_database_red() {
    // Use backup_connections directly to avoid keyring dependency in test environments.
    // backup_to_path wraps backup_connections with encryption; this test validates
    // the SQLite copy mechanism itself.
    let src = Connection::open_in_memory().unwrap();
    db::migrations::run(&src).unwrap();
    db::conversations::create(
        &src,
        NewConversation {
            title: "BackupTest".into(),
            model: "test-model".into(),
            settings_json: None,
            tags: None,
        },
    )
    .unwrap();

    let mut dst = Connection::open_in_memory().unwrap();
    db::backup_connections(&src, &mut dst).unwrap();

    let convs = db::conversations::list(&dst, 10, 0).unwrap();
    assert_eq!(convs.len(), 1, "Backup should contain one conversation");
    assert_eq!(convs[0].title, "BackupTest");
}

#[test]
fn test_format_search_results_red() {
    let raw = json!({
        "results": [
            {
                "title": "Test Title 1",
                "url": "https://test1.com",
                "content": "Description 1"
            },
            {
                "title": "Test Title 2",
                "url": "https://test2.com",
                "content": "Description 2"
            }
        ]
    })
    .to_string();

    let formatted = crate::ollama::search::format_search_results_for_llm(&raw);
    assert!(formatted.contains("Search Results:"));
    assert!(formatted.contains("[1] Title: Test Title 1"));
    assert!(formatted.contains("URL: https://test1.com"));
    assert!(formatted.contains("Content: Description 1"));
    assert!(formatted.contains("[2] Title: Test Title 2"));
}
