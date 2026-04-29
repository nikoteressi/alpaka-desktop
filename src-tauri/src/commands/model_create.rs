use crate::commands::models::ModelInfo;
use crate::error::AppError;
use crate::ollama::client::OllamaClient;
use crate::state::AppState;
use futures_util::StreamExt;
use serde::Deserialize;
use tauri::{Emitter, Runtime, State};
use tokio::sync::broadcast;

#[derive(Debug, Deserialize)]
struct CreateProgress {
    status: String,
}

pub async fn core_get_modelfile(client: &OllamaClient, name: &str) -> Result<String, AppError> {
    let resp = client
        .post("/api/show")
        .json(&serde_json::json!({ "name": name, "verbose": false }))
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Failed to fetch modelfile for '{}': {}",
            name,
            resp.status()
        )));
    }

    let info: ModelInfo = resp.json().await?;
    Ok(info.modelfile.unwrap_or_default())
}

#[tauri::command]
pub async fn get_modelfile(state: State<'_, AppState>, name: String) -> Result<String, AppError> {
    let client = OllamaClient::from_state(state.http_client.clone(), state.db.clone()).await?;
    core_get_modelfile(&client, &name).await
}

pub async fn core_create_model<R: Runtime>(
    client: &OllamaClient,
    app: &tauri::AppHandle<R>,
    name: &str,
    modelfile: &str,
    mut cancel_rx: broadcast::Receiver<()>,
) -> Result<(), AppError> {
    let payload = serde_json::json!({
        "name": name,
        "modelfile": modelfile,
        "stream": true,
    });

    let resp = client.post("/api/create").json(&payload).send().await?;

    if !resp.status().is_success() {
        let err_msg = format!("Ollama returned {}", resp.status());
        let _ = app.emit(
            "model:create-error",
            serde_json::json!({ "model": name, "error": err_msg, "cancelled": false }),
        );
        crate::system::notifications::notify_model_create_failed(app, name, &err_msg);
        return Err(AppError::Http(err_msg));
    }

    let mut stream = resp.bytes_stream();
    let mut cancelled = false;

    loop {
        tokio::select! {
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        let text = String::from_utf8_lossy(&bytes);
                        for line in text.lines() {
                            if line.trim().is_empty() { continue; }
                            if let Ok(progress) = serde_json::from_str::<CreateProgress>(line) {
                                let _ = app.emit(
                                    "model:create-progress",
                                    serde_json::json!({ "model": name, "status": progress.status }),
                                );
                            }
                        }
                    }
                    Some(Err(e)) => {
                        let err_msg = e.to_string();
                        let _ = app.emit(
                            "model:create-error",
                            serde_json::json!({ "model": name, "error": err_msg, "cancelled": false }),
                        );
                        crate::system::notifications::notify_model_create_failed(app, name, &err_msg);
                        return Err(AppError::Http(err_msg));
                    }
                    None => break,
                }
            }
            _ = cancel_rx.recv() => {
                cancelled = true;
                break;
            }
        }
    }

    if cancelled {
        let _ = app.emit(
            "model:create-error",
            serde_json::json!({ "model": name, "error": "Cancelled by user", "cancelled": true }),
        );
        crate::system::notifications::notify_model_create_cancelled(app, name);
    } else {
        let _ = app.emit("model:create-done", serde_json::json!({ "model": name }));
        crate::system::notifications::notify_model_created(app, name);
    }

    Ok(())
}

#[tauri::command]
pub async fn create_model<R: Runtime>(
    state: State<'_, AppState>,
    app: tauri::AppHandle<R>,
    name: String,
    modelfile: String,
) -> Result<(), AppError> {
    let client = OllamaClient::from_state(state.http_client.clone(), state.db.clone()).await?;

    let (cancel_tx, cancel_rx) = broadcast::channel::<()>(1);
    {
        let mut map = state
            .model_create_cancel_tx
            .lock()
            .map_err(|_| AppError::Internal("cancel lock poisoned".into()))?;
        map.insert(name.clone(), cancel_tx);
    }

    let result = core_create_model(&client, &app, &name, &modelfile, cancel_rx).await;

    // Clean up cancel sender regardless of outcome
    if let Ok(mut map) = state.model_create_cancel_tx.lock() {
        map.remove(&name);
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;
    use tokio::sync::broadcast;

    #[tokio::test]
    async fn test_get_modelfile_success() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/show")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"modelfile":"FROM llama3\nSYSTEM \"You are helpful.\"\n"}"#)
            .create_async()
            .await;

        let client = reqwest::Client::new();
        let ollama = OllamaClient::new(client, server.url(), None);
        let result = core_get_modelfile(&ollama, "llama3").await;
        mock.assert_async().await;

        assert!(result.is_ok());
        assert!(result.unwrap().contains("FROM llama3"));
    }

    #[tokio::test]
    async fn test_get_modelfile_missing_field_returns_empty() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/show")
            .with_status(200)
            .with_body(r#"{"capabilities":[]}"#)
            .create_async()
            .await;

        let client = reqwest::Client::new();
        let ollama = OllamaClient::new(client, server.url(), None);
        let result = core_get_modelfile(&ollama, "llama3").await;
        mock.assert_async().await;

        assert_eq!(result.unwrap(), "");
    }

    #[tokio::test]
    async fn test_get_modelfile_http_error() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/show")
            .with_status(404)
            .create_async()
            .await;

        let client = reqwest::Client::new();
        let ollama = OllamaClient::new(client, server.url(), None);
        let result = core_get_modelfile(&ollama, "missing").await;
        mock.assert_async().await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_core_create_model_success() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/create")
            .with_status(200)
            .with_body(
                "{\"status\":\"reading model metadata\"}\n\
                 {\"status\":\"writing manifest\"}\n\
                 {\"status\":\"success\"}\n",
            )
            .create_async()
            .await;

        let client = reqwest::Client::new();
        let ollama = OllamaClient::new(client, server.url(), None);
        let app = tauri::test::mock_app();
        let (_cancel_tx, cancel_rx) = broadcast::channel::<()>(1);

        let result =
            core_create_model(&ollama, app.handle(), "mymodel", "FROM llama3", cancel_rx).await;
        mock.assert_async().await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_core_create_model_http_error() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/create")
            .with_status(400)
            .with_body(r#"{"error":"invalid modelfile"}"#)
            .create_async()
            .await;

        let client = reqwest::Client::new();
        let ollama = OllamaClient::new(client, server.url(), None);
        let app = tauri::test::mock_app();
        let (_tx, cancel_rx) = broadcast::channel::<()>(1);

        let result =
            core_create_model(&ollama, app.handle(), "mymodel", "FROM llama3", cancel_rx).await;
        mock.assert_async().await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_core_create_model_cancel() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/create")
            .with_status(200)
            .with_body("{\"status\":\"reading model metadata\"}\n")
            .create_async()
            .await;

        let client = reqwest::Client::new();
        let ollama = OllamaClient::new(client, server.url(), None);
        let app = tauri::test::mock_app();
        let (cancel_tx, cancel_rx) = broadcast::channel::<()>(1);
        let _ = cancel_tx.send(()); // cancel immediately

        let result =
            core_create_model(&ollama, app.handle(), "mymodel", "FROM llama3", cancel_rx).await;
        mock.assert_async().await;

        // cancelled returns Ok(()) but emits model:create-error with cancelled:true
        assert!(result.is_ok());
    }
}
