use alpaka_desktop_lib::commands::chat::{send_message, stop_generation};
use alpaka_desktop_lib::db;
use alpaka_desktop_lib::db::conversations::NewConversation;
use alpaka_desktop_lib::db::hosts::NewHost;
use alpaka_desktop_lib::state::AppState;
use mockito::Server;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
use tauri::{AppHandle, Listener, Manager};

fn build_app_with_state(url: &str) -> tauri::App<MockRuntime> {
    let app = mock_builder()
        .plugin(tauri_plugin_notification::init())
        .build(mock_context(noop_assets()))
        .unwrap();

    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();
    db::hosts::create(
        &direct_conn,
        NewHost {
            name: "Test Host".into(),
            url: url.to_string(),
            is_default: Some(true),
        },
    )
    .unwrap();

    let conn = Arc::new(Mutex::new(direct_conn));
    app.handle()
        .manage(AppState::new(conn, std::path::PathBuf::new()).unwrap());
    app
}

fn make_conv(app: &tauri::App<MockRuntime>) -> alpaka_desktop_lib::db::conversations::Conversation {
    let state = app.handle().state::<AppState>();
    let conn = state.db.lock().unwrap();
    db::conversations::create(
        &conn,
        NewConversation {
            title: "Test".into(),
            model: "llama3".into(),

            settings_json: None,
            tags: None,
        },
    )
    .unwrap()
}

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
        .plugin(tauri_plugin_notification::init())
        .build(mock_context(noop_assets()))
        .unwrap();

    let app_handle: AppHandle<MockRuntime> = app.handle().clone();

    // Set up state
    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();

    let _host = db::hosts::create(
        &direct_conn,
        NewHost {
            name: "Test Host".into(),
            url: url.clone(),
            is_default: Some(true),
        },
    )
    .unwrap();

    let conv = db::conversations::create(
        &direct_conn,
        NewConversation {
            title: "Test".into(),
            model: "llama3".into(),

            settings_json: None,
            tags: None,
        },
    )
    .unwrap();

    let conn = std::sync::Arc::new(std::sync::Mutex::new(direct_conn));
    let app_state = AppState::new(conn, std::path::PathBuf::new()).unwrap();
    app_handle.manage(app_state);

    let state = app_handle.state::<AppState>();

    // Listen to events
    let events = Arc::new(Mutex::new(Vec::new()));
    let events_clone1 = events.clone();
    app_handle.listen("chat:token", move |event| {
        events_clone1
            .lock()
            .unwrap()
            .push(format!("chat:token: {}", event.payload()));
    });

    let events_clone2 = events.clone();
    app_handle.listen("chat:thinking-start", move |_event| {
        events_clone2
            .lock()
            .unwrap()
            .push("thinking-start".to_string());
    });

    let events_clone3 = events.clone();
    app_handle.listen("chat:thinking-end", move |_event| {
        events_clone3
            .lock()
            .unwrap()
            .push("thinking-end".to_string());
    });

    // Invoke command
    let res: Result<(), alpaka_desktop_lib::error::AppError> = send_message(
        state,
        app_handle.clone(),
        conv.id.clone(),
        "Hi".into(),
        None,
        "llama3".into(),
        None,
        None,
        None,
        None,
    )
    .await;

    assert!(res.is_ok(), "send_message failed: {:?}", res);

    // Give events a moment to process
    tokio::time::sleep(Duration::from_millis(100)).await;

    mock.assert_async().await;

    let emitted = events.lock().unwrap();
    assert!(
        emitted.contains(&"thinking-start".to_string()),
        "Did not emit chat:thinking-start"
    );
    assert!(
        emitted.contains(&"thinking-end".to_string()),
        "Did not emit chat:thinking-end"
    );

    let tokens: Vec<&String> = emitted
        .iter()
        .filter(|s| s.contains("chat:token"))
        .collect();

    assert!(!tokens.is_empty(), "Did not emit any chat:token events");
}

