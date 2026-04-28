use alpaka_desktop_lib::commands::hosts::{
    add_host, delete_host, list_hosts, ping_host, set_active_host,
};
use alpaka_desktop_lib::db;
use alpaka_desktop_lib::db::hosts::{NewHost, PingStatus};
use alpaka_desktop_lib::state::AppState;
use mockito::Server;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tauri::test::{mock_builder, mock_context, noop_assets};
use tauri::Manager;

#[tokio::test]
async fn test_host_crud_integration() {
    let app = mock_builder()
        .plugin(tauri_plugin_notification::init())
        .build(mock_context(noop_assets()))
        .unwrap();
    let app_handle = app.handle();

    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();
    let conn = Arc::new(Mutex::new(direct_conn));
    let app_state = AppState::new(conn, std::path::PathBuf::new()).unwrap();
    app_handle.manage(app_state);

    let state = app_handle.state::<AppState>();

    // 1. Add
    let new_host = NewHost {
        name: "Local Ollama".into(),
        url: "http://localhost:11434".into(),
        is_default: Some(true),
    };
    let added = add_host(state.clone(), new_host).await.unwrap();
    assert_eq!(added.name, "Local Ollama");

    // 2. List
    let hosts = list_hosts(state.clone()).await.unwrap();
    assert_eq!(hosts.len(), 1);
    assert_eq!(hosts[0].id, added.id);

    // 3. Set Active
    set_active_host(state.clone(), added.id.clone())
        .await
        .unwrap();

    // 4. Delete
    delete_host(state.clone(), added.id).await.unwrap();
    let hosts = list_hosts(state.clone()).await.unwrap();
    assert_eq!(hosts.len(), 0);
}

#[tokio::test]
async fn test_ping_host_integration() {
    let mut server = Server::new_async().await;
    let url = server.url();

    let _mock = server
        .mock("GET", "/api/tags")
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

    let host = db::hosts::create(
        &direct_conn,
        NewHost {
            name: "Server".into(),
            url: url.clone(),
            is_default: Some(true),
        },
    )
    .unwrap();

    let conn = Arc::new(Mutex::new(direct_conn));
    let app_state = AppState::new(conn, std::path::PathBuf::new()).unwrap();
    app_handle.manage(app_state);

    let state = app_handle.state::<AppState>();

    let status = ping_host(state, host.id).await.unwrap();
    assert_eq!(status, PingStatus::Online);
}

#[tokio::test]
async fn test_from_state_no_active_host_returns_error() {
    // When the DB has no hosts (and therefore no active host),
    // OllamaClient::from_state must return AppError::NotFound("No active host").
    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();
    // Intentionally insert NO hosts — the hosts table is empty.

    let db_conn = Arc::new(Mutex::new(direct_conn));
    let http_client = reqwest::Client::builder().use_rustls_tls().build().unwrap();

    let result =
        alpaka_desktop_lib::ollama::client::OllamaClient::from_state(http_client, db_conn).await;

    assert!(
        result.is_err(),
        "Expected an error when no active host is configured"
    );
    let err = result.err().expect("Expected Err but got Ok");
    let err_str = err.to_string();
    assert!(
        err_str.contains("No active host")
            || err_str.contains("not found")
            || err_str.contains("Not found"),
        "Error message should mention 'No active host' or 'not found', got: {err_str}"
    );
}

#[tokio::test]
async fn test_from_state_with_inactive_host_returns_error() {
    // Even when hosts exist, if none is marked active, from_state must fail.
    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();

    // Insert a host but immediately deactivate it so is_active = 0.
    let host = db::hosts::create(
        &direct_conn,
        NewHost {
            name: "Inactive".into(),
            url: "http://localhost:11434".into(),
            is_default: Some(false),
        },
    )
    .unwrap();

    // Manually clear is_active for all hosts
    direct_conn
        .execute("UPDATE hosts SET is_active = 0", [])
        .unwrap();

    // Verify the host is indeed inactive before proceeding
    let h = db::hosts::get_by_id(&direct_conn, &host.id).unwrap();
    assert!(!h.is_active, "Precondition: host should be inactive");

    let db_conn = Arc::new(Mutex::new(direct_conn));
    let http_client = reqwest::Client::builder().use_rustls_tls().build().unwrap();

    let result =
        alpaka_desktop_lib::ollama::client::OllamaClient::from_state(http_client, db_conn).await;

    assert!(
        result.is_err(),
        "Expected an error when no host is active, even if hosts exist"
    );
}
