use std::time::Duration;

use tauri::{Emitter, Manager, Runtime};

use crate::commands::models::{core_list_models, Model};
use crate::ollama::client::OllamaClient;
use crate::services::library;
use crate::state::AppState;

// Parses `"slug:tag"` or `"slug"` (→ `"latest"` tag).
// Returns `None` for cloud models (`:cloud` suffix), private models (`/` in name), empty input, or empty slug.
pub(crate) fn parse_model_name(name: &str) -> Option<(String, String)> {
    if name.is_empty() || name.contains('/') {
        return None;
    }
    let (slug, tag) = name
        .split_once(':')
        .map(|(s, t)| (s.to_string(), t.to_string()))
        .unwrap_or_else(|| (name.to_string(), "latest".to_string()));
    if slug.is_empty() {
        return None;
    }
    if tag == "cloud" {
        return None;
    }
    Some((slug, tag))
}

// Returns true when `local_digest` (sha256:hex64) does NOT start with `lib_hash` (short 7-12 hex).
// A mismatch means a newer version is available.
pub(crate) fn digest_has_update(local_digest: &str, lib_hash: &str) -> bool {
    if lib_hash.is_empty() {
        return false;
    }
    let local_hex = local_digest.trim_start_matches("sha256:");
    if local_hex.is_empty() {
        return false;
    }
    !local_hex.starts_with(lib_hash)
}

async fn check_single_model_update(http: &reqwest::Client, model: &Model) -> bool {
    let (slug, tag) = match parse_model_name(&model.name) {
        Some(p) => p,
        None => return false,
    };

    let tags = match library::get_tags(http, &slug).await {
        Ok(t) => t,
        Err(e) => {
            log::debug!("[model_updates] Could not fetch tags for '{}': {}", slug, e);
            return false;
        }
    };

    let target = format!("{}:{}", slug, tag);
    match tags.iter().find(|t| t.name == target) {
        Some(lib_tag) => digest_has_update(&model.digest, &lib_tag.hash),
        None => false,
    }
}

pub(crate) async fn do_update_check<R: Runtime>(app: &tauri::AppHandle<R>) {
    let state = app.state::<AppState>();
    let http = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let db = state.db.clone();

    let client = match OllamaClient::from_state(http.clone(), db).await {
        Ok(c) => c,
        Err(e) => {
            log::warn!("[model_updates] Ollama client unavailable: {}", e);
            return;
        }
    };

    let models = match core_list_models(&client).await {
        Ok(m) => m,
        Err(e) => {
            log::warn!("[model_updates] Could not list models: {}", e);
            return;
        }
    };

    let mut outdated: Vec<String> = Vec::new();
    for model in &models {
        if check_single_model_update(&http, model).await {
            outdated.push(model.name.clone());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    if let Ok(mut cache) = state.models_with_updates.write() {
        *cache = outdated.clone();
    }

    log::info!(
        "[model_updates] Update check complete: {} model(s) outdated",
        outdated.len()
    );
    let _ = app.emit(
        "model:updates-checked",
        serde_json::json!({ "outdated": outdated }),
    );
}

pub async fn run_update_check_loop<R: Runtime>(
    app: tauri::AppHandle<R>,
    shutdown_rx: tokio::sync::oneshot::Receiver<()>,
) {
    tokio::pin!(shutdown_rx);

    tokio::select! {
        _ = &mut shutdown_rx => return,
        _ = tokio::time::sleep(Duration::from_secs(30)) => {}
    }

    loop {
        do_update_check(&app).await;

        tokio::select! {
            _ = &mut shutdown_rx => break,
            _ = tokio::time::sleep(Duration::from_secs(6 * 3600)) => {}
        }
    }

    log::info!("[model_updates] Update check loop shut down.");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_normal_model_with_tag() {
        assert_eq!(
            parse_model_name("llama3:8b"),
            Some(("llama3".into(), "8b".into()))
        );
    }

    #[test]
    fn parse_model_no_tag_defaults_to_latest() {
        assert_eq!(
            parse_model_name("llama3"),
            Some(("llama3".into(), "latest".into()))
        );
    }

    #[test]
    fn parse_model_with_dots_in_slug() {
        assert_eq!(
            parse_model_name("llama3.1:70b"),
            Some(("llama3.1".into(), "70b".into()))
        );
    }

    #[test]
    fn parse_cloud_model_returns_none() {
        assert_eq!(parse_model_name("llama3:cloud"), None);
    }

    #[test]
    fn parse_private_model_with_slash_returns_none() {
        assert_eq!(parse_model_name("user/private-model"), None);
    }

    #[test]
    fn parse_empty_returns_none() {
        assert_eq!(parse_model_name(""), None);
    }

    #[test]
    fn same_hash_means_no_update() {
        assert!(!digest_has_update("sha256:abc123def456789", "abc123d"));
    }

    #[test]
    fn different_hash_means_update_available() {
        assert!(digest_has_update("sha256:abc123def456789", "xyz789a"));
    }

    #[test]
    fn empty_lib_hash_means_no_update() {
        assert!(!digest_has_update("sha256:abc123def456789", ""));
    }

    #[test]
    fn digest_without_prefix_still_matches() {
        assert!(!digest_has_update("abc123def456789", "abc123d"));
    }

    #[test]
    fn parse_colon_only_returns_none() {
        assert_eq!(parse_model_name(":"), None);
    }

    #[test]
    fn empty_local_digest_means_no_update() {
        assert!(!digest_has_update("", "abc123d"));
    }
}
