use crate::error::AppError;
use crate::ollama::client::OllamaClient;
use crate::state::AppState;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

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

#[derive(Debug, Deserialize)]
struct StreamError {
    error: String,
}

pub async fn core_list_models(client: &OllamaClient) -> Result<Vec<Model>, AppError> {
    let resp = client.get("/api/tags").send().await?;
    let tags_resp: TagsResponse = resp.json().await?;
    Ok(tags_resp.models)
}

#[tauri::command]
pub async fn list_models(state: State<'_, AppState>) -> Result<Vec<Model>, AppError> {
    let http = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let client = OllamaClient::from_state(http, state.db.clone()).await?;
    core_list_models(&client).await
}

pub async fn core_delete_model(client: &OllamaClient, name: &str) -> Result<(), AppError> {
    let payload = serde_json::json!({ "name": name });
    let resp = client.delete("/api/delete").json(&payload).send().await?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(AppError::Http(format!(
            "Failed to delete model: {}",
            resp.status()
        )))
    }
}

#[tauri::command]
pub async fn delete_model(state: State<'_, AppState>, name: String) -> Result<(), AppError> {
    let http = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let client = OllamaClient::from_state(http, state.db.clone()).await?;
    core_delete_model(&client, &name).await
}

pub async fn core_pull_model<R: tauri::Runtime>(
    client: &OllamaClient,
    name: &str,
    app: &tauri::AppHandle<R>,
) -> Result<(), AppError> {
    // Record start of pull in DB
    let payload = serde_json::json!({ "name": name, "stream": true });

    let resp = client.post("/api/pull").json(&payload).send().await?;
    if !resp.status().is_success() {
        let err_msg = format!("Failed to pull model: {}", resp.status());
        crate::system::notifications::notify_model_pull_failed(app, name, &err_msg);
        return Err(AppError::Http(err_msg));
    }

    let mut stream = resp.bytes_stream();

    while let Some(chunk_res) = stream.next().await {
        match chunk_res {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    if line.trim().is_empty() {
                        continue;
                    }
                    if let Ok(progress) = serde_json::from_str::<PullProgress>(line) {
                        let percent =
                            if let (Some(c), Some(t)) = (progress.completed, progress.total) {
                                if t > 0 {
                                    (c as f64 / t as f64) * 100.0
                                } else {
                                    0.0
                                }
                            } else {
                                0.0
                            };
                        let _ = app.emit(
                            "model:pull-progress",
                            serde_json::json!({
                                "model": name,
                                "status": progress.status,
                                "completed": progress.completed,
                                "total": progress.total,
                                "percent": percent,
                            }),
                        );
                    }
                }
            }
            Err(e) => {
                let err_msg = e.to_string();
                crate::system::notifications::notify_model_pull_failed(app, name, &err_msg);
                return Err(AppError::Http(err_msg));
            }
        }
    }

    let _ = app.emit("model:pull-done", serde_json::json!({ "model": name }));
    crate::system::notifications::notify_model_pulled(app, name);
    Ok(())
}

#[tauri::command]
pub async fn pull_model<R: tauri::Runtime>(
    state: State<'_, AppState>,
    app: tauri::AppHandle<R>,
    name: String,
) -> Result<(), AppError> {
    let http = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let client = OllamaClient::from_state(http, state.db.clone()).await?;
    core_pull_model(&client, &name, &app).await
}

pub async fn core_push_model<R: tauri::Runtime>(
    client: &OllamaClient,
    name: &str,
    app: &tauri::AppHandle<R>,
) -> Result<(), AppError> {
    let payload = serde_json::json!({ "name": name, "stream": true });

    let resp = client.post("/api/push").json(&payload).send().await?;
    if !resp.status().is_success() {
        let err_msg = format!("Failed to push model: {}", resp.status());
        let _ = app.emit(
            "model:push-error",
            serde_json::json!({ "model": name, "error": err_msg }),
        );
        crate::system::notifications::notify_model_push_failed(app, name, &err_msg);
        return Err(AppError::Http(err_msg));
    }

    let mut stream = resp.bytes_stream();

    while let Some(chunk_res) = stream.next().await {
        match chunk_res {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for line in text.lines() {
                    if line.trim().is_empty() {
                        continue;
                    }
                    // Daemon embeds auth/namespace errors as {"error":"..."} lines.
                    if let Ok(e) = serde_json::from_str::<StreamError>(line) {
                        let _ = app.emit(
                            "model:push-error",
                            serde_json::json!({ "model": name, "error": e.error }),
                        );
                        crate::system::notifications::notify_model_push_failed(app, name, &e.error);
                        return Err(AppError::Http(e.error));
                    }
                    if let Ok(progress) = serde_json::from_str::<PullProgress>(line) {
                        let percent =
                            if let (Some(c), Some(t)) = (progress.completed, progress.total) {
                                if t > 0 {
                                    (c as f64 / t as f64) * 100.0
                                } else {
                                    0.0
                                }
                            } else {
                                0.0
                            };
                        let _ = app.emit(
                            "model:push-progress",
                            serde_json::json!({
                                "model": name,
                                "status": progress.status,
                                "completed": progress.completed,
                                "total": progress.total,
                                "percent": percent,
                            }),
                        );
                    }
                }
            }
            Err(e) => {
                let err_msg = e.to_string();
                let _ = app.emit(
                    "model:push-error",
                    serde_json::json!({ "model": name, "error": err_msg }),
                );
                crate::system::notifications::notify_model_push_failed(app, name, &err_msg);
                return Err(AppError::Http(err_msg));
            }
        }
    }

    let _ = app.emit("model:push-done", serde_json::json!({ "model": name }));
    crate::system::notifications::notify_model_pushed(app, name);
    Ok(())
}

