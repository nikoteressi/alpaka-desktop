use serde::Serialize;
use tauri::{command, State};

use crate::{auth::keyring, db, error::AppError, state::AppState};

#[derive(Serialize)]
pub struct ProxyConfig {
    pub proxy_url: String,
    pub username: String,
    pub has_password: bool,
}

#[derive(Serialize)]
pub struct ProxyTestResult {
    pub success: bool,
    pub message: String,
}

/// Returns the current proxy URL, username, and whether a password is stored.
/// The password itself is never returned — only its presence is indicated.
#[command]
pub async fn get_proxy_config(state: State<'_, AppState>) -> Result<ProxyConfig, AppError> {
    let db = state.db.clone();
    let (proxy_url, username) = tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("lock poisoned".into()))?;
        let proxy_url = db::settings::get(&conn, "proxyUrl")?.unwrap_or_default();
        let username = db::settings::get(&conn, "proxyUsername")?.unwrap_or_default();
        Ok::<_, AppError>((proxy_url, username))
    })
    .await??;

    let has_password = tokio::task::spawn_blocking(|| {
        matches!(
            keyring::get_token(keyring::PROXY_PASSWORD_ACCOUNT),
            Ok(Some(_))
        )
    })
    .await
    .unwrap_or(false);

    Ok(ProxyConfig {
        proxy_url,
        username,
        has_password,
    })
}

/// Saves proxy URL + username to DB, password to keyring, then rebuilds the HTTP client.
#[command]
pub async fn save_proxy(
    state: State<'_, AppState>,
    proxy_url: String,
    username: String,
    password: String,
) -> Result<(), AppError> {
    let db = state.db.clone();
    let url_clone = proxy_url.clone();
    let user_clone = username.clone();

    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("lock poisoned".into()))?;
        db::settings::set(&conn, "proxyUrl", &url_clone)?;
        db::settings::set(&conn, "proxyUsername", &user_clone)?;
        Ok::<_, AppError>(())
    })
    .await??;

    if !password.is_empty() {
        let pass_clone = password.clone();
        tokio::task::spawn_blocking(move || {
            keyring::set_token(keyring::PROXY_PASSWORD_ACCOUNT, &pass_clone)
        })
        .await??;
    }

    // Determine effective password: if one was just written, use it; otherwise read from keyring
    let effective_password = if !password.is_empty() {
        password.clone()
    } else {
        tokio::task::spawn_blocking(|| {
            keyring::get_token(keyring::PROXY_PASSWORD_ACCOUNT)
                .ok()
                .flatten()
                .unwrap_or_default()
        })
        .await
        .unwrap_or_default()
    };

    let new_client = crate::state::build_http_client(&proxy_url, &username, &effective_password)
        .map_err(AppError::Http)?;
    *state.http_client.write().unwrap() = new_client;

    Ok(())
}

/// Clears all proxy configuration and rebuilds the HTTP client without a proxy.
#[command]
pub async fn delete_proxy(state: State<'_, AppState>) -> Result<(), AppError> {
    let db = state.db.clone();

    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("lock poisoned".into()))?;
        db::settings::set(&conn, "proxyUrl", "")?;
        db::settings::set(&conn, "proxyUsername", "")?;
        Ok::<_, AppError>(())
    })
    .await??;

    tokio::task::spawn_blocking(|| keyring::delete_token(keyring::PROXY_PASSWORD_ACCOUNT))
        .await??;

    let new_client = crate::state::build_http_client("", "", "").map_err(AppError::Http)?;
    *state.http_client.write().unwrap() = new_client;

    Ok(())
}

