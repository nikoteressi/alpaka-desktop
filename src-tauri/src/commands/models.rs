use crate::error::AppError;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use futures_util::StreamExt;
use crate::ollama::client::OllamaClient;

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelDetails {
    // `parent_model` could be empty or absent
    #[serde(default)]
    pub parent_model: String,
    #[serde(default)]
    pub format: String,
    #[serde(default)]
    pub family: String,
    #[serde(default)]
    pub families: Option<Vec<String>>,
    #[serde(default)]
    pub parameter_size: String,
    #[serde(default)]
    pub quantization_level: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Model {
    pub name: String,
    pub model: String,
    pub modified_at: String,
    pub size: u64,
    pub digest: String,
    pub details: ModelDetails,
}

#[derive(Debug, Deserialize)]
pub struct TagsResponse {
    pub models: Vec<Model>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PullProgress {
    pub status: String,
    pub digest: Option<String>,
    pub total: Option<u64>,
    pub completed: Option<u64>,
}

pub async fn core_list_models(client: &OllamaClient) -> Result<Vec<Model>, AppError> {
    let resp = client.get("/api/tags").send().await?;
    let tags_resp: TagsResponse = resp.json().await?;
    Ok(tags_resp.models)
}

#[tauri::command]
pub async fn list_models(state: State<'_, AppState>) -> Result<Vec<Model>, AppError> {
    let client = OllamaClient::from_state(state.http_client.clone(), state.db.clone()).await?;
    core_list_models(&client).await
}

pub async fn core_delete_model(client: &OllamaClient, name: &str) -> Result<(), AppError> {
    let payload = serde_json::json!({ "name": name });
    let resp = client.delete("/api/delete").json(&payload).send().await?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(AppError::Http(format!("Failed to delete model: {}", resp.status())))
    }
}

#[tauri::command]
pub async fn delete_model(state: State<'_, AppState>, name: String) -> Result<(), AppError> {
    let client = OllamaClient::from_state(state.http_client.clone(), state.db.clone()).await?;
    core_delete_model(&client, &name).await
}

pub async fn core_pull_model<R: tauri::Runtime>(
    client: &OllamaClient,
    name: &str,
    app: &tauri::AppHandle<R>,
) -> Result<(), AppError> {
    let payload = serde_json::json!({ "name": name, "stream": true });
    
    let resp = client.post("/api/pull").json(&payload).send().await?;
    if !resp.status().is_success() {
        return Err(AppError::Http(format!("Failed to pull model: {}", resp.status())));
    }

    let mut stream = resp.bytes_stream();
    
    while let Some(chunk_res) = stream.next().await {
        match chunk_res {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    if line.trim().is_empty() { continue; }
                    if let Ok(progress) = serde_json::from_str::<PullProgress>(line) {
                        let percent = if let (Some(c), Some(t)) = (progress.completed, progress.total) {
                            if t > 0 { (c as f64 / t as f64) * 100.0 } else { 0.0 }
                        } else {
                            0.0
                        };
                        let _ = app.emit("model:pull-progress", serde_json::json!({
                            "model": name,
                            "status": progress.status,
                            "completed": progress.completed,
                            "total": progress.total,
                            "percent": percent,
                        }));
                    }
                }
            }
            Err(e) => {
                return Err(AppError::Http(e.to_string()));
            }
        }
    }
    
    let _ = app.emit("model:pull-done", serde_json::json!({ "model": name }));
    Ok(())
}

#[tauri::command]
pub async fn pull_model<R: tauri::Runtime>(
    state: State<'_, AppState>,
    app: tauri::AppHandle<R>,
    name: String,
) -> Result<(), AppError> {
    let client = OllamaClient::from_state(state.http_client.clone(), state.db.clone()).await?;
    core_pull_model(&client, &name, &app).await
}

// pull_model will need more than just client and base_url because it emits events.
// We can pass an `app: &AppHandle` to the core function.

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;

    #[tokio::test]
    async fn test_list_models_success() {
        let mut server = Server::new_async().await;
        let mock = server.mock("GET", "/api/tags")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"models":[{"name":"llama3","model":"llama3","modified_at":"2023","size":100,"digest":"abc","details":{"parent_model":"","format":"gguf","family":"llama","families":["llama"],"parameter_size":"8B","quantization_level":"Q4"}}]}"#)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);
        let result = core_list_models(&client).await;
        mock.assert_async().await;

        assert!(result.is_ok());
        let models = result.unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].name, "llama3");
    }

    #[tokio::test]
    async fn test_list_models_malformed_json() {
        let mut server = Server::new_async().await;
        let mock = server.mock("GET", "/api/tags")
            .with_status(200)
            .with_body(r#"{"models": "not a list"}"#)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);
        let result = core_list_models(&client).await;
        mock.assert_async().await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_list_models_error() {
        let mut server = Server::new_async().await;
        let mock = server.mock("GET", "/api/tags")
            .with_status(500)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);
        let result = core_list_models(&client).await;
        mock.assert_async().await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_model_success() {
        let mut server = Server::new_async().await;
        let mock = server.mock("DELETE", "/api/delete")
            .match_body(mockito::Matcher::Json(serde_json::json!({"name": "llama3"})))
            .with_status(200)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);
        let result = core_delete_model(&client, "llama3").await;
        mock.assert_async().await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_delete_model_error() {
        let mut server = Server::new_async().await;
        let mock = server.mock("DELETE", "/api/delete")
            .with_status(404)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);
        let result = core_delete_model(&client, "llama3").await;
        mock.assert_async().await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_core_pull_model_success() {
        let mut server = Server::new_async().await;
        // Mock NDJSON stream
        let mock = server.mock("POST", "/api/pull")
            .with_status(200)
            .with_body(r#"{"status":"downloading","completed":10,"total":100}
{"status":"downloading","completed":50,"total":100}
{"status":"success"}
"#)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);
        
        let app = tauri::test::mock_app();
        let result = core_pull_model(&client, "llama3", &app.handle()).await;
        mock.assert_async().await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_core_pull_model_invalid_chunk_skips_line() {
        let mut server = Server::new_async().await;
        let mock = server.mock("POST", "/api/pull")
            .with_status(200)
            .with_body(r#"{"status":"downloading","completed":10,"total":100}
not json at all
{"status":"success"}
"#)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);
        
        let app = tauri::test::mock_app();
        let result = core_pull_model(&client, "llama3", &app.handle()).await;
        mock.assert_async().await;

        // Function should continue and succeed even if one line is bad
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_core_pull_model_http_error() {
        let mut server = Server::new_async().await;
        let mock = server.mock("POST", "/api/pull")
            .with_status(403)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);
        
        let app = tauri::test::mock_app();
        let result = core_pull_model(&client, "llama3", &app.handle()).await;
        mock.assert_async().await;

        assert!(result.is_err());
    }
}

