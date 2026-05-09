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
        if let Err(e) = app.emit(
            "chat:error",
            json!({
                "conversation_id": conversation_id,
                "error": err_msg
            }),
        ) {
            log::warn!("Failed to emit chat:error: {} — continuing", e);
        }
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
                if let Err(e) = app.emit("chat:cancelled", serde_json::json!({
                    "conversation_id": conversation_id,
                })) {
                    log::warn!("Failed to emit chat:cancelled: {} — continuing", e);
                }
                return Err(AppError::Cancelled);
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
                                            // Mode A: Ollama provides thinking in a separate field
                                            if !in_think_block {
                                                in_think_block = true;
                                                think_start = Some(std::time::Instant::now());
                                                if let Err(e) = app.emit("chat:thinking-start", json!({ "conversation_id": conversation_id })) {
                                                    log::warn!("Failed to emit chat:thinking-start: {} — continuing stream", e);
                                                }
                                            }
                                            thinking_assembled.push_str(thinking_token);
                                            if let Err(e) = app.emit("chat:thinking-token", json!({
                                                "conversation_id": conversation_id,
                                                "content": thinking_token,
                                                "prompt_tokens": data.prompt_eval_count,
                                                "eval_tokens": data.eval_count,
                                            })) {
                                                log::warn!("Failed to emit chat:thinking-token: {} — continuing stream", e);
                                            }
                                        } else if !content_token.is_empty() {
                                            // Close Mode A think block when we receive content after thinking
                                            if in_think_block && thinking_token.is_empty() {
                                                in_think_block = false;
                                                let duration_ms = think_start
                                                    .take()
                                                    .map(|s| s.elapsed().as_millis() as u64)
                                                    .unwrap_or(0);
                                                if let Err(e) = app.emit("chat:thinking-end", json!({
                                                    "conversation_id": conversation_id,
                                                    "duration_ms": duration_ms,
                                                })) {
                                                    log::warn!("Failed to emit chat:thinking-end: {} — continuing stream", e);
                                                }
                                            }

                                            // Mode B: embedded <think> tags in content tokens.
                                            // Route content to thinking_assembled while inside a think block.
                                            if in_think_block {
                                                if let Some(close_pos) = content_token.find("</think>") {
                                                    // Block closes in this token
                                                    let inner = &content_token[..close_pos];
                                                    if !inner.is_empty() {
                                                        thinking_assembled.push_str(inner);
                                                        if let Err(e) = app.emit("chat:thinking-token", json!({
                                                            "conversation_id": conversation_id,
                                                            "content": inner,
                                                        })) {
                                                            log::warn!("Failed to emit chat:thinking-token: {} — continuing stream", e);
                                                        }
                                                    }
                                                    in_think_block = false;
                                                    let duration_ms = think_start
                                                        .take()
                                                        .map(|s| s.elapsed().as_millis() as u64)
                                                        .unwrap_or(0);
                                                    if let Err(e) = app.emit("chat:thinking-end", json!({
                                                        "conversation_id": conversation_id,
                                                        "duration_ms": duration_ms,
                                                    })) {
                                                        log::warn!("Failed to emit chat:thinking-end: {} — continuing stream", e);
                                                    }
                                                    let after = &content_token[close_pos + "</think>".len()..];
                                                    if !after.is_empty() {
                                                        assembled.push_str(after);
                                                        if let Err(e) = app.emit("chat:token", json!({
                                                            "conversation_id": conversation_id,
                                                            "content": after,
                                                            "done": data.done,
                                                            "prompt_tokens": data.prompt_eval_count,
                                                            "eval_tokens": data.eval_count,
                                                        })) {
                                                            log::warn!("Failed to emit chat:token: {} — continuing stream", e);
                                                        }
                                                    }
                                                } else {
                                                    thinking_assembled.push_str(content_token);
                                                    if let Err(e) = app.emit("chat:thinking-token", json!({
                                                        "conversation_id": conversation_id,
                                                        "content": content_token,
                                                    })) {
                                                        log::warn!("Failed to emit chat:thinking-token: {} — continuing stream", e);
                                                    }
                                                }
                                            } else if let Some(open_pos) = content_token.find("<think>") {
                                                // Mode B: think block opens in this token
                                                let before = &content_token[..open_pos];
                                                if !before.is_empty() {
                                                    assembled.push_str(before);
                                                    if let Err(e) = app.emit("chat:token", json!({
                                                        "conversation_id": conversation_id,
                                                        "content": before,
                                                        "done": false,
                                                        "prompt_tokens": data.prompt_eval_count,
                                                        "eval_tokens": data.eval_count,
                                                    })) {
                                                        log::warn!("Failed to emit chat:token: {} — continuing stream", e);
                                                    }
                                                }
                                                in_think_block = true;
                                                think_start = Some(std::time::Instant::now());
                                                if let Err(e) = app.emit("chat:thinking-start", json!({ "conversation_id": conversation_id })) {
                                                    log::warn!("Failed to emit chat:thinking-start: {} — continuing stream", e);
                                                }
                                                let after_open = &content_token[open_pos + "<think>".len()..];
                                                if let Some(close_pos) = after_open.find("</think>") {
                                                    // Opens and closes in same token
                                                    let inner = &after_open[..close_pos];
                                                    thinking_assembled.push_str(inner);
                                                    if !inner.is_empty() {
                                                        if let Err(e) = app.emit("chat:thinking-token", json!({
                                                            "conversation_id": conversation_id,
                                                            "content": inner,
                                                        })) {
                                                            log::warn!("Failed to emit chat:thinking-token: {} — continuing stream", e);
                                                        }
                                                    }
                                                    in_think_block = false;
                                                    let duration_ms = think_start
                                                        .take()
                                                        .map(|s| s.elapsed().as_millis() as u64)
                                                        .unwrap_or(0);
                                                    if let Err(e) = app.emit("chat:thinking-end", json!({
                                                        "conversation_id": conversation_id,
                                                        "duration_ms": duration_ms,
                                                    })) {
                                                        log::warn!("Failed to emit chat:thinking-end: {} — continuing stream", e);
                                                    }
                                                    let rest = &after_open[close_pos + "</think>".len()..];
                                                    if !rest.is_empty() {
                                                        assembled.push_str(rest);
                                                        if let Err(e) = app.emit("chat:token", json!({
                                                            "conversation_id": conversation_id,
                                                            "content": rest,
                                                            "done": data.done,
                                                            "prompt_tokens": data.prompt_eval_count,
                                                            "eval_tokens": data.eval_count,
                                                        })) {
                                                            log::warn!("Failed to emit chat:token: {} — continuing stream", e);
                                                        }
                                                    }
                                                } else if !after_open.is_empty() {
                                                    thinking_assembled.push_str(after_open);
                                                    if let Err(e) = app.emit("chat:thinking-token", json!({
                                                        "conversation_id": conversation_id,
                                                        "content": after_open,
                                                    })) {
                                                        log::warn!("Failed to emit chat:thinking-token: {} — continuing stream", e);
                                                    }
                                                }
                                            } else {
                                                // Plain content token
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
                                            }
                                        }

                                        if let Some(mut tc) = data.message.tool_calls {
                                            log::info!("Detected tool calls in stream: {:?}", tc);
                                            collected_tool_calls.append(&mut tc);
                                        }

                                        if data.done {
                                            // Close any unclosed think block (edge case: stream ended mid-think)
                                            if in_think_block {
                                                in_think_block = false;
                                                let duration_ms = think_start
                                                    .take()
                                                    .map(|s| s.elapsed().as_millis() as u64)
                                                    .unwrap_or(0);
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
                                                if let Err(emit_err) = app.emit("chat:error", json!({
                                                    "conversation_id": conversation_id,
                                                    "error": err_msg
                                                })) {
                                                    log::warn!("Failed to emit chat:error: {} — continuing", emit_err);
                                                }
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
                        if let Err(emit_err) = app.emit("chat:error", json!({
                            "conversation_id": conversation_id,
                            "error": e.to_string()
                        })) {
                            log::warn!("Failed to emit chat:error: {} — continuing stream", emit_err);
                        }
                        return Err(AppError::Http(e.to_string()));
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
}

#[cfg(test)]
mod tests {
    #[test]
    fn mode_b_open_close_same_token() {
        let token = "<think>text</think>answer";
        let mut assembled = String::new();
        let mut thinking = String::new();

        if let Some(open) = token.find("<think>") {
            let before = &token[..open];
            assembled.push_str(before);
            let after_open = &token[open + "<think>".len()..];
            if let Some(close) = after_open.find("</think>") {
                thinking.push_str(&after_open[..close]);
                let rest = &after_open[close + "</think>".len()..];
                assembled.push_str(rest);
            }
        }

        assert_eq!(assembled, "answer");
        assert_eq!(thinking, "text");
        assert!(!assembled.contains("<think>"));
        assert!(!assembled.contains("</think>"));
    }

    #[test]
    fn mode_b_split_across_tokens() {
        let token1 = "<think>inner";
        let token2 = "</think>answer";
        let mut assembled = String::new();
        let mut thinking = String::new();
        let mut in_think_block = false;

        // Token 1: opens think block
        if let Some(open) = token1.find("<think>") {
            assembled.push_str(&token1[..open]);
            in_think_block = true;
            let after = &token1[open + "<think>".len()..];
            thinking.push_str(after);
        }

        // Token 2: closes think block
        if in_think_block {
            if let Some(close) = token2.find("</think>") {
                thinking.push_str(&token2[..close]);
                in_think_block = false;
                let after = &token2[close + "</think>".len()..];
                assembled.push_str(after);
            }
        }

        assert!(!in_think_block);
        assert_eq!(assembled, "answer");
        assert_eq!(thinking, "inner");
        assert!(!assembled.contains("<think>"));
    }

    #[test]
    fn mode_a_thinking_not_in_assembled() {
        let mut assembled = String::new();
        let mut thinking_assembled = String::new();
        let thinking_token = "I am thinking";

        // Mode A: only goes to thinking_assembled
        thinking_assembled.push_str(thinking_token);
        // assembled is NOT touched

        assert!(assembled.is_empty());
        assert_eq!(thinking_assembled, "I am thinking");
    }
}