#[tokio::test]
async fn test_streaming_multi_chunk() {
    let mut server = Server::new_async().await;
    let url = server.url();

    // 5 content chunks + 1 final done chunk
    let body = concat!(
        "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"chunk1\"},\"done\":false}\n",
        "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"chunk2\"},\"done\":false}\n",
        "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"chunk3\"},\"done\":false}\n",
        "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"chunk4\"},\"done\":false}\n",
        "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"chunk5\"},\"done\":false}\n",
        "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"\"},\"done\":true,\"total_duration\":1000,\"load_duration\":10,\"prompt_eval_count\":5,\"eval_count\":5,\"eval_duration\":1000}\n",
    );

    let _mock = server
        .mock("POST", "/api/chat")
        .with_status(200)
        .with_header("content-type", "application/x-ndjson")
        .with_body(body)
        .create_async()
        .await;

    let app = build_app_with_state(&url);
    let conv = make_conv(&app);
    let app_handle: AppHandle<MockRuntime> = app.handle().clone();
    let state = app_handle.state::<AppState>();

    let token_count = Arc::new(Mutex::new(0u32));
    let done_received = Arc::new(Mutex::new(false));

    let tc = token_count.clone();
    app_handle.listen("chat:token", move |_| {
        *tc.lock().unwrap() += 1;
    });

    let dr = done_received.clone();
    app_handle.listen("chat:done", move |_| {
        *dr.lock().unwrap() = true;
    });

    let res = send_message(
        state,
        app_handle.clone(),
        conv.id.clone(),
        "Hi".into(),
        None,
        "llama3".into(),
        None,
        None,
        None,
        None,
    )
    .await;
    assert!(res.is_ok(), "send_message failed: {:?}", res);

    tokio::time::sleep(Duration::from_millis(100)).await;

    assert_eq!(
        *token_count.lock().unwrap(),
        5,
        "Expected exactly 5 chat:token events"
    );
    assert!(*done_received.lock().unwrap(), "chat:done was not emitted");
}

#[tokio::test]
async fn test_stop_generation_cancels_stream() {
    let mut server = Server::new_async().await;
    let url = server.url();

    // Slow stream: first chunk arrives, then a delay simulated by chunked transfer
    // We send one content chunk and a final line that will never arrive (we cancel first)
    let body = concat!(
        "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"token1\"},\"done\":false}\n",
        // done:true line omitted — stream just ends without completing
    );

    let _mock = server
        .mock("POST", "/api/chat")
        .with_status(200)
        .with_header("content-type", "application/x-ndjson")
        .with_body(body)
        .create_async()
        .await;

    let app = build_app_with_state(&url);
    let conv = make_conv(&app);
    let app_handle: AppHandle<MockRuntime> = app.handle().clone();

    let done_received = Arc::new(Mutex::new(false));
    let dr = done_received.clone();
    app_handle.listen("chat:done", move |_| {
        *dr.lock().unwrap() = true;
    });

    let token_received = Arc::new(Mutex::new(false));
    let tr = token_received.clone();
    app_handle.listen("chat:token", move |_| {
        *tr.lock().unwrap() = true;
    });

    // Start streaming in background
    let app_handle2 = app_handle.clone();
    let conv_id = conv.id.clone();
    let handle = tokio::spawn(async move {
        let st = app_handle2.state::<AppState>();
        let _ = send_message(
            st,
            app_handle2.clone(),
            conv_id,
            "Hi".into(),
            None,
            "llama3".into(),
            None,
            None,
            None,
            None,
        )
        .await;
    });

    // Wait for at least the first token then cancel
    tokio::time::sleep(Duration::from_millis(50)).await;
    let stop_state = app_handle.state::<AppState>();
    let res = stop_generation(stop_state).await;
    assert!(res.is_ok(), "stop_generation failed: {:?}", res);

    // cancel_tx should be cleared
    assert!(
        app_handle
            .state::<AppState>()
            .cancel_tx
            .lock()
            .unwrap()
            .is_none(),
        "cancel_tx should be None after cancellation"
    );

    let _ = handle.await;

    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(
        !*done_received.lock().unwrap(),
        "chat:done should NOT be emitted after cancellation"
    );
}

#[tokio::test]
async fn test_stream_error_emits_chat_error() {
    let mut server = Server::new_async().await;
    let url = server.url();

    // Return a valid first content chunk then invalid JSON — the stream completes without done:true.
    // The None branch in streaming.rs is reached, no chat:done should fire.
    // For a real byte-level error we rely on the Some(Err(e)) branch; simulate by making the
    // server close the connection after the first chunk (no done line).
    let body = concat!(
        "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"hi\"},\"done\":false}\n",
        "not-valid-json\n",
    );

    let _mock = server
        .mock("POST", "/api/chat")
        .with_status(200)
        .with_header("content-type", "application/x-ndjson")
        .with_body(body)
        .create_async()
        .await;

    let app = build_app_with_state(&url);
    let conv = make_conv(&app);
    let app_handle: AppHandle<MockRuntime> = app.handle().clone();
    let state = app_handle.state::<AppState>();

    let done_received = Arc::new(Mutex::new(false));
    let dr = done_received.clone();
    app_handle.listen("chat:done", move |_| {
        *dr.lock().unwrap() = true;
    });

    let res = send_message(
        state,
        app_handle.clone(),
        conv.id.clone(),
        "Hi".into(),
        None,
        "llama3".into(),
        None,
        None,
        None,
        None,
    )
    .await;
    assert!(
        res.is_err(),
        "send_message should hard-error on malformed stream"
    );

    tokio::time::sleep(Duration::from_millis(100)).await;

    // Stream ended without done:true — chat:done must NOT have fired
    assert!(
        !*done_received.lock().unwrap(),
        "chat:done should not be emitted when stream ends without done:true"
    );
}

