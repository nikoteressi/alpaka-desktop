use crate::error::AppError;
use crate::ollama::client::OllamaClient;
use crate::ollama::types::{ChatRequest, StreamResponse};
use futures_util::StreamExt;
use serde_json::json;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::broadcast;

/// The result returned by `stream_chat` after the stream finishes.
pub struct StreamResult {
    pub content: String,
    pub thinking: Option<String>,
    pub tokens_used: Option<i64>,
    pub generation_time_ms: Option<i64>,
    pub prompt_tokens: Option<i64>,
    pub tokens_per_sec: Option<f64>,
    pub total_duration_ms: Option<i64>,
    pub load_duration_ms: Option<i64>,
    pub prompt_eval_duration_ms: Option<i64>,
    pub eval_duration_ms: Option<i64>,
    pub tool_calls: Option<Vec<crate::ollama::types::ToolCall>>,
}

/// Streams a single chat request.
///
/// Emits the following Tauri events to the frontend:
/// - `chat:thinking-start` — emitted once when a thinking block begins
/// - `chat:thinking-token` — emitted for each token inside a thinking block (Mode A only)
/// - `chat:thinking-end`   — emitted once when a thinking block ends, with `duration_ms`
/// - `chat:token`          — emitted for each final-answer token
/// - `chat:done`           — emitted when the stream completes, with performance counters
/// - `chat:error`          — emitted on stream or parse errors
pub async fn stream_chat<R: Runtime>(
    app: &AppHandle<R>,
    client: &OllamaClient,
    request: ChatRequest,
    conversation_id: &str,
    mut cancel_rx: broadcast::Receiver<()>,
) -> Result<StreamResult, AppError> {
    stream_once(app, client, &request, conversation_id, &mut cancel_rx).await
}

