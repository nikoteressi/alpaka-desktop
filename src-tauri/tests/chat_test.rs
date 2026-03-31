use mockito::Server;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::test::{mock_builder, mock_context, MockRuntime, noop_assets};
use tauri::{AppHandle, Manager, Listener};
use ollama_desktop_lib::state::AppState;
use ollama_desktop_lib::db;
use ollama_desktop_lib::commands::chat::send_message;
use ollama_desktop_lib::db::conversations::NewConversation;
use ollama_desktop_lib::db::hosts::NewHost;
use rusqlite::Connection;

#[tokio::test]
async fn test_send_message_emits_events() {
    let mut server = Server::new_async().await;
    let url = server.url();

    // Mock the streaming response
    let mock = server.mock("POST", "/api/chat")
        .with_status(200)
        .with_header("content-type", "application/x-ndjson")
        .with_body(
            "{\"model\":\"llama3\",\"created_at\":\"2023-08-04T19:22:45.499127Z\",\"message\":{\"role\":\"assistant\",\"content\":\"<think>\\nThinking about this...\\n</think>\\nHello! I am an AI.\"},\"done\":true,\"total_duration\":1000,\"load_duration\":10,\"prompt_eval_count\":10,\"eval_count\":10,\"eval_duration\":1000}\n"
        )
        .create_async()
        .await;

    // Set up a mock app
    let app = mock_builder()
        .build(mock_context(noop_assets()))
        .unwrap();

    let app_handle: AppHandle<MockRuntime> = app.handle().clone();
    
    // Set up state
    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();

    let _host = db::hosts::create(&direct_conn, NewHost {
        name: "Test Host".into(),
        url: url.clone(),
        is_default: Some(true),
    }).unwrap();

    let conv = db::conversations::create(&direct_conn, NewConversation {
        title: "Test".into(),
        model: "llama3".into(),
        system_prompt: None,
        settings_json: None,
        tags: None,
    }).unwrap();

    let conn = std::sync::Arc::new(std::sync::Mutex::new(direct_conn));
    let app_state = AppState::new(conn);
    app_handle.manage(app_state);

    let state = app_handle.state::<AppState>();

    // Listen to events
    let events = Arc::new(Mutex::new(Vec::new()));
    let events_clone1 = events.clone();
    app_handle.listen("chat:token", move |event| {
        events_clone1.lock().unwrap().push(format!("chat:token: {}", event.payload()));
    });
    
    let events_clone2 = events.clone();
    app_handle.listen("chat:thinking-start", move |_event| {
        events_clone2.lock().unwrap().push("thinking-start".to_string());
    });

    let events_clone3 = events.clone();
    app_handle.listen("chat:thinking-end", move |_event| {
        events_clone3.lock().unwrap().push("thinking-end".to_string());
    });

    // Invoke command
    let res: Result<(), ollama_desktop_lib::error::AppError> = send_message(
        state,
        app_handle.clone(),
        conv.id.clone(),
        "Hi".into(),
        None,
        "llama3".into(),
        None
    ).await;

    assert!(res.is_ok(), "send_message failed: {:?}", res);
    
    // Give events a moment to process
    tokio::time::sleep(Duration::from_millis(100)).await;

    mock.assert_async().await;

    let emitted = events.lock().unwrap();
    assert!(emitted.contains(&"thinking-start".to_string()), "Did not emit chat:thinking-start");
    assert!(emitted.contains(&"thinking-end".to_string()), "Did not emit chat:thinking-end");
    
    let tokens: Vec<&String> = emitted.iter()
        .filter(|s| s.contains("chat:token"))
        .collect();
    
    assert!(!tokens.is_empty(), "Did not emit any chat:token events");
}
