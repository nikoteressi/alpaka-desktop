use alpaka_desktop_lib::commands::models::{delete_model, list_models, pull_model};
use alpaka_desktop_lib::db;
use alpaka_desktop_lib::db::hosts::NewHost;
use alpaka_desktop_lib::state::AppState;
use mockito::Server;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::test::{mock_builder, mock_context, noop_assets};
use tauri::{Listener, Manager};

#[tokio::test]
async fn test_list_models_integration() {
    let mut server = Server::new_async().await;
    let url = server.url();

    let mock = server.mock("GET", "/api/tags")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"models":[{"name":"llama3","model":"llama3","modified_at":"2023","size":100,"digest":"abc","details":{"parent_model":"","format":"gguf","family":"llama","families":["llama"],"parameter_size":"8B","quantization_level":"Q4"}}]}"#)
        .create_async()
        .await;

    let app = mock_builder()
        .plugin(tauri_plugin_notification::init())
        .build(mock_context(noop_assets()))
        .unwrap();
    let app_handle = app.handle();

    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();
    db::hosts::create(
        &direct_conn,
        NewHost {
            name: "Test Host".into(),
            url: url.clone(),
            is_default: Some(true),
        },
    )
    .unwrap();

    let conn = Arc::new(Mutex::new(direct_conn));
    let app_state = AppState::new(conn, std::path::PathBuf::new()).unwrap();
    app_handle.manage(app_state);

    let state = app_handle.state::<AppState>();
    let result = list_models(state).await;

    mock.assert_async().await;
    assert!(result.is_ok());
    let models = result.unwrap();
    assert_eq!(models.len(), 1);
    assert_eq!(models[0].name, "llama3");
}

#[tokio::test]
async fn test_pull_model_integration_emits_events() {
    let mut server = Server::new_async().await;
    let url = server.url();

    let mock = server
        .mock("POST", "/api/pull")
        .with_status(200)
        .with_body(
            r#"{"status":"downloading","completed":10,"total":100}
{"status":"downloading","completed":90,"total":100}
{"status":"success"}
"#,
        )
        .create_async()
        .await;

    let app = mock_builder()
        .plugin(tauri_plugin_notification::init())
        .build(mock_context(noop_assets()))
        .unwrap();
    let app_handle = app.handle().clone();

    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();
    db::hosts::create(
        &direct_conn,
        NewHost {
            name: "Test Host".into(),
            url: url.clone(),
            is_default: Some(true),
        },
    )
    .unwrap();

    let conn = Arc::new(Mutex::new(direct_conn));
    let app_state = AppState::new(conn, std::path::PathBuf::new()).unwrap();
    app_handle.manage(app_state);

    let state = app_handle.state::<AppState>();

    let events = Arc::new(Mutex::new(Vec::new()));
    let events_clone = events.clone();
    app_handle.listen("model:pull-progress", move |event| {
        events_clone
            .lock()
            .unwrap()
            .push(event.payload().to_string());
    });

    let result = pull_model(state, app_handle.clone(), "llama3".into()).await;

    mock.assert_async().await;
    assert!(result.is_ok());

    // Wait a bit for events
    tokio::time::sleep(Duration::from_millis(50)).await;

    let emitted = events.lock().unwrap();
    assert!(emitted.len() >= 2);
    assert!(emitted[0].contains("\"status\":\"downloading\""));
}

#[tokio::test]
async fn test_delete_model_integration() {
    let mut server = Server::new_async().await;
    let url = server.url();

    let mock = server
        .mock("DELETE", "/api/delete")
        .with_status(200)
        .create_async()
        .await;

    let app = mock_builder()
        .plugin(tauri_plugin_notification::init())
        .build(mock_context(noop_assets()))
        .unwrap();
    let app_handle = app.handle();

    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();
    db::hosts::create(
        &direct_conn,
        NewHost {
            name: "Test Host".into(),
            url: url.clone(),
            is_default: Some(true),
        },
    )
    .unwrap();

    let conn = Arc::new(Mutex::new(direct_conn));
    let app_state = AppState::new(conn, std::path::PathBuf::new()).unwrap();
    app_handle.manage(app_state);

    let state = app_handle.state::<AppState>();
    let result = delete_model(state, "llama3".into()).await;

    mock.assert_async().await;
    assert!(result.is_ok());
}