async fn stream_once<R: Runtime>(
    app: &AppHandle<R>,
    client: &OllamaClient,
    request: &ChatRequest,
    conversation_id: &str,
    cancel_rx: &mut broadcast::Receiver<()>,
) -> Result<StreamResult, AppError> {
    let response = client.post("/api/chat").json(&request).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        let err_msg = if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
            val.get("error")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or(format!("Error {}", status))
        } else {
            format!("Error {}: {}", status, body)
        };

        log::error!("Ollama API returned error: {}", err_msg);
        let _ = app.emit(
            "chat:error",
            json!({
                "conversation_id": conversation_id,
                "error": err_msg
            }),
        );
        return Err(AppError::Http(err_msg));
    }

    let mut stream = response.bytes_stream();
    let mut in_think_block = false;
    let mut buffer = String::new();
    let mut assembled = String::new();
    let mut thinking_assembled = String::new();
    let mut think_start: Option<std::time::Instant> = None;
    let mut collected_tool_calls: Vec<crate::ollama::types::ToolCall> = Vec::new();

    loop {
        tokio::select! {
            _ = cancel_rx.recv() => {
                break;
            }
            chunk_res = stream.next() => {
                match chunk_res {
                    Some(Ok(bytes)) => {
                        {
                            // from_utf8_lossy avoids dropping the entire chunk when a
                            // multi-byte sequence is cut by a network boundary (the
                            // previous from_utf8 silently discarded the whole chunk on
                            // any invalid byte, breaking line-framing for subsequent
                            // tokens). Replacement characters in a split codepoint are
                            // a minor visual artefact; losing all framing bytes is not.
                            let text = String::from_utf8_lossy(&bytes);
                            buffer.push_str(&text);

                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer[..pos].trim().to_string();
                                buffer.drain(..=pos);

                                if line.is_empty() {
                                    continue;
                                }

                                log::debug!("Raw Ollama chunk: {}", line);
                                match serde_json::from_str::<StreamResponse>(&line) {
                                    Ok(data) => {
                                        let thinking_token = data.message.thinking.as_deref().unwrap_or("");
                                        let content_token = data.message.content.as_str();

                                        if !thinking_token.is_empty() {
                                            // Mode A: separate thinking field (modern Ollama v0.5+ API)
                                            if !in_think_block {
                                                in_think_block = true;
                                                think_start = Some(std::time::Instant::now());
                                                assembled.push_str("<think>");
                                                if let Err(e) = app.emit("chat:thinking-start", json!({ "conversation_id": conversation_id })) {
                                                    log::warn!("Failed to emit chat:thinking-start: {} — continuing stream", e);
                                                }
                                            }
                                            thinking_assembled.push_str(thinking_token);
                                            assembled.push_str(thinking_token); // CRITICAL: must add to main content too!
                                            if let Err(e) = app.emit("chat:thinking-token", json!({
                                                "conversation_id": conversation_id,
                                                "content": thinking_token,
                                                "prompt_tokens": data.prompt_eval_count,
                                                "eval_tokens": data.eval_count,
                                            })) {
                                                log::warn!("Failed to emit chat:thinking-token: {} — continuing stream", e);
                                            }
                                        } else if !content_token.is_empty() {
                                            // Close think block when switching from thinking to content (Mode A)
                                            if in_think_block && !content_token.contains("</think>") {
                                                in_think_block = false;
                                                let duration_ms = think_start.take()
                                                    .map(|s| s.elapsed().as_millis() as u64)
                                                    .unwrap_or(0);

                                                // Inject time into the opening tag retrospectively
                                                let time_secs = (duration_ms as f64) / 1000.0;
                                                assembled = assembled.replacen("<think>", &format!("<think time={:.1}>", time_secs), 1);

                                                assembled.push_str("</think>\n\n");
                                                if let Err(e) = app.emit("chat:thinking-end", json!({
                                                    "conversation_id": conversation_id,
                                                    "duration_ms": duration_ms,
                                                })) {
                                                    log::warn!("Failed to emit chat:thinking-end: {} — continuing stream", e);
                                                }
                                            }

                                            // Mode B fallback: embedded <think> tags in content
                                            if content_token.contains("<think>") && !in_think_block {
                                                in_think_block = true;
                                                think_start = Some(std::time::Instant::now());
                                                if let Err(e) = app.emit("chat:thinking-start", json!({ "conversation_id": conversation_id })) {
                                                    log::warn!("Failed to emit chat:thinking-start: {} — continuing stream", e);
                                                }
                                            }

                                            assembled.push_str(content_token);
                                            if let Err(e) = app.emit("chat:token", json!({
                                                "conversation_id": conversation_id,
                                                "content": content_token,
                                                "done": data.done,
                                                "prompt_tokens": data.prompt_eval_count,
                                                "eval_tokens": data.eval_count,
                                            })) {
                                                log::warn!("Failed to emit chat:token: {} — continuing stream", e);
                                            }

                                            if content_token.contains("</think>") && in_think_block {
                                                in_think_block = false;
                                                let duration_ms = think_start.take()
                                                    .map(|s| s.elapsed().as_millis() as u64)
                                                    .unwrap_or(0);
                                                if let Err(e) = app.emit("chat:thinking-end", json!({
                                                    "conversation_id": conversation_id,
                                                    "duration_ms": duration_ms,
                                                })) {
                                                    log::warn!("Failed to emit chat:thinking-end: {} — continuing stream", e);
                                                }
                                            }
                                        }

                                        if let Some(mut tc) = data.message.tool_calls {
                                            log::info!("Detected tool calls in stream: {:?}", tc);
                                            collected_tool_calls.append(&mut tc);
                                        }

                                        if data.done {
                                            // Close any unclosed think block (edge case: stream ended mid-think)
                                            if in_think_block {
                                                let duration_ms = think_start.take()
                                                    .map(|s| s.elapsed().as_millis() as u64)
                                                    .unwrap_or(0);

                                                let time_secs = (duration_ms as f64) / 1000.0;
                                                assembled = assembled.replacen("<think>", &format!("<think time={:.1}>", time_secs), 1);
                                                assembled.push_str("</think>\n\n");

                                                if let Err(e) = app.emit("chat:thinking-end", json!({
                                                    "conversation_id": conversation_id,
                                                    "duration_ms": duration_ms,
                                                })) {
                                                    log::warn!("Failed to emit chat:thinking-end: {} — continuing stream", e);
                                                }
                                            }

                                            let eval_count = data.eval_count.unwrap_or(0);
                                            let prompt_eval_count = data.prompt_eval_count.unwrap_or(0);
                                            let total_duration = data.total_duration.unwrap_or(0);
                                            let load_duration = data.load_duration.unwrap_or(0);
                                            let prompt_eval_duration = data.prompt_eval_duration.unwrap_or(0);
                                            let eval_duration = data.eval_duration.unwrap_or(0);

                                            let duration_ms = total_duration / 1_000_000;
                                            let tps = if eval_duration > 0 {
                                                (eval_count as f64) / (eval_duration as f64 / 1_000_000_000.0)
                                            } else {
                                                0.0
                                            };

                                            return Ok(StreamResult {
                                                content: assembled,
                                                thinking: if thinking_assembled.is_empty() { None } else { Some(thinking_assembled) },
                                                tokens_used: Some(eval_count as i64),
                                                generation_time_ms: Some(duration_ms as i64),
                                                prompt_tokens: Some(prompt_eval_count as i64),
                                                tokens_per_sec: Some(tps),
                                                total_duration_ms: Some((total_duration / 1_000_000) as i64),
                                                load_duration_ms: Some((load_duration / 1_000_000) as i64),
                                                prompt_eval_duration_ms: Some((prompt_eval_duration / 1_000_000) as i64),
                                                eval_duration_ms: Some((eval_duration / 1_000_000) as i64),
                                                tool_calls: if collected_tool_calls.is_empty() { None } else { Some(collected_tool_calls) }
                                            });
                                        }
                                    }
                                    Err(e) => {
                                        // Check for an Ollama API-level error object first
                                        if let Ok(err_val) = serde_json::from_str::<serde_json::Value>(&line) {
                                            if let Some(err_msg) = err_val.get("error").and_then(|v| v.as_str()) {
                                                log::warn!("Ollama returned an error: {}", err_msg);
                                                let _ = app.emit("chat:error", json!({
                                                    "conversation_id": conversation_id,
                                                    "error": err_msg
                                                }));
                                                return Err(AppError::Http(err_msg.to_string()));
                                            }
                                        }

                                        // Heuristic: looks like a truncated (incomplete) JSON chunk —
                                        // re-buffer and wait for the next network chunk to complete it.
                                        let trimmed = line.trim_end();
                                        if trimmed.ends_with('{') || trimmed.ends_with('[')
                                            || trimmed.ends_with('"') || trimmed.ends_with(',')
                                        {
                                            log::debug!("Looks like truncated NDJSON, re-buffering: {}...", &line[..line.len().min(80)]);
                                            buffer = format!("{}\n{}", line, buffer);
                                            break;
                                        }

                                        log::warn!("Malformed NDJSON (skipping): {}... — {}", &line[..line.len().min(80)], e);
                                    }
                                }
                            }
                        }
                    }
                    Some(Err(e)) => {
                        log::warn!(
                            "Stream network error after {} chars accumulated: {}",
                            assembled.len(),
                            e
                        );
                        // If any content was already streamed to the frontend, emit
                        // chat:done first so the frontend can persist the partial
                        // response. Without this, the UI stays in "streaming" state
                        // indefinitely even though the user already saw the tokens.
                        if !assembled.is_empty() {
                            let _ = app.emit("chat:done", json!({
                                "conversation_id": conversation_id,
                                "total_tokens": 0,
                                "duration_ms": 0,
                                "tokens_per_sec": 0.0
                            }));
                        }
                        if let Err(emit_err) = app.emit("chat:error", json!({
                            "conversation_id": conversation_id,
                            "error": e.to_string()
                        })) {
                            log::warn!("Failed to emit chat:error: {} — continuing stream", emit_err);
                        }
                        break;
                    }
                    None => {
                        if assembled.is_empty() {
                            return Err(AppError::Http("Stream closed without any content or done signal".into()));
                        }
                        return Err(AppError::Http("Stream closed without done signal".into()));
                    }
                }
            }
        }
    }

    Ok(StreamResult {
        content: assembled,
        thinking: if thinking_assembled.is_empty() {
            None
        } else {
            Some(thinking_assembled)
        },
        tokens_used: None,
        generation_time_ms: None,
        prompt_tokens: None,
        tokens_per_sec: None,
        total_duration_ms: None,
        load_duration_ms: None,
        prompt_eval_duration_ms: None,
        eval_duration_ms: None,
        tool_calls: None,
    })
}