#[tauri::command]
pub async fn push_model<R: tauri::Runtime>(
    state: State<'_, AppState>,
    app: tauri::AppHandle<R>,
    name: String,
) -> Result<(), AppError> {
    let http = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let client = OllamaClient::from_state(http, state.db.clone()).await?;
    core_push_model(&client, &name, &app).await
}

/// Response from Ollama's /api/show endpoint
#[derive(Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub details: Option<ModelDetails>,
    #[serde(default)]
    pub modelfile: Option<String>,
    #[serde(default)]
    pub parameters: Option<String>,
    #[serde(default)]
    pub model_info: Option<serde_json::Value>,
}

/// Condensed capability set returned to the frontend
#[derive(Debug, Serialize)]
pub struct ModelCapabilities {
    pub name: String,
    /// Model produces reasoning (maybe non-toggleable)
    pub thinking: bool,
    /// Model supports native `think` parameter (boolean or levels)
    pub thinking_toggleable: bool,
    /// List of supported reasoning levels (e.g. ["low", "medium", "high"])
    pub thinking_levels: Vec<String>,
    /// Model supports function/tool calling
    pub tools: bool,
    /// Model can process image inputs
    pub vision: bool,
    /// Model is an embedding model
    pub embedding: bool,
    /// Model supports audio inputs/outputs
    pub audio: bool,
    /// Model is hosted in the cloud
    pub cloud: bool,
    /// Native context window in tokens from model_info.<arch>.context_length
    pub context_length: Option<u64>,
}

/// Extracts the native context window size from Ollama model_info by reading
/// `general.architecture` to derive the architecture-specific key `<arch>.context_length`.
fn extract_context_length_from_info(model_info: &serde_json::Value) -> Option<u64> {
    let arch = model_info.get("general.architecture")?.as_str()?;
    let key = format!("{}.context_length", arch);
    model_info.get(&key)?.as_u64()
}