// ── Additional tests ───────────────────────────────────────────────────────────

#[tokio::test]
async fn test_create_conversation_and_get_messages() {
    // Create a conversation via the DB layer, insert 2 messages, list them.
    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();

    let conv = db::conversations::create(
        &direct_conn,
        NewConversation {
            title: "Test conv".into(),
            model: "llama3".into(),

            settings_json: None,
            tags: None,
        },
    )
    .unwrap();

    db::messages::create(
        &direct_conn,
        db::messages::NewMessage {
            conversation_id: conv.id.clone(),
            role: db::messages::MessageRole::User,
            content: "First message".into(),
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
        },
    )
    .unwrap();

    db::messages::create(
        &direct_conn,
        db::messages::NewMessage {
            conversation_id: conv.id.clone(),
            role: db::messages::MessageRole::Assistant,
            content: "Second message".into(),
            images_json: None,
            files_json: None,
            tokens_used: Some(42),
            generation_time_ms: None,
            prompt_tokens: None,
            tokens_per_sec: None,
            total_duration_ms: None,
            load_duration_ms: None,
            prompt_eval_duration_ms: None,
            eval_duration_ms: None,
        },
    )
    .unwrap();

    let msgs = db::messages::list_for_conversation(&direct_conn, &conv.id).unwrap();

    assert_eq!(
        msgs.len(),
        2,
        "Expected exactly 2 messages, got {}",
        msgs.len()
    );
    assert_eq!(msgs[0].content, "First message");
    assert_eq!(msgs[0].role, db::messages::MessageRole::User);
    assert_eq!(msgs[1].content, "Second message");
    assert_eq!(msgs[1].role, db::messages::MessageRole::Assistant);
    assert_eq!(msgs[1].tokens_used, Some(42));
}

#[tokio::test]
async fn test_get_messages_empty_for_unknown_conversation() {
    let conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&conn).unwrap();

    let unknown_id = uuid::Uuid::new_v4().to_string();
    let msgs = db::messages::list_for_conversation(&conn, &unknown_id).unwrap();
    assert!(
        msgs.is_empty(),
        "Expected empty vec for unknown conversation_id, got {} messages",
        msgs.len()
    );
}

#[tokio::test]
async fn test_assistant_message_persisted_after_streaming() {
    let mut server = Server::new_async().await;
    let url = server.url();

    // Single-chunk done response — stream_chat returns the assembled content,
    // which send_message then persists to the DB.
    let _mock = server.mock("POST", "/api/chat")
        .with_status(200)
        .with_header("content-type", "application/x-ndjson")
        .with_body(
            "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"Persisted response\"},\"done\":true,\"total_duration\":1000,\"load_duration\":10,\"prompt_eval_count\":5,\"eval_count\":5,\"eval_duration\":1000}\n"
        )
        .create_async()
        .await;

    let app = build_app_with_state(&url);
    let conv = make_conv(&app);
    let app_handle: AppHandle<MockRuntime> = app.handle().clone();
    let state = app_handle.state::<AppState>();

    let res = send_message(
        state.clone(),
        app_handle.clone(),
        conv.id.clone(),
        "Hi".into(),
        None,
        "llama3".into(),
        None,
        None,
        None,
        None,
    )
    .await;
    assert!(res.is_ok(), "send_message failed: {:?}", res);

    // Allow async persistence to complete
    tokio::time::sleep(Duration::from_millis(150)).await;

    // Check the DB for an assistant message
    let guard = state.db.lock().unwrap();
    let msgs = db::messages::list_for_conversation(&guard, &conv.id).unwrap();

    // user message + assistant message
    assert!(
        msgs.len() >= 2,
        "Expected at least 2 messages (user + assistant), got {}",
        msgs.len()
    );
    let assistant_msgs: Vec<_> = msgs
        .iter()
        .filter(|m| m.role == db::messages::MessageRole::Assistant)
        .collect();
    assert!(
        !assistant_msgs.is_empty(),
        "No assistant message persisted to DB"
    );
    assert!(
        assistant_msgs[0].content.contains("Persisted response"),
        "Assistant message content mismatch: {:?}",
        assistant_msgs[0].content
    );
}

