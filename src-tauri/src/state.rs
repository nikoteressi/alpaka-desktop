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
    /// Cloneable, thread-safe SQLite connection handle.
    /// Wrap DB calls in `tokio::task::spawn_blocking` to avoid blocking the async runtime.
    pub db: DbConn,

    /// Path to the SQLite database file.
    /// Used by `backup_database` so it never reconstructs the path independently.
    pub db_path: PathBuf,

    /// RwLock allows proxy settings to be applied at runtime without restarting.
    pub http_client: RwLock<reqwest::Client>,

    /// Send on this channel to interrupt an in-progress generation.
    /// Set to `None` when no generation is running.
    pub cancel_tx: Mutex<Option<broadcast::Sender<()>>>,

    /// Per-model cancellation senders for in-progress create_model commands.
    /// Key is the model name; dropping the sender also cancels the stream.
    pub model_create_cancel_tx: Mutex<HashMap<String, oneshot::Sender<()>>>,

    /// Send on this channel to shut down the host health loop task.
    /// Stored here so the loop can be terminated cleanly on app exit.
    pub health_loop_shutdown: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,

    /// Join handle for the host health loop task.
    /// Stored so the task can be awaited or observed on app shutdown.
    pub health_loop_handle: std::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,

    /// Tracks if the user is currently on a chat-related page.
    pub is_chat_view: RwLock<bool>,

    /// Tracks the ID of the conversation currently visible to the user.
    pub active_conversation_id: RwLock<Option<String>>,
}

/// Builds a reqwest client configured with an optional HTTP or SOCKS5 proxy.
///
/// Pass an empty `proxy_url` to build without a proxy.
/// Pass `None` for `password` when no credentials are needed.
pub fn build_http_client(
    proxy_url: &str,
    username: &str,
    password: Option<&str>,
) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .use_rustls_tls()
        .user_agent("ollama/0.3.11 (linux amd64) Go/1.22.4");

    if !proxy_url.is_empty() {
        // Validate URL eagerly: reqwest::Proxy::all is lenient and prepends
        // "http://" to bare host strings, which would silently accept invalid
        // input. We use url::Url::parse to enforce a proper scheme prefix.
        let parsed = url::Url::parse(proxy_url).map_err(|e| format!("Invalid proxy URL: {e}"))?;
        let scheme = parsed.scheme();
        if !matches!(
            scheme,
            "http" | "https" | "socks4" | "socks4a" | "socks5" | "socks5h"
        ) {
            return Err(format!(
                "Unsupported proxy scheme '{scheme}': use http, https, or socks5"
            ));
        }
        let mut proxy = reqwest::Proxy::all(proxy_url).map_err(|e| e.to_string())?;
        let password = password.unwrap_or_default();
        if !username.is_empty() || !password.is_empty() {
            proxy = proxy.basic_auth(username, password);
        }
        builder = builder.proxy(proxy);
    }

    builder.build().map_err(|e| e.to_string())
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

        let proxy_password: Option<String> =
            crate::auth::keyring::get_token(crate::auth::keyring::PROXY_PASSWORD_ACCOUNT)
                .ok()
                .flatten();

        let http_client = build_http_client(&proxy_url, &proxy_username, proxy_password.as_deref())
            .unwrap_or_else(|e| {
                log::warn!(
                    "Proxy configuration invalid at startup; connecting without proxy. \
                     Check Settings → Connection."
                );
                let _ = e;
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
        assert!(build_http_client("", "", None).is_ok());
    }

    #[test]
    fn test_build_http_client_http_proxy() {
        assert!(build_http_client("http://proxy.example.com:3128", "", None).is_ok());
    }

    #[test]
    fn test_build_http_client_socks5_proxy() {
        assert!(build_http_client("socks5://proxy.example.com:1080", "", None).is_ok());
    }

    #[test]
    fn test_build_http_client_with_credentials() {
        assert!(build_http_client("http://proxy.example.com:3128", "user", Some("pass")).is_ok());
    }

    #[test]
    fn test_build_http_client_invalid_url() {
        assert!(build_http_client("not_a_url", "", None).is_err());
    }
}
