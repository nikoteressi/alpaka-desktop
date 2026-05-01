use crate::commands::models::ModelInfo;
use crate::error::AppError;
use crate::ollama::client::OllamaClient;
use crate::state::AppState;
use futures_util::StreamExt;
use serde::Deserialize;
use std::collections::HashMap;
use tauri::{Emitter, Runtime, State};
use tokio::sync::oneshot;

#[derive(Debug, Deserialize)]
struct CreateProgress {
    status: String,
}

pub async fn core_get_modelfile(client: &OllamaClient, name: &str) -> Result<String, AppError> {
    let resp = client
        .post("/api/show")
        .json(&serde_json::json!({ "model": name, "verbose": false }))
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
    let modelfile = info.modelfile.unwrap_or_default();

    // /api/show returns FROM with an internal blob path (e.g. /root/.ollama/models/blobs/sha256-...)
    // or a sha256 digest. Replace it with the actual model name so the modelfile is reusable.
    let sanitized = modelfile
        .lines()
        .map(|line| {
            let t = line.trim();
            if t.to_uppercase().starts_with("FROM ") {
                let from_val = t[5..].trim();
                if from_val.starts_with('/') || from_val.starts_with("sha256:") {
                    return format!("FROM {}", name);
                }
            }
            line.to_string()
        })
        .collect::<Vec<_>>()
        .join("\n");

    Ok(sanitized)
}

#[tauri::command]
pub async fn get_modelfile(state: State<'_, AppState>, name: String) -> Result<String, AppError> {
    let client = OllamaClient::from_state(state.http_client.clone(), state.db.clone()).await?;
    core_get_modelfile(&client, &name).await
}

/// Parse Modelfile text into the structured fields the Ollama 0.6+ /api/create expects.
/// The old "modelfile" top-level string is no longer accepted; instead the endpoint
/// takes "from", "system", "template", "parameters", "messages", and "license".
fn build_create_payload(model_name: &str, modelfile: &str) -> serde_json::Value {
    let mut from: Option<String> = None;
    let mut system: Option<String> = None;
    let mut template_val: Option<String> = None;
    let mut license: Option<String> = None;
    let mut parameters: HashMap<String, Vec<serde_json::Value>> = HashMap::new();
    let mut messages: Vec<serde_json::Value> = Vec::new();

    let lines: Vec<&str> = modelfile.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let trimmed = lines[i].trim();
        i += 1;

        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let (keyword, rest) = trimmed
            .split_once(char::is_whitespace)
            .map(|(k, r)| (k.to_uppercase(), r.trim_start()))
            .unwrap_or_else(|| (trimmed.to_uppercase(), ""));

        match keyword.as_str() {
            "FROM" => {
                from = Some(rest.to_string());
            }
            "SYSTEM" => {
                let (val, consumed) = parse_block(rest, &lines[i..]);
                system = Some(val);
                i += consumed;
            }
            "TEMPLATE" => {
                let (val, consumed) = parse_block(rest, &lines[i..]);
                template_val = Some(val);
                i += consumed;
            }
            "LICENSE" => {
                let (val, consumed) = parse_block(rest, &lines[i..]);
                license = Some(val);
                i += consumed;
            }
            "PARAMETER" => {
                if let Some((key, val_str)) = rest.split_once(char::is_whitespace) {
                    parameters
                        .entry(key.to_string())
                        .or_default()
                        .push(parse_param_value(val_str.trim()));
                }
            }
            "MESSAGE" => {
                if let Some((role, content_rest)) = rest.split_once(char::is_whitespace) {
                    let (content_val, consumed) = parse_block(content_rest.trim(), &lines[i..]);
                    messages.push(serde_json::json!({ "role": role, "content": content_val }));
                    i += consumed;
                }
            }
            _ => {}
        }
    }

    let mut payload = serde_json::json!({ "model": model_name, "stream": true });
    if let Some(v) = from {
        payload["from"] = v.into();
    }
    if let Some(v) = system {
        payload["system"] = v.into();
    }
    if let Some(v) = template_val {
        payload["template"] = v.into();
    }
    if let Some(v) = license {
        payload["license"] = v.into();
    }
    if !parameters.is_empty() {
        let mut params_map = serde_json::Map::new();
        for (k, mut vals) in parameters {
            if vals.len() == 1 {
                params_map.insert(k, vals.remove(0));
            } else {
                params_map.insert(k, serde_json::Value::Array(vals));
            }
        }
        payload["parameters"] = serde_json::Value::Object(params_map);
    }
    if !messages.is_empty() {
        payload["messages"] = serde_json::Value::Array(messages);
    }
    payload
}

