use serde::Serialize;
use tauri::command;

use super::fetch_host_url;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct OllamaUserProfile {
    pub name: String,
    pub email: Option<String>,
    pub plan: Option<String>,
}

/// Fetches the signed-in user's profile by calling the local Ollama daemon's
/// /api/me endpoint. The daemon handles the SSH key signing and forwarding to
/// ollama.com internally — we do not need to replicate that logic here.
#[command]
pub async fn get_ollama_user_profile(
    state: tauri::State<'_, crate::state::AppState>,
    host_id: Option<String>,
) -> Result<OllamaUserProfile, AppError> {
    let db = state.db.clone();
    let resolved_host_id = host_id.unwrap_or_else(|| "default".to_string());

    let host_url = fetch_host_url(db, resolved_host_id).await?;
    let url = format!("{}/api/me", host_url.trim_end_matches('/'));

    let client = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();

    let resp = client
        .post(&url)
        .body("")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to reach Ollama daemon: {e}")))?;

    if resp.status() == 401 {
        return Err(AppError::Auth(
            "Not signed in — please sign in via the Account tab.".into(),
        ));
    }

    if !resp.status().is_success() {
        return Err(AppError::Auth(format!(
            "Profile fetch failed (HTTP {})",
            resp.status()
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse profile response: {e}")))?;

    let name = body["name"]
        .as_str()
        .unwrap_or("")
        .to_string();

    if name.is_empty() {
        return Err(AppError::Auth(
            "Not signed in — please sign in via the Account tab.".into(),
        ));
    }

    Ok(OllamaUserProfile {
        name,
        email: body["email"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string()),
        plan: body["plan"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string()),
    })
}
