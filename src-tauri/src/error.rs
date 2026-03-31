use serde::Serialize;
use thiserror::Error;

// ── Database errors ────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Record not found: {0}")]
    NotFound(String),

    #[error("Database lock poisoned")]
    LockPoisoned,

    #[error("Blocking task failed: {0}")]
    JoinError(#[from] tokio::task::JoinError),
}

// ── Application-level error ────────────────────────────────────────────────────

/// The single error type returned by all Tauri commands.
/// Must implement `Serialize` so Tauri can forward it to the frontend as JSON.
#[derive(Debug, Error, Serialize)]
pub enum AppError {
    #[error("Database error: {0}")]
    Db(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("HTTP error: {0}")]
    Http(String),

    #[error("Auth error: {0}")]
    Auth(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Service error: {0}")]
    Service(String),
}

// ── Conversions ────────────────────────────────────────────────────────────────

impl From<DbError> for AppError {
    fn from(e: DbError) -> Self {
        match e {
            DbError::NotFound(msg) => AppError::NotFound(msg),
            other => AppError::Db(other.to_string()),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Db(e.to_string())
    }
}

impl From<tokio::task::JoinError> for AppError {
    fn from(e: tokio::task::JoinError) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Serialization(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Http(e.to_string())
    }
}

impl From<keyring::Error> for AppError {
    fn from(e: keyring::Error) -> Self {
        match e {
            keyring::Error::NoEntry => AppError::NotFound("Credentials not found in keyring".to_string()),
            _ => AppError::Auth(format!("Keyring error: {}", e)),
        }
    }
}
