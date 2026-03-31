use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use serde_json::json;
use tokio::time::Instant;

use crate::db::{self, DbConn, hosts::{Host, NewHost, PingStatus}};
use crate::error::AppError;
use crate::state::AppState;

pub async fn core_list_hosts(db: DbConn) -> Result<Vec<Host>, AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().unwrap();
        db::hosts::list_all(&conn)
    })
    .await?
}

#[tauri::command]
pub async fn list_hosts(state: State<'_, AppState>) -> Result<Vec<Host>, AppError> {
    core_list_hosts(state.db.clone()).await
}

pub async fn core_add_host(db: DbConn, new_host: NewHost) -> Result<Host, AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().unwrap();
        db::hosts::create(&conn, new_host)
    })
    .await?
}

#[tauri::command]
pub async fn add_host(state: State<'_, AppState>, new_host: NewHost) -> Result<Host, AppError> {
    core_add_host(state.db.clone(), new_host).await
}

pub async fn core_update_host(
    db: DbConn,
    id: String,
    name: String,
    url: String,
) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().unwrap();
        db::hosts::update(&conn, &id, &name, &url)
    })
    .await?
}

#[tauri::command]
pub async fn update_host(
    state: State<'_, AppState>,
    id: String,
    name: String,
    url: String,
) -> Result<(), AppError> {
    core_update_host(state.db.clone(), id, name, url).await
}

pub async fn core_delete_host(db: DbConn, id: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().unwrap();
        db::hosts::delete(&conn, &id)
    })
    .await?
}

#[tauri::command]
pub async fn delete_host(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    core_delete_host(state.db.clone(), id).await
}

pub async fn core_set_active_host(db: DbConn, id: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().unwrap();
        db::hosts::set_active(&conn, &id)
    })
    .await?
}

#[tauri::command]
pub async fn set_active_host(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    core_set_active_host(state.db.clone(), id).await
}

pub async fn perform_ping(client: &reqwest::Client, url: &str) -> (PingStatus, Option<u128>) {
    let start = Instant::now();
    let endpoint = format!("{}/api/tags", url.trim_end_matches('/'));
    
    // graceful timeout (5s) without panicking
    match client.get(&endpoint).timeout(Duration::from_secs(5)).send().await {
        Ok(res) if res.status().is_success() => {
            (PingStatus::Online, Some(start.elapsed().as_millis()))
        }
        _ => (PingStatus::Offline, None),
    }
}

pub async fn core_ping_host(db: DbConn, http_client: reqwest::Client, id: String) -> Result<PingStatus, AppError> {
    let host = tokio::task::spawn_blocking({
        let db = db.clone();
        let id = id.clone();
        move || {
            let conn = db.lock().unwrap();
            db::hosts::get_by_id(&conn, &id)
        }
    })
    .await??;

    let (status, _latency) = perform_ping(&http_client, &host.url).await;
    
    tokio::task::spawn_blocking({
        let db = db.clone();
        let status = status.clone();
        move || {
            let conn = db.lock().unwrap();
            db::hosts::update_ping_status(&conn, &id, &status)
        }
    })
    .await??;

    Ok(status)
}

#[tauri::command]
pub async fn ping_host(state: State<'_, AppState>, id: String) -> Result<PingStatus, AppError> {
    core_ping_host(state.db.clone(), state.http_client.clone(), id).await
}

pub fn start_host_health_loop(app: AppHandle) {
    tokio::spawn(async move {
        // extract resources that we can move across thread bounds safely
        let db = {
            let state = app.state::<AppState>();
            state.db.clone()
        };
        let client = {
            let state = app.state::<AppState>();
            state.http_client.clone()
        };
        
        loop {
            let hosts = match tokio::task::spawn_blocking({
                let db = db.clone();
                move || {
                    let conn = db.lock().unwrap();
                    db::hosts::list_all(&conn)
                }
            }).await {
                Ok(Ok(h)) => h,
                _ => Vec::new(),
            };

            for host in hosts {
                let (status, latency_ms) = perform_ping(&client, &host.url).await;
                
                let _ = tokio::task::spawn_blocking({
                    let db = db.clone();
                    let id = host.id.clone();
                    let status = status.clone();
                    move || {
                        let conn = db.lock().unwrap();
                        db::hosts::update_ping_status(&conn, &id, &status)
                    }
                }).await;

                // emit event to frontend
                let _ = app.emit("host:status-change", json!({
                    "host_id": host.id,
                    "status": status.as_str(),
                    "latency_ms": latency_ms,
                }));
            }
            
            // interval
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;
    use crate::db::migrations;
    use std::sync::{Arc, Mutex};
    use rusqlite::Connection;

    fn setup_test_db() -> crate::db::DbConn {
        let conn = Connection::open_in_memory().unwrap();
        migrations::run(&conn).unwrap();
        Arc::new(Mutex::new(conn))
    }

    #[tokio::test]
    async fn test_perform_ping_timeout_does_not_panic() {
        let client = reqwest::Client::new();
        let (status, latency) = perform_ping(&client, "http://192.0.2.1:11434").await;
        assert_eq!(status, PingStatus::Offline);
        assert!(latency.is_none());
    }

    #[tokio::test]
    async fn test_perform_ping_success() {
        let mut server = Server::new_async().await;
        let mock = server.mock("GET", "/api/tags")
            .with_status(200)
            .create_async()
            .await;

        let client = reqwest::Client::new();
        let (status, latency) = perform_ping(&client, &server.url()).await;
        mock.assert_async().await;

        assert_eq!(status, PingStatus::Online);
        assert!(latency.is_some());
    }

    #[tokio::test]
    async fn test_crud_flow() {
        let db = setup_test_db();

        // 1. Add host
        let new_host = NewHost {
            name: "Test Host".into(),
            url: "http://test:11434".into(),
            is_default: Some(false),
        };
        let host = core_add_host(db.clone(), new_host).await.unwrap();
        assert_eq!(host.name, "Test Host");

        // 2. List hosts
        let hosts = core_list_hosts(db.clone()).await.unwrap();
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].id, host.id);

        // 3. Update host
        core_update_host(db.clone(), host.id.clone(), "New Name".into(), "http://new:11434".into()).await.unwrap();

        // 4. Set Active
        core_set_active_host(db.clone(), host.id.clone()).await.unwrap();

        // 5. Delete host
        core_delete_host(db.clone(), host.id).await.unwrap();

        let hosts = core_list_hosts(db.clone()).await.unwrap();
        assert_eq!(hosts.len(), 0);
    }

    #[tokio::test]
    async fn test_ping_host_integration() {
        let mut server = Server::new_async().await;
        let _mock = server.mock("GET", "/api/tags")
            .with_status(200)
            .create_async()
            .await;

        let db = setup_test_db();
        let conn = db.lock().unwrap();
        let host = crate::db::hosts::create(&conn, NewHost {
            name: "Server".into(),
            url: server.url(),
            is_default: None,
        }).unwrap();
        drop(conn);

        let http_client = reqwest::Client::new();
        
        // ping_host updates the DB
        let status = core_ping_host(db.clone(), http_client, host.id.clone()).await.unwrap();
        assert_eq!(status, PingStatus::Online);

        // Verify DB update
        let conn = db.lock().unwrap();
        let updated_host = crate::db::hosts::get_by_id(&conn, &host.id).unwrap();
        assert_eq!(updated_host.last_ping_status, PingStatus::Online);
    }
}
