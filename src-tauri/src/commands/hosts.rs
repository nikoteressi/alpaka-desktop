use serde_json::json;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::time::Instant;

use crate::db::{
    self,
    hosts::{Host, NewHost, PingStatus},
    spawn_db, DbConn,
};
use crate::error::AppError;
use crate::state::AppState;

/// Validate that a host URL is safe to use.
/// Rejects non-http(s) schemes and link-local / metadata IP ranges.
fn validate_host_url(url: &str) -> Result<(), AppError> {
    let parsed =
        url::Url::parse(url).map_err(|e| AppError::Internal(format!("Invalid host URL: {}", e)))?;

    match parsed.scheme() {
        "http" | "https" => {}
        scheme => {
            return Err(AppError::Internal(format!(
                "Invalid host URL: scheme '{}' is not allowed (use http or https)",
                scheme
            )));
        }
    }

    if let Some(host) = parsed.host_str() {
        let clean_host = host.trim_start_matches('[').trim_end_matches(']');
        // Attempt to parse as IP address to check for link-local ranges
        if let Ok(ip) = clean_host.parse::<std::net::IpAddr>() {
            match ip {
                std::net::IpAddr::V4(ipv4) => {
                    if ipv4.is_link_local() {
                        return Err(AppError::Internal(
                            "Invalid host URL: link-local IPv4 addresses are not allowed".into(),
                        ));
                    }
                }
                std::net::IpAddr::V6(ipv6) => {
                    // Check for IPv6 link-local (fe80::/10)
                    if (ipv6.segments()[0] & 0xffc0) == 0xfe80 {
                        return Err(AppError::Internal(
                            "Invalid host URL: link-local IPv6 addresses are not allowed".into(),
                        ));
                    }
                }
            }
        } else if host.to_lowercase().starts_with("169.254.") {
            // Fallback for cases where it might not parse cleanly but follows the pattern
            return Err(AppError::Internal(
                "Invalid host URL: link-local addresses (169.254.x.x) are not allowed".into(),
            ));
        }
    }

    Ok(())
}

pub async fn core_list_hosts(db: DbConn) -> Result<Vec<Host>, AppError> {
    spawn_db(db, db::hosts::list_all).await
}

#[tauri::command]
pub async fn list_hosts(state: State<'_, AppState>) -> Result<Vec<Host>, AppError> {
    core_list_hosts(state.db.clone()).await
}

pub async fn core_add_host(db: DbConn, new_host: NewHost) -> Result<Host, AppError> {
    validate_host_url(&new_host.url)?;

    spawn_db(db, move |conn| db::hosts::create(conn, new_host)).await
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
    validate_host_url(&url)?;

    spawn_db(db, move |conn| db::hosts::update(conn, &id, &name, &url)).await
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
    spawn_db(db, move |conn| db::hosts::delete(conn, &id)).await
}

#[tauri::command]
pub async fn delete_host(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    core_delete_host(state.db.clone(), id).await
}

pub async fn core_set_active_host(db: DbConn, id: String) -> Result<(), AppError> {
    spawn_db(db, move |conn| db::hosts::set_active(conn, &id)).await
}

#[tauri::command]
pub async fn set_active_host(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    core_set_active_host(state.db.clone(), id).await
}

pub async fn perform_ping(client: &reqwest::Client, url: &str) -> (PingStatus, Option<u128>) {
    let start = Instant::now();
    let endpoint = format!("{}/api/tags", url.trim_end_matches('/'));

    // graceful timeout (5s) without panicking
    match client
        .get(&endpoint)
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        Ok(res) if res.status().is_success() => {
            (PingStatus::Online, Some(start.elapsed().as_millis()))
        }
        _ => (PingStatus::Offline, None),
    }
}

pub async fn core_ping_host(
    db: DbConn,
    http_client: reqwest::Client,
    id: String,
) -> Result<PingStatus, AppError> {
    let host = spawn_db(db.clone(), move |conn| db::hosts::get_by_id(conn, &id)).await?;

    let (status, _latency) = perform_ping(&http_client, &host.url).await;

    let id = host.id.clone();
    spawn_db(db, {
        let status = status.clone();
        move |conn| db::hosts::update_ping_status(conn, &id, &status)
    })
    .await?;

    Ok(status)
}

#[tauri::command]
pub async fn ping_host(state: State<'_, AppState>, id: String) -> Result<PingStatus, AppError> {
    let http = state.http_client.read().unwrap().clone();
    core_ping_host(state.db.clone(), http, id).await
}

