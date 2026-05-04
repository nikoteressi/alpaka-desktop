use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, RwLock};

use tokio::sync::{broadcast, oneshot};

use crate::db::DbConn;

// ── Application state ──────────────────────────────────────────────────────────

/// Shared state injected into every Tauri command via `State<'_, AppState>`.
///
/// Constructed once in `lib.rs` and registered with `tauri::Builder::manage()`.
pub struct AppState {
    pub db: DbConn,
    pub db_path: PathBuf,
    /// RwLock allows proxy settings to be applied at runtime without restarting.
    pub http_client: RwLock<reqwest::Client>,
    pub cancel_tx: Mutex<Option<broadcast::Sender<()>>>,
    pub model_create_cancel_tx: Mutex<HashMap<String, oneshot::Sender<()>>>,
    pub health_loop_shutdown: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    pub health_loop_handle: std::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    pub is_chat_view: RwLock<bool>,
    pub active_conversation_id: RwLock<Option<String>>,
}

/// Builds a reqwest client configured with an optional HTTP or SOCKS5 proxy.
///
/// Pass empty strings for `proxy_url` to build without a proxy.
pub fn build_http_client(
    proxy_url: &str,
    username: &str,
    password: &str,
) -> Result<reqwest::Client, reqwest::Error> {
    let mut builder = reqwest::Client::builder()
        .use_rustls_tls()
        .user_agent("ollama/0.3.11 (linux amd64) Go/1.22.4");

    if !proxy_url.is_empty() {
        // Validate URL eagerly: reqwest::Proxy::all is lenient and prepends
        // "http://" to bare host strings, which would silently accept invalid
        // input. We use url::Url::parse to enforce a proper scheme prefix.
        let parsed =
            url::Url::parse(proxy_url).map_err(|_| reqwest::Proxy::all("\x00").unwrap_err())?;
        let scheme = parsed.scheme();
        if !matches!(
            scheme,
            "http" | "https" | "socks4" | "socks4a" | "socks5" | "socks5h"
        ) {
            return Err(reqwest::Proxy::all("\x00").unwrap_err());
        }
        let mut proxy = reqwest::Proxy::all(proxy_url)?;
        if !username.is_empty() || !password.is_empty() {
            proxy = proxy.basic_auth(username, password);
        }
        builder = builder.proxy(proxy);
    }

    builder.build()
}

impl AppState {
    pub fn new(db: DbConn, db_path: PathBuf) -> Result<Self, reqwest::Error> {
        let (proxy_url, proxy_username) = db
            .lock()
            .ok()
            .map(|conn| {
                let url = crate::db::settings::get(&conn, "proxyUrl")
                    .ok()
                    .flatten()
                    .unwrap_or_default();
                let username = crate::db::settings::get(&conn, "proxyUsername")
                    .ok()
                    .flatten()
                    .unwrap_or_default();
                (url, username)
            })
            .unwrap_or_default();

        let proxy_password =
            crate::auth::keyring::get_token(crate::auth::keyring::PROXY_PASSWORD_ACCOUNT)
                .ok()
                .flatten()
                .unwrap_or_default();

        let http_client = build_http_client(&proxy_url, &proxy_username, &proxy_password)
            .unwrap_or_else(|_| {
                reqwest::Client::builder()
                    .use_rustls_tls()
                    .user_agent("ollama/0.3.11 (linux amd64) Go/1.22.4")
                    .build()
                    .expect("fallback HTTP client build failed")
            });

        Ok(Self {
            db,
            db_path,
            http_client: RwLock::new(http_client),
            cancel_tx: Mutex::new(None),
            model_create_cancel_tx: Mutex::new(HashMap::new()),
            health_loop_shutdown: Mutex::new(None),
            health_loop_handle: std::sync::Mutex::new(None),
            is_chat_view: RwLock::new(true),
            active_conversation_id: RwLock::new(None),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_http_client_no_proxy() {
        assert!(build_http_client("", "", "").is_ok());
    }

    #[test]
    fn test_build_http_client_http_proxy() {
        assert!(build_http_client("http://proxy.example.com:3128", "", "").is_ok());
    }

    #[test]
    fn test_build_http_client_socks5_proxy() {
        assert!(build_http_client("socks5://proxy.example.com:1080", "", "").is_ok());
    }

    #[test]
    fn test_build_http_client_with_credentials() {
        assert!(build_http_client("http://proxy.example.com:3128", "user", "pass").is_ok());
    }

    #[test]
    fn test_build_http_client_invalid_url() {
        assert!(build_http_client("not_a_url", "", "").is_err());
    }
}
