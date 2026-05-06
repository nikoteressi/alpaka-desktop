mod api_key;
mod oauth;
mod profile;

pub use api_key::*;
pub use oauth::*;
pub use profile::*;

use crate::db::DbConn;
use crate::error::AppError;
use std::path::PathBuf;

/// Returns the path to the Ollama ed25519 private key used for cloud auth.
pub(super) fn ollama_key_path() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_default())
        .join(".ollama")
        .join("id_ed25519")
}

pub(super) async fn fetch_host_url(db: DbConn, host_id: String) -> Result<String, AppError> {
    let host =
        crate::db::spawn_db(db, move |conn| crate::db::hosts::get_by_id(conn, &host_id)).await?;
    Ok(host.url)
}
