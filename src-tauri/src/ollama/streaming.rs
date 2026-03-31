use crate::error::AppError;
use crate::ollama::types::{ChatRequest, StreamResponse};
use futures_util::StreamExt;
use crate::ollama::client::OllamaClient;
use serde_json::json;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::broadcast;

pub async fn stream_chat<R: Runtime>(
    app: &AppHandle<R>,
    client: &OllamaClient,
    request: ChatRequest,
    conversation_id: &str,
    mut cancel_rx: broadcast::Receiver<()>,
) -> Result<(), AppError> {
    let response = client.post("/api/chat")
        .json(&request)
        .send()
        .await?;
        
    let mut stream = response.bytes_stream();
    let mut in_think_block = false;
    let mut buffer = String::new();

    loop {
        tokio::select! {
            _ = cancel_rx.recv() => {
                break;
            }
            chunk_res = stream.next() => {
                match chunk_res {
                    Some(Ok(bytes)) => {
                        if let Ok(text) = std::str::from_utf8(&bytes) {
                            buffer.push_str(text);
                            
                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer[..pos].to_string();
                                buffer.drain(..=pos);
                                let line = line.trim();
                                if line.is_empty() {
                                    continue;
                                }

                                match serde_json::from_str::<StreamResponse>(line) {
                                    Ok(data) => {
                                        let had_think_start = data.message.content.contains("<think>");
                                        let had_think_end = data.message.content.contains("</think>");

                                        if had_think_start && !in_think_block {
                                            in_think_block = true;
                                            app.emit("chat:thinking-start", json!({ "conversation_id": conversation_id }))
                                                .map_err(|e| AppError::Internal(e.to_string()))?;
                                        }

                                        app.emit("chat:token", json!({
                                            "conversation_id": conversation_id,
                                            "content": data.message.content,
                                            "done": data.done,
                                        })).map_err(|e| AppError::Internal(e.to_string()))?;

                                        if had_think_end && in_think_block {
                                            in_think_block = false;
                                            app.emit("chat:thinking-end", json!({ "conversation_id": conversation_id }))
                                                .map_err(|e| AppError::Internal(e.to_string()))?;
                                        }

                                        if data.done {
                                            let eval_count = data.eval_count.unwrap_or(0);
                                            let eval_duration = data.eval_duration.unwrap_or(1);
                                            let total_duration = data.total_duration.unwrap_or(0);

                                            let duration_ms = total_duration / 1_000_000;
                                            let tokens_per_sec = if eval_duration > 0 {
                                                eval_count as f64 / (eval_duration as f64 / 1_000_000_000.0)
                                            } else {
                                                0.0
                                            };

                                            app.emit("chat:done", json!({
                                                "conversation_id": conversation_id,
                                                "total_tokens": eval_count,
                                                "duration_ms": duration_ms,
                                                "tokens_per_sec": tokens_per_sec,
                                            })).map_err(|e| AppError::Internal(e.to_string()))?;
                                            
                                            // Optional: Drain any remaining buffer just in case
                                            return Ok(());
                                        }
                                    }
                                    Err(e) => {
                                        log::warn!("Failed to parse stream JSON chunk: {} from {}", e, line);
                                    }
                                }
                            }
                        }
                    }
                    Some(Err(e)) => {
                        app.emit("chat:error", json!({
                            "conversation_id": conversation_id,
                            "error": e.to_string()
                        })).map_err(|err| AppError::Internal(err.to_string()))?;
                        break;
                    }
                    None => break,
                }
            }
        }
    }
    
    Ok(())
}
