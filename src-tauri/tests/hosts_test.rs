use mockito::Server;
use std::sync::{Arc, Mutex};
use tauri::test::{mock_builder, mock_context, noop_assets};
use tauri::Manager;
use ollama_desktop_lib::state::AppState;
use ollama_desktop_lib::db;
use ollama_desktop_lib::commands::hosts::{add_host, list_hosts, delete_host, ping_host, set_active_host};
use ollama_desktop_lib::db::hosts::{NewHost, PingStatus};
use rusqlite::Connection;

#[tokio::test]
async fn test_host_crud_integration() {
    let app = mock_builder().build(mock_context(noop_assets())).unwrap();
    let app_handle = app.handle();
    
    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();
    let conn = Arc::new(Mutex::new(direct_conn));
    let app_state = AppState::new(conn);
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
    set_active_host(state.clone(), added.id.clone()).await.unwrap();

    // 4. Delete
    delete_host(state.clone(), added.id).await.unwrap();
    let hosts = list_hosts(state.clone()).await.unwrap();
    assert_eq!(hosts.len(), 0);
}

#[tokio::test]
async fn test_ping_host_integration() {
    let mut server = Server::new_async().await;
    let url = server.url();

    let _mock = server.mock("GET", "/api/tags")
        .with_status(200)
        .create_async()
        .await;

    let app = mock_builder().build(mock_context(noop_assets())).unwrap();
    let app_handle = app.handle();
    
    let direct_conn = Connection::open_in_memory().unwrap();
    db::migrations::run(&direct_conn).unwrap();
    
    let host = db::hosts::create(&direct_conn, NewHost {
        name: "Server".into(),
        url: url.clone(),
        is_default: Some(true),
    }).unwrap();

    let conn = Arc::new(Mutex::new(direct_conn));
    let app_state = AppState::new(conn);
    app_handle.manage(app_state);

    let state = app_handle.state::<AppState>();
    
    let status = ping_host(state, host.id).await.unwrap();
    assert_eq!(status, PingStatus::Online);
}
