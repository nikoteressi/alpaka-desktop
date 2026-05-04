use serde::Serialize;
use tauri::{command, State};

use crate::{auth::keyring, db, error::AppError, state::AppState};

const MAX_PROXY_URL_LEN: usize = 512;
const MAX_USERNAME_LEN: usize = 256;
const MAX_PASSWORD_LEN: usize = 512;

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
/// Validation happens before any write: an invalid URL never reaches the database.
/// Calling with an empty proxy_url clears all proxy configuration (equivalent to delete_proxy).
#[command]
pub async fn save_proxy(
    state: State<'_, AppState>,
    proxy_url: String,
    username: String,
    password: String,
) -> Result<(), AppError> {
    if proxy_url.len() > MAX_PROXY_URL_LEN {
        return Err(AppError::Internal("Proxy URL too long".into()));
    }
    if username.len() > MAX_USERNAME_LEN {
        return Err(AppError::Internal("Username too long".into()));
    }
    if password.len() > MAX_PASSWORD_LEN {
        return Err(AppError::Internal("Password too long".into()));
    }

    // Empty URL = clear proxy (same effect as delete_proxy, but triggered via Save)
    if proxy_url.trim().is_empty() {
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

        // Best-effort: clear any stored password
        let _ =
            tokio::task::spawn_blocking(|| keyring::delete_token(keyring::PROXY_PASSWORD_ACCOUNT))
                .await;

        let new_client = crate::state::build_http_client("", "", "").map_err(AppError::Http)?;
        let mut guard = state
            .http_client
            .write()
            .map_err(|_| AppError::Internal("http_client lock poisoned".into()))?;
        *guard = new_client;
        return Ok(());
    }

    // Determine effective password before any write: use provided value or read from keyring.
    // This lets callers omit the password when only the URL/username changed.
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

    // Validate URL and build the client BEFORE writing anything to persistent storage.
    // An unsupported scheme or malformed URL is rejected here; nothing is written on failure.
    let new_client = crate::state::build_http_client(&proxy_url, &username, &effective_password)
        .map_err(AppError::Http)?;

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

    let mut guard = state
        .http_client
        .write()
        .map_err(|_| AppError::Internal("http_client lock poisoned".into()))?;
    *guard = new_client;

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

    // Best-effort: keyring unavailability should not fail the delete
    if let Err(e) =
        tokio::task::spawn_blocking(|| keyring::delete_token(keyring::PROXY_PASSWORD_ACCOUNT))
            .await?
    {
        log::warn!("Could not remove proxy password from keyring: {e}");
    }

    let new_client = crate::state::build_http_client("", "", "").map_err(AppError::Http)?;
    let mut guard = state
        .http_client
        .write()
        .map_err(|_| AppError::Internal("http_client lock poisoned".into()))?;
    *guard = new_client;

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
            // Deliberately "reachable" rather than "successful": any HTTP response (including
            // 401/403 from a cloud host) proves the proxy forwarded the connection.
            message: "Proxy is reachable".into(),
        }),
        Ok(Err(e)) => Ok(ProxyTestResult {
            success: false,
            // without_url() strips the request URL from the error to avoid exposing
            // internal host addresses in the frontend error message.
            message: e.without_url().to_string(),
        }),
        Err(_) => Ok(ProxyTestResult {
            success: false,
            message: "Connection timed out after 10 seconds".into(),
        }),
    }
}

#[cfg(test)]
mod tests {
    use crate::auth::keyring::{API_KEY_ACCOUNT, PROXY_PASSWORD_ACCOUNT};
    use crate::state::build_http_client;

    #[test]
    fn proxy_password_account_distinct_from_api_key() {
        assert_ne!(PROXY_PASSWORD_ACCOUNT, API_KEY_ACCOUNT);
        assert_eq!(PROXY_PASSWORD_ACCOUNT, "proxy-password");
    }

    #[test]
    fn build_client_rejects_unsupported_scheme() {
        let err = build_http_client("ftp://proxy.corp.net:21", "", "").unwrap_err();
        assert!(
            err.contains("Unsupported proxy scheme"),
            "expected unsupported-scheme error, got: {err}"
        );
    }

    #[test]
    fn build_client_rejects_malformed_url() {
        let err = build_http_client("not-a-url", "", "").unwrap_err();
        assert!(
            err.contains("Invalid proxy URL"),
            "expected invalid-URL error, got: {err}"
        );
    }
}