/// Parse a value that may be a bare word, a "quoted string", or a """triple-quoted block""".
fn parse_block(start: &str, remaining: &[&str]) -> (String, usize) {
    if let Some(after_open) = start.strip_prefix("\"\"\"") {
        if let Some(end) = after_open.find("\"\"\"") {
            return (after_open[..end].trim().to_string(), 0);
        }
        let mut value = after_open.to_string();
        let mut consumed = 0;
        for line in remaining {
            consumed += 1;
            if let Some(end) = line.find("\"\"\"") {
                value.push('\n');
                value.push_str(&line[..end]);
                break;
            }
            value.push('\n');
            value.push_str(line);
        }
        (value.trim().to_string(), consumed)
    } else if start.starts_with('"') && start.ends_with('"') && start.len() >= 2 {
        let inner = &start[1..start.len() - 1];
        (inner.to_string(), 0)
    } else {
        (start.to_string(), 0)
    }
}

fn parse_param_value(s: &str) -> serde_json::Value {
    let s = if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
        &s[1..s.len() - 1]
    } else {
        s
    };
    if let Ok(v) = s.parse::<i64>() {
        return v.into();
    }
    if let Ok(v) = s.parse::<f64>() {
        if let Some(n) = serde_json::Number::from_f64(v) {
            return serde_json::Value::Number(n);
        }
    }
    s.to_string().into()
}