#[tauri::command]
pub async fn get_model_capabilities(
    state: State<'_, AppState>,
    name: String,
) -> Result<ModelCapabilities, AppError> {
    let http = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let client = OllamaClient::from_state(http, state.db.clone()).await?;
    let resp = client
        .post("/api/show")
        .json(&serde_json::json!({ "name": name, "verbose": false }))
        .send()
        .await?;

    let (caps, parameters, modelfile, context_length) = if resp.status().is_success() {
        let info = resp.json::<ModelInfo>().await.unwrap_or(ModelInfo {
            capabilities: Vec::new(),
            details: None,
            modelfile: None,
            parameters: None,
            model_info: None,
        });
        let ctx_len = info
            .model_info
            .as_ref()
            .and_then(extract_context_length_from_info);
        (
            info.capabilities,
            info.parameters.unwrap_or_default(),
            info.modelfile.unwrap_or_default(),
            ctx_len,
        )
    } else {
        log::warn!(
            "Could not fetch capabilities for '{}': HTTP {} — returning empty",
            name,
            resp.status()
        );
        (Vec::new(), String::new(), String::new(), None)
    };

    let lower = name.to_lowercase();

    // 1. Thinking / Reasoning
    // Reasoning toggle is ONLY shown if the model explicitly declares 'think' as a parameter in its metadata or modelfile.
    let native_levels_found = parameters.to_lowercase().contains("think low")
        || parameters.to_lowercase().contains("think medium")
        || modelfile.to_lowercase().contains("think low");

    let native_think_found = native_levels_found
        || parameters.to_lowercase().contains("think boolean")
        || parameters.to_lowercase().contains("think true")
        || parameters.to_lowercase().contains("think false")
        || modelfile.to_lowercase().contains("parameter think");

    let thinking_toggleable = native_think_found;

    // The thinking icon/status is shown if toggleable OR if the API reports it as a thinking model.
    let thinking = thinking_toggleable || caps.iter().any(|c| c == "thinking");

    let thinking_levels = if native_levels_found {
        vec!["low".to_string(), "medium".to_string(), "high".to_string()]
    } else {
        Vec::new()
    };

    // 2. Tools (Function Calling)
    let tools = caps.iter().any(|c| c == "tools")
        || modelfile.contains(".Tools")
        || modelfile.contains("PARAMETER tools");

    // 3. Others
    let vision = caps.iter().any(|c| c == "vision");
    let embedding = caps.iter().any(|c| c == "embedding");
    let audio = caps.iter().any(|c| c == "audio");

    let cloud =
        caps.iter().any(|c| c == "cloud") || lower.contains(":cloud") || lower.contains("-cloud");

    Ok(ModelCapabilities {
        name,
        thinking,
        thinking_toggleable,
        thinking_levels,
        tools,
        vision,
        embedding,
        audio,
        cloud,
        context_length,
    })
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
        let mock = server
            .mock("GET", "/api/tags")
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
        let mock = server
            .mock("GET", "/api/tags")
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
        let mock = server
            .mock("DELETE", "/api/delete")
            .match_body(mockito::Matcher::Json(
                serde_json::json!({"name": "llama3"}),
            ))
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
        let mock = server
            .mock("DELETE", "/api/delete")
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
        let mock = server
            .mock("POST", "/api/pull")
            .with_status(200)
            .with_body(
                r#"{"status":"downloading","completed":10,"total":100}
{"status":"downloading","completed":50,"total":100}
{"status":"success"}
"#,
            )
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);

        let app = tauri::test::mock_app();
        let result = core_pull_model(&client, "llama3", app.handle()).await;
        mock.assert_async().await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_core_pull_model_invalid_chunk_skips_line() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/pull")
            .with_status(200)
            .with_body(
                r#"{"status":"downloading","completed":10,"total":100}
not json at all
{"status":"success"}
"#,
            )
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);

        let app = tauri::test::mock_app();
        let result = core_pull_model(&client, "llama3", app.handle()).await;
        mock.assert_async().await;

        // Function should continue and succeed even if one line is bad
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_core_pull_model_http_error() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/pull")
            .with_status(403)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);

        let app = tauri::test::mock_app();
        let result = core_pull_model(&client, "llama3", app.handle()).await;
        mock.assert_async().await;

        assert!(result.is_err());
    }

    #[test]
    fn extract_context_length_from_model_info() {
        let model_info: serde_json::Value = serde_json::json!({
            "general.architecture": "qwen2",
            "qwen2.context_length": 32768_u64,
            "qwen2.block_count": 36
        });
        let result = extract_context_length_from_info(&model_info);
        assert_eq!(result, Some(32768u64));
    }

    #[test]
    fn extract_context_length_returns_none_when_architecture_missing() {
        let model_info: serde_json::Value = serde_json::json!({
            "llama.context_length": 8192_u64
        });
        let result = extract_context_length_from_info(&model_info);
        assert_eq!(result, None);
    }

    #[test]
    fn extract_context_length_returns_none_for_null_info() {
        let model_info = serde_json::Value::Null;
        let result = extract_context_length_from_info(&model_info);
        assert_eq!(result, None);
    }

    #[test]
    fn extract_context_length_returns_none_when_key_absent() {
        let model_info = serde_json::json!({
            "general.architecture": "llama",
            "llama.block_count": 32
        });
        assert_eq!(extract_context_length_from_info(&model_info), None);
    }

    #[test]
    fn extract_context_length_returns_none_when_value_is_string() {
        let model_info = serde_json::json!({
            "general.architecture": "llama",
            "llama.context_length": "not-a-number"
        });
        assert_eq!(extract_context_length_from_info(&model_info), None);
    }

    #[tokio::test]
    async fn test_core_push_model_success() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/push")
            .with_status(200)
            .with_body(
                r#"{"status":"starting upload","digest":"sha256:abc","total":100,"completed":0}
{"status":"pushing manifest","completed":80,"total":100}
{"status":"success"}
"#,
            )
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);

        let app = tauri::test::mock_app();
        let result = core_push_model(&client, "myuser/mymodel:latest", app.handle()).await;
        mock.assert_async().await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_core_push_model_http_error() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/push")
            .with_status(403)
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);

        let app = tauri::test::mock_app();
        let result = core_push_model(&client, "myuser/mymodel:latest", app.handle()).await;
        mock.assert_async().await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_core_push_model_invalid_chunk_skips_line() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/push")
            .with_status(200)
            .with_body(
                r#"{"status":"starting upload","completed":0,"total":100}
not valid json at all
{"status":"success"}
"#,
            )
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);

        let app = tauri::test::mock_app();
        let result = core_push_model(&client, "myuser/mymodel:latest", app.handle()).await;
        mock.assert_async().await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_core_push_model_stream_error_field_returns_err() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/push")
            .with_status(200)
            .with_body(
                r#"{"status":"starting upload","completed":0,"total":100}
{"error":"unauthorized: access denied"}
"#,
            )
            .create_async()
            .await;

        let req_client = reqwest::Client::new();
        let client = OllamaClient::new(req_client, server.url(), None);

        let app = tauri::test::mock_app();
        let result = core_push_model(&client, "myuser/mymodel:latest", app.handle()).await;
        mock.assert_async().await;

        assert!(result.is_err());
    }
}