/// Builds a temporary client with the given proxy and tests connectivity to the active Ollama host.
/// Does not persist any configuration.
#[command]
pub async fn test_proxy(
    state: State<'_, AppState>,
    proxy_url: String,
    username: String,
    password: String,
) -> Result<ProxyTestResult, AppError> {
    if proxy_url.trim().is_empty() {
        return Ok(ProxyTestResult {
            success: false,
            message: "Proxy URL cannot be empty".into(),
        });
    }

    // Determine the password: use provided value or fall back to stored keyring entry
    let effective_password = if !password.is_empty() {
        password
    } else {
        tokio::task::spawn_blocking(|| {
            keyring::get_token(keyring::PROXY_PASSWORD_ACCOUNT)
                .ok()
                .flatten()
                .unwrap_or_default()
        })
        .await
        .unwrap_or_default()
    };

    let client = match crate::state::build_http_client(&proxy_url, &username, &effective_password) {
        Ok(c) => c,
        Err(e) => {
            return Ok(ProxyTestResult {
                success: false,
                message: format!("Invalid proxy URL: {e}"),
            })
        }
    };

    let db = state.db.clone();
    let host_url_result = tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("lock poisoned".into()))?;
        let hosts = db::hosts::list_all(&conn)?;
        match hosts.into_iter().find(|h| h.is_active) {
            Some(h) => Ok(h.url),
            None => Err(AppError::NotFound("no active host".into())),
        }
    })
    .await;

    let host_url = match host_url_result {
        Ok(Ok(url)) => url,
        Ok(Err(_)) | Err(_) => {
            return Ok(ProxyTestResult {
                success: false,
                message: "No active host configured".into(),
            })
        }
    };

    let url = format!("{}/api/version", host_url.trim_end_matches('/'));

    match tokio::time::timeout(std::time::Duration::from_secs(10), client.get(&url).send()).await {
        Ok(Ok(_)) => Ok(ProxyTestResult {
            success: true,
            message: "Proxy connection successful".into(),
        }),
        Ok(Err(e)) => Ok(ProxyTestResult {
            success: false,
            message: e.to_string(),
        }),
        Err(_) => Ok(ProxyTestResult {
            success: false,
            message: "Connection timed out after 10 seconds".into(),
        }),
    }
}

#[cfg(test)]
mod tests {
    use crate::db::migrations;
    use crate::state::build_http_client;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};

    fn in_memory_db() -> crate::db::DbConn {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA journal_mode = WAL;\nPRAGMA foreign_keys = ON;")
            .unwrap();
        migrations::run(&conn).unwrap();
        Arc::new(Mutex::new(conn))
    }

    #[test]
    fn test_proxy_password_account_distinct_from_api_key() {
        use crate::auth::keyring::{API_KEY_ACCOUNT, PROXY_PASSWORD_ACCOUNT};
        assert_ne!(PROXY_PASSWORD_ACCOUNT, API_KEY_ACCOUNT);
        assert_eq!(PROXY_PASSWORD_ACCOUNT, "proxy-password");
    }

    #[test]
    fn test_build_client_with_empty_url_succeeds() {
        assert!(build_http_client("", "", "").is_ok());
    }

    #[test]
    fn test_build_client_with_http_proxy_url() {
        assert!(build_http_client("http://corp-proxy.internal:3128", "alice", "s3cr3t").is_ok());
    }

    #[test]
    fn test_build_client_with_socks5_proxy_url() {
        assert!(build_http_client("socks5://proxy.corp.net:1080", "", "").is_ok());
    }

    #[tokio::test]
    async fn test_get_proxy_config_returns_empty_when_not_set() {
        let db = in_memory_db();
        let (url, username) = tokio::task::spawn_blocking(move || {
            let conn = db.lock().unwrap();
            let url = crate::db::settings::get(&conn, "proxyUrl")
                .unwrap()
                .unwrap_or_default();
            let username = crate::db::settings::get(&conn, "proxyUsername")
                .unwrap()
                .unwrap_or_default();
            (url, username)
        })
        .await
        .unwrap();

        assert_eq!(url, "");
        assert_eq!(username, "");
    }

    #[tokio::test]
    async fn test_proxy_url_persisted_to_db() {
        let db = in_memory_db();
        let db2 = db.clone();

        tokio::task::spawn_blocking(move || {
            let conn = db2.lock().unwrap();
            crate::db::settings::set(&conn, "proxyUrl", "http://proxy:3128").unwrap();
            crate::db::settings::set(&conn, "proxyUsername", "bob").unwrap();
        })
        .await
        .unwrap();

        let url = tokio::task::spawn_blocking(move || {
            let conn = db.lock().unwrap();
            crate::db::settings::get(&conn, "proxyUrl").unwrap()
        })
        .await
        .unwrap();

        assert_eq!(url, Some("http://proxy:3128".to_string()));
    }
}