/// MED-10: Start the host health check loop with a shutdown channel.
/// `shutdown_rx` is driven by the sender stored in `AppState.health_loop_shutdown`.
pub fn start_host_health_loop(
    app: AppHandle,
    shutdown_rx: tokio::sync::oneshot::Receiver<()>,
) -> tauri::async_runtime::JoinHandle<()> {
    tauri::async_runtime::spawn(async move {
        // extract resources that we can move across thread bounds safely
        let db = {
            let state = app.state::<AppState>();
            state.db.clone()
        };

        // Pin the shutdown receiver so it can be used in select!
        tokio::pin!(shutdown_rx);

        loop {
            // Re-acquire the client on each iteration so proxy changes applied
            // at runtime (via commands/proxy.rs) are picked up immediately.
            let client = app.state::<AppState>().http_client.read().unwrap().clone();

            let hosts = match tokio::task::spawn_blocking({
                let db = db.clone();
                move || {
                    let conn = db
                        .lock()
                        .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
                    db::hosts::list_all(&conn)
                }
            })
            .await
            {
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
                        let conn = db
                            .lock()
                            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
                        db::hosts::update_ping_status(&conn, &id, &status)
                    }
                })
                .await;

                // Detect transition to offline
                if host.last_ping_status == PingStatus::Online && status == PingStatus::Offline {
                    crate::system::notifications::notify_host_offline(&app, &host.name);
                }

                // emit event to frontend
                let _ = app.emit(
                    "host:status-change",
                    json!({
                        "host_id": host.id,
                        "status": status.as_str(),
                        "latency_ms": latency_ms,
                    }),
                );
            }

            // MED-10: select on the shutdown signal alongside the sleep interval
            tokio::select! {
                _ = &mut shutdown_rx => {
                    log::info!("Host health loop received shutdown signal, exiting.");
                    break;
                }
                _ = tokio::time::sleep(Duration::from_secs(30)) => {}
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use mockito::Server;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};

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
        let mock = server
            .mock("GET", "/api/tags")
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
        core_update_host(
            db.clone(),
            host.id.clone(),
            "New Name".into(),
            "http://new:11434".into(),
        )
        .await
        .unwrap();

        // 4. Set Active
        core_set_active_host(db.clone(), host.id.clone())
            .await
            .unwrap();

        // 5. Delete host
        core_delete_host(db.clone(), host.id).await.unwrap();

        let hosts = core_list_hosts(db.clone()).await.unwrap();
        assert_eq!(hosts.len(), 0);
    }

    #[tokio::test]
    async fn test_ping_host_integration() {
        let mut server = Server::new_async().await;
        let _mock = server
            .mock("GET", "/api/tags")
            .with_status(200)
            .create_async()
            .await;

        let db = setup_test_db();
        let host = {
            let conn = db.lock().unwrap();
            crate::db::hosts::create(
                &conn,
                NewHost {
                    name: "Server".into(),
                    url: server.url(),
                    is_default: None,
                },
            )
            .unwrap()
        };

        let http_client = reqwest::Client::new();

        // ping_host updates the DB
        let status = core_ping_host(db.clone(), http_client, host.id.clone())
            .await
            .unwrap();
        assert_eq!(status, PingStatus::Online);

        // Verify DB update
        let conn = db.lock().unwrap();
        let updated_host = crate::db::hosts::get_by_id(&conn, &host.id).unwrap();
        assert_eq!(updated_host.last_ping_status, PingStatus::Online);
    }

    #[tokio::test]
    async fn test_add_host_rejects_file_scheme() {
        let db = setup_test_db();
        let result = core_add_host(
            db,
            NewHost {
                name: "Bad".into(),
                url: "file:///etc/passwd".into(),
                is_default: None,
            },
        )
        .await;
        assert!(result.is_err(), "file:// URL should be rejected");
        let err_str = result.unwrap_err().to_string();
        assert!(
            err_str.contains("not allowed") || err_str.contains("Invalid host URL"),
            "Error should mention invalid URL: {}",
            err_str
        );
    }

    #[tokio::test]
    async fn test_add_host_rejects_link_local_ip() {
        let db = setup_test_db();
        let result = core_add_host(
            db,
            NewHost {
                name: "Meta".into(),
                url: "http://169.254.169.254/latest/meta-data".into(),
                is_default: None,
            },
        )
        .await;
        assert!(result.is_err(), "169.254.x.x URL should be rejected");
    }

    #[tokio::test]
    async fn test_update_host_rejects_non_http_scheme() {
        let db = setup_test_db();
        // First add a valid host
        let host = core_add_host(
            db.clone(),
            NewHost {
                name: "Valid".into(),
                url: "http://localhost:11434".into(),
                is_default: None,
            },
        )
        .await
        .unwrap();

        // Try to update with an invalid URL
        let result =
            core_update_host(db, host.id, "Valid".into(), "ftp://evil.example.com".into()).await;
        assert!(result.is_err(), "ftp:// URL should be rejected");
    }

    #[tokio::test]
    async fn test_add_host_rejects_ipv6_link_local() {
        let db = setup_test_db();
        let result = core_add_host(
            db,
            NewHost {
                name: "Meta V6".into(),
                url: "http://[fe80::1]/".into(),
                is_default: None,
            },
        )
        .await;
        assert!(result.is_err(), "fe80:: IPv6 URL should be rejected");
        assert!(result.unwrap_err().to_string().contains("link-local IPv6"));
    }
}