pub async fn core_create_model<R: Runtime>(
    client: &OllamaClient,
    app: &tauri::AppHandle<R>,
    name: &str,
    modelfile: &str,
    cancel_rx: oneshot::Receiver<()>,
) -> Result<(), AppError> {
    let payload = build_create_payload(name, modelfile);

    let resp = client.post("/api/create").json(&payload).send().await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let err_msg = if body.is_empty() {
            format!("Ollama returned {}", status)
        } else {
            format!("Ollama returned {}: {}", status, body.trim())
        };
        let _ = app.emit(
            "model:create-error",
            serde_json::json!({ "model": name, "error": err_msg, "cancelled": false }),
        );
        crate::system::notifications::notify_model_create_failed(app, name, &err_msg);
        return Err(AppError::Http(err_msg));
    }

    let mut stream = resp.bytes_stream();
    let mut cancelled = false;
    let mut buf = String::new();
    let mut cancel_rx = cancel_rx;

    loop {
        tokio::select! {
            biased;
            _ = &mut cancel_rx => {
                cancelled = true;
                break;
            }
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        buf.push_str(&String::from_utf8_lossy(&bytes));
                        while let Some(pos) = buf.find('\n') {
                            let line = buf.drain(..=pos).collect::<String>();
                            let line = line.trim();
                            if line.is_empty() { continue; }
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

    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    {
        let mut map = state
            .model_create_cancel_tx
            .lock()
            .map_err(|_| AppError::Internal("cancel lock poisoned".into()))?;
        if map.contains_key(&name) {
            return Err(AppError::Internal(format!(
                "create already in progress for '{name}'"
            )));
        }
        map.insert(name.clone(), cancel_tx);
    }

    let result = core_create_model(&client, &app, &name, &modelfile, cancel_rx).await;

    // Clean up cancel sender regardless of outcome
    if let Ok(mut map) = state.model_create_cancel_tx.lock() {
        map.remove(&name);
    }

    result
}

#[tauri::command]
pub async fn cancel_model_create(state: State<'_, AppState>, name: String) -> Result<(), AppError> {
    let mut map = state
        .model_create_cancel_tx
        .lock()
        .map_err(|_| AppError::Internal("cancel lock poisoned".into()))?;
    if let Some(tx) = map.remove(&name) {
        let _ = tx.send(()); // error means receiver already dropped (stream finished), ignore
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;
    use tokio::sync::oneshot;

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
    async fn test_get_modelfile_sanitizes_blob_path() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/api/show")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"modelfile":"FROM /root/.ollama/models/blobs/sha256-abc123\nSYSTEM \"hi\"\n"}"#,
            )
            .create_async()
            .await;

        let client = reqwest::Client::new();
        let ollama = OllamaClient::new(client, server.url(), None);
        let result = core_get_modelfile(&ollama, "qwen2.5:7b").await;
        mock.assert_async().await;

        let mf = result.unwrap();
        assert!(
            mf.contains("FROM qwen2.5:7b"),
            "blob path should be replaced with model name"
        );
        assert!(
            !mf.contains("/root/.ollama"),
            "internal path should be removed"
        );
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
        let (_cancel_tx, cancel_rx) = oneshot::channel::<()>();

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
        let (_tx, cancel_rx) = oneshot::channel::<()>();

        let result =
            core_create_model(&ollama, app.handle(), "mymodel", "FROM llama3", cancel_rx).await;
        mock.assert_async().await;

        assert!(result.is_err());
    }

    #[test]
    fn test_build_payload_basic() {
        let modelfile = "FROM llama3\n\nSYSTEM \"You are helpful.\"\nPARAMETER temperature 0.7\n";
        let payload = build_create_payload("mymodel", modelfile);
        assert_eq!(payload["model"], "mymodel");
        assert_eq!(payload["from"], "llama3");
        assert_eq!(payload["system"], "You are helpful.");
        assert_eq!(payload["parameters"]["temperature"], 0.7);
    }

    #[test]
    fn test_build_payload_triple_quoted_system() {
        let modelfile = "FROM llama3\nSYSTEM \"\"\"\nYou are Mario.\n\"\"\"\n";
        let payload = build_create_payload("mario", modelfile);
        assert_eq!(payload["from"], "llama3");
        assert_eq!(payload["system"], "You are Mario.");
    }

    #[test]
    fn test_build_payload_no_from_omits_field() {
        let payload = build_create_payload("mymodel", "SYSTEM \"hi\"\n");
        assert!(payload.get("from").is_none() || payload["from"].is_null());
        assert_eq!(payload["system"], "hi");
    }

    #[test]
    fn test_cancel_removes_sender_from_map() {
        let (tx, _rx) = oneshot::channel::<()>();
        let mut map: HashMap<String, oneshot::Sender<()>> = HashMap::new();
        map.insert("mymodel".to_string(), tx);

        // Simulate what cancel_model_create does:
        if let Some(tx) = map.remove("mymodel") {
            let _ = tx.send(());
        }

        assert!(!map.contains_key("mymodel"));
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
        let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
        let _ = cancel_tx.send(()); // cancel immediately

        let result =
            core_create_model(&ollama, app.handle(), "mymodel", "FROM llama3", cancel_rx).await;
        mock.assert_async().await;

        // With biased; in select!, cancel fires before the first chunk — verified deterministic
        assert!(
            result.is_ok(),
            "cancelled returns Ok(()) — cancel path emits model:create-error instead"
        );
    }

    #[test]
    fn test_build_payload_quoted_stop_param() {
        let modelfile = "FROM llama3\nPARAMETER stop \"<|im_end|>\"\n";
        let payload = build_create_payload("m", modelfile);
        assert_eq!(payload["parameters"]["stop"], "<|im_end|>");
    }

    #[test]
    fn test_build_payload_duplicate_stop_params() {
        let modelfile =
            "FROM llama3\nPARAMETER stop \"<|im_end|>\"\nPARAMETER stop \"<|eot_id|>\"\n";
        let payload = build_create_payload("m", modelfile);
        assert!(payload["parameters"]["stop"].is_array());
        let arr = payload["parameters"]["stop"].as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0], "<|im_end|>");
        assert_eq!(arr[1], "<|eot_id|>");
    }
}
