use crate::db::DbConn;
use crate::error::AppError;
use serde_json::json;

/// Execute a web search by posting natively to the Ollama Cloud Search endpoint.
/// This fulfills the user's request to rely 100% on the backend's cloud authentication without third-party local search engines.
pub async fn execute_web_search(
    query: &str,
    http_client: &reqwest::Client,
    db: &DbConn,
) -> Result<String, AppError> {
    log::info!(
        "Executing native Ollama web search for query: {}...",
        &query.chars().take(8).collect::<String>()
    );

    // 0. Try the local daemon's experimental proxy (best for Linux/Native auth)
    // This leverages the daemon's existing SSH-based authentication with ollama.com
    let db_clone_proxy = db.clone();
    let proxy_search_result = if let Ok(active_host) = tokio::task::spawn_blocking(move || {
        let conn = db_clone_proxy
            .lock()
            .map_err(|_| AppError::Db("Lock poisoned".into()))?;
        let hosts = crate::db::hosts::list_all(&conn)?;
        Ok::<_, AppError>(hosts.into_iter().find(|h| h.is_active))
    })
    .await
    {
        if let Ok(Some(h)) = active_host {
            let proxy_url = format!(
                "{}/api/experimental/web_search",
                h.url.trim_end_matches('/')
            );
            log::debug!("Attempting web search via host proxy: {}", proxy_url);

            let resp = http_client
                .post(&proxy_url)
                .header("User-Agent", "OllamaDesktop/0.1.0 (Linux)")
                .json(&json!({ "query": query }))
                .send()
                .await;

            match resp {
                Ok(r) if r.status().is_success() => match r.text().await {
                    Ok(text) => {
                        log::info!(
                            "Successfully performed web search via host proxy: {}",
                            proxy_url
                        );
                        Some(text)
                    }
                    Err(e) => {
                        log::error!("Failed to read proxy response body: {}", e);
                        None
                    }
                },
                Ok(r) if r.status() == 401 => {
                    log::warn!("Host proxy returned 401 Unauthorized. This suggests the Ollama daemon itself needs to be signed in (run 'ollama signin').");
                    None
                }
                Ok(r) => {
                    let status = r.status();
                    log::debug!(
                        "Host proxy returned non-success status {}. Falling back.",
                        status
                    );
                    None
                }
                Err(e) => {
                    log::debug!(
                        "Network error connecting to host proxy: {}. Falling back.",
                        e
                    );
                    None
                }
            }
        } else {
            log::debug!(
                "No active host found for proxy search. Checking fallback hardcoded localhost."
            );
            // Last resort for local Linux users who might not have configured hosts correctly yet
            let local_proxy = "http://localhost:11434/api/experimental/web_search";
            let resp = http_client
                .post(local_proxy)
                .header("User-Agent", "OllamaDesktop/0.1.0 (Linux)")
                .json(&json!({ "query": query }))
                .send()
                .await;

            match resp {
                Ok(r) if r.status().is_success() => r.text().await.ok(),
                _ => None,
            }
        }
    } else {
        None
    };

    if let Some(res) = proxy_search_result {
        return Ok(res);
    }

    // 1. Try environment variable first (highest priority for manual overrides)
    if let Ok(t) = std::env::var("OLLAMA_API_KEY") {
        log::debug!("Using token from OLLAMA_API_KEY environment variable");
        return perform_search(query, http_client, &t, Some(5)).await;
    }

    // 2. Try the ACTIVE host's token (most reliable as cloud models work for the active host)
    let db_clone_active = db.clone();
    let active_token = tokio::task::spawn_blocking(move || {
        let conn = db_clone_active
            .lock()
            .map_err(|_| AppError::Db("Lock poisoned".into()))?;
        let hosts = crate::db::hosts::list_all(&conn)?;
        if let Some(h) = hosts.into_iter().find(|h| h.is_active) {
            log::debug!("Checking token for active host: {}", h.id);
            return crate::auth::keyring::get_token(&h.id);
        }
        Ok(None)
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))??;

    if let Some(t) = active_token {
        log::debug!("Found token for active host");
        return perform_search(query, http_client, &t, Some(5)).await;
    }

    // 3. Fallback: Try the legacy/primary 'cloud' identifier check
    let cloud_token = tokio::task::spawn_blocking(|| crate::auth::keyring::get_token("cloud"))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))??;

    if let Some(t) = cloud_token {
        log::debug!("Found token for 'cloud' identifier fallback");
        return perform_search(query, http_client, &t, Some(5)).await;
    }

    // 4. Final Fallback: Check all other hosts in DB
    let db_clone_all = db.clone();
    let hosts_tokens = tokio::task::spawn_blocking(move || {
        let conn = db_clone_all
            .lock()
            .map_err(|_| AppError::Db("Lock poisoned".into()))?;
        let hosts = crate::db::hosts::list_all(&conn)?;
        let mut tokens = Vec::new();
        for h in hosts {
            // Skip checking again if it was the active one handled above (though searching all is safe)
            if let Ok(Some(t)) = crate::auth::keyring::get_token(&h.id) {
                tokens.push(t);
            }
        }
        Ok::<_, AppError>(tokens)
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))??;

    for (i, t) in hosts_tokens.iter().enumerate() {
        log::debug!("Trying token fallback #{} from hosts list", i + 1);
        match perform_search(query, http_client, t, Some(5)).await {
            Ok(res) => return Ok(res),
            Err(e) => log::warn!("Search fallback #{} failed: {}. Continuing...", i + 1, e),
        }
    }

    Err(AppError::Http("No valid cloud authentication token found. Web search requires a working bearer token. Please ensure you are signed in or have set the OLLAMA_API_KEY environment variable.".into()))
}