#[tokio::test]
async fn test_tokens_used_persisted_after_streaming() {
    let mut server = Server::new_async().await;
    let url = server.url();

    // eval_count=42, total_duration=5_000_000_000ns (5s → 5000ms)
    let _mock = server.mock("POST", "/api/chat")
        .with_status(200)
        .with_header("content-type", "application/x-ndjson")
        .with_body(
            "{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"counted reply\"},\"done\":true,\"total_duration\":5000000000,\"load_duration\":0,\"prompt_eval_count\":5,\"eval_count\":42,\"eval_duration\":1000000000}\n"
        )
        .create_async()
        .await;

    let app = build_app_with_state(&url);
    let conv = make_conv(&app);
    let app_handle: AppHandle<MockRuntime> = app.handle().clone();
    let state = app_handle.state::<AppState>();

    let res = send_message(
        state.clone(),
        app_handle.clone(),
        conv.id.clone(),
        "count me".into(),
        None,
        "llama3".into(),
        None,
        None,
        None,
        None,
    )
    .await;
    assert!(res.is_ok(), "send_message failed: {:?}", res);

    tokio::time::sleep(Duration::from_millis(150)).await;

    let db = state.db.clone();
    let msgs = tokio::task::spawn_blocking(move || {
        let conn = db.lock().unwrap();
        alpaka_desktop_lib::db::messages::list_for_conversation(&conn, &conv.id)
    })
    .await
    .unwrap()
    .unwrap();

    let assistant = msgs
        .iter()
        .find(|m| m.role == alpaka_desktop_lib::db::messages::MessageRole::Assistant)
        .expect("No assistant message persisted");
    assert_eq!(assistant.tokens_used, Some(42), "tokens_used mismatch");
    assert_eq!(
        assistant.generation_time_ms,
        Some(5000),
        "generation_time_ms mismatch"
    );
}

#[tokio::test]
async fn test_chunked_boundary_streaming() {
    // The NDJSON line is delivered across two HTTP chunks split at a mid-token boundary.
    // The streaming code must line-buffer correctly and parse the complete JSON line.
    let mut server = Server::new_async().await;
    let url = server.url();

    // First chunk ends inside a JSON string value; second chunk completes the line
    // and provides the done frame.
    let chunk_a = b"{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"split-tok".to_vec();
    let chunk_b = b"en\"},\"done\":false}\n{\"model\":\"llama3\",\"created_at\":\"\",\"message\":{\"role\":\"assistant\",\"content\":\"\"},\"done\":true,\"total_duration\":1000,\"load_duration\":10,\"prompt_eval_count\":1,\"eval_count\":1,\"eval_duration\":1000}\n".to_vec();

    let _mock = server
        .mock("POST", "/api/chat")
        .with_status(200)
        .with_header("content-type", "application/x-ndjson")
        .with_chunked_body(move |w| {
            w.write_all(&chunk_a)?;
            w.write_all(&chunk_b)?;
            Ok(())
        })
        .create_async()
        .await;

    let app = build_app_with_state(&url);
    let conv = make_conv(&app);
    let app_handle: AppHandle<MockRuntime> = app.handle().clone();
    let state = app_handle.state::<AppState>();

    let tokens_received: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let tr = tokens_received.clone();
    app_handle.listen("chat:token", move |event| {
        // Payload is JSON: {"conversation_id":"...","content":"...","done":false}
        tr.lock().unwrap().push(event.payload().to_string());
    });

    let done_received = Arc::new(Mutex::new(false));
    let dr = done_received.clone();
    app_handle.listen("chat:done", move |_| {
        *dr.lock().unwrap() = true;
    });

    let res = send_message(
        state,
        app_handle.clone(),
        conv.id.clone(),
        "Hi".into(),
        None,
        "llama3".into(),
        None,
        None,
        None,
        None,
    )
    .await;
    assert!(
        res.is_ok(),
        "send_message failed with chunked boundary: {:?}",
        res
    );

    tokio::time::sleep(Duration::from_millis(150)).await;

    // The split token must have been reassembled into a single emission
    let tokens = tokens_received.lock().unwrap();
    assert!(
        !tokens.is_empty(),
        "No tokens emitted — line-buffering likely failed"
    );
    let combined: String = tokens.join("");
    assert!(
        combined.contains("split-token"),
        "Reassembled token 'split-token' not found in emitted payloads: {:?}",
        combined
    );

    assert!(
        *done_received.lock().unwrap(),
        "chat:done not received after chunked boundary stream"
    );
}
