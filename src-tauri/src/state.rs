use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use tokio::sync::broadcast;

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

    /// Shared HTTP client with connection pooling (used by the Ollama API client).
    pub http_client: reqwest::Client,

    /// Send on this channel to interrupt an in-progress generation.
    /// Set to `None` when no generation is running.
    pub cancel_tx: Mutex<Option<broadcast::Sender<()>>>,

    /// Per-model cancellation senders for in-progress create_model commands.
    /// Key is the model name; dropping the sender also cancels the stream.
    pub model_create_cancel_tx: Mutex<HashMap<String, broadcast::Sender<()>>>,

    /// Send on this channel to shut down the host health loop task.
    /// Stored here so the loop can be terminated cleanly on app exit.
    pub health_loop_shutdown: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,

    /// Join handle for the host health loop task.
    /// Stored so the task can be awaited or observed on app shutdown.
    pub health_loop_handle: std::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,

    /// Tracks if the user is currently on a chat-related page.
    pub is_chat_view: Mutex<bool>,
    /// Tracks the ID of the conversation currently visible to the user.
    pub active_conversation_id: Mutex<Option<String>>,
}

impl AppState {
    pub fn new(db: DbConn, db_path: PathBuf) -> Result<Self, reqwest::Error> {
        let http_client = reqwest::Client::builder()
            .use_rustls_tls()
            .user_agent("ollama/0.3.11 (linux amd64) Go/1.22.4")
            .build()?;

        Ok(Self {
            db,
            db_path,
            http_client,
            cancel_tx: Mutex::new(None),
            model_create_cancel_tx: Mutex::new(HashMap::new()),
            health_loop_shutdown: Mutex::new(None),
            health_loop_handle: std::sync::Mutex::new(None),
            is_chat_view: Mutex::new(true),
            active_conversation_id: Mutex::new(None),
        })
    }
}