pub async fn perform_search(
    query: &str,
    http_client: &reqwest::Client,
    token: &str,
    max_results: Option<usize>,
) -> Result<String, AppError> {
    let mut payload = json!({
        "query": query
    });

    if let Some(n) = max_results {
        payload["max_results"] = json!(n);
    }

    let resp = http_client
        .post("https://ollama.com/api/web_search")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "OllamaDesktop/0.1.0 (Linux)")
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Http(format!("Network error during search: {}", e)))?;

    if resp.status().is_success() {
        let text = resp
            .text()
            .await
            .map_err(|e| AppError::Http(format!("Failed to read search response body: {}", e)))?;
        Ok(text)
    } else {
        let status = resp.status();
        let error_body = resp
            .text()
            .await
            .unwrap_or_else(|_| "Could not read error body".to_string());
        Err(AppError::Http(format!(
            "Web search API returned {}: {}",
            status, error_body
        )))
    }
}

/// Formats raw search JSON into a concise, high-signal string for the LLM.
/// This reduces "AI slop" and noise while preserving the most relevant context.
pub fn format_search_results_for_llm(raw_json: &str) -> String {
    let parsed: serde_json::Value = match serde_json::from_str(raw_json) {
        Ok(v) => v,
        Err(_) => return raw_json.to_string(), // Fallback to raw if not JSON
    };

    let results = if let Some(arr) = parsed.get("results").and_then(|r| r.as_array()) {
        arr
    } else if let Some(arr) = parsed.as_array() {
        arr
    } else {
        return raw_json.to_string();
    };

    if results.is_empty() {
        return "No search results found.".to_string();
    }

    let mut output = String::from("Search Results:\n\n");
    // Limit to top 3 results to keep context focused and avoid "slop"
    for (i, res) in results.iter().take(3).enumerate() {
        let title = res
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled");
        let content = res.get("content").and_then(|v| v.as_str()).unwrap_or("");
        let url = res.get("url").and_then(|v| v.as_str()).unwrap_or("No URL");

        output.push_str(&format!(
            "[{}] Title: {}\nURL: {}\nContent: {}\n\n",
            i + 1,
            title,
            url,
            content.trim()
        ));
    }
    output
}
