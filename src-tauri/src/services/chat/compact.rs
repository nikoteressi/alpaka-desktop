use futures_util::StreamExt;
use serde_json::json;
use tauri::{Emitter, Runtime};

use crate::db::{compaction_events, messages, spawn_db};
use crate::error::AppError;
use crate::ollama::client::OllamaClient;
use crate::ollama::types::{ChatOptions, ChatRequest, Message, StreamResponse};

use super::{ChatService, CompactParams};

impl<'a, R: Runtime> ChatService<'a, R> {
    pub async fn compact_in_place(&self, params: CompactParams) -> Result<String, AppError> {
        let CompactParams {
            conversation_id,
            model,
        } = params;

        if conversation_id.is_empty() {
            return Err(AppError::Internal(
                "conversation_id must not be empty".into(),
            ));
        }

        // 1. Load all non-archived messages
        let conv_id = conversation_id.clone();
        let history = spawn_db(self.state.db.clone(), move |conn| {
            messages::list_for_conversation(conn, &conv_id)
        })
        .await?;

        // 2. Build dialogue from user+assistant turns (plus prior compact summary for re-compaction)
        let dialogue: String = history
            .iter()
            .filter(|m| {
                matches!(
                    m.role,
                    messages::MessageRole::User
                        | messages::MessageRole::Assistant
                        | messages::MessageRole::CompactSummary
                )
            })
            .map(|m| {
                let label = match m.role {
                    messages::MessageRole::CompactSummary => "PREVIOUS SUMMARY".to_string(),
                    _ => m.role.as_str().to_uppercase(),
                };
                format!("{label}: {}", m.content)
            })
            .collect::<Vec<_>>()
            .join("\n\n");

        if dialogue.trim().is_empty() {
            return Err(AppError::Internal("No messages to compact".into()));
        }

        let archived_count = history
            .iter()
            .filter(|m| {
                matches!(
                    m.role,
                    messages::MessageRole::User | messages::MessageRole::Assistant
                )
            })
            .count();

        let prompt = format!(
            "Summarize the following conversation. Preserve exactly:\n\
            - All decisions made and their rationale\n\
            - Key facts, values, names, file paths, and identifiers\n\
            - Code snippets and technical details (condense but keep precise)\n\
            - Any open questions or the current task in progress\n\
            - The user's goals and preferences revealed in the conversation\n\n\
            Be concise. Do not add commentary. Output only the summary.\n\n\
            CONVERSATION:\n{dialogue}"
        );

        // 3. Set up cancel channel
        let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();
        match self.state.compact_cancel_tx.lock() {
            Ok(mut lock) => *lock = Some(cancel_tx),
            Err(_) => return Err(AppError::Internal("Compact cancel lock poisoned".into())),
        }

        // 4. Stream Ollama for summary
        let http = self
            .state
            .http_client
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let client = match OllamaClient::from_state(http, self.state.db.clone()).await {
            Ok(c) => c,
            Err(e) => {
                if let Ok(mut lock) = self.state.compact_cancel_tx.lock() {
                    *lock = None;
                }
                return Err(e);
            }
        };

        let req = ChatRequest {
            model: model.clone(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt,
                images: None,
                thinking: None,
                tool_calls: None,
                name: None,
            }],
            stream: true,
            think: None,
            tools: None,
            options: Some(ChatOptions {
                temperature: Some(0.3),
                ..Default::default()
            }),
        };

        let resp = match client.post("/api/chat").json(&req).send().await {
            Ok(r) => r,
            Err(e) => {
                if let Ok(mut lock) = self.state.compact_cancel_tx.lock() {
                    *lock = None;
                }
                return Err(AppError::Http(e.to_string()));
            }
        };

        if !resp.status().is_success() {
            if let Ok(mut lock) = self.state.compact_cancel_tx.lock() {
                *lock = None;
            }
            let msg = format!("Ollama returned {}", resp.status());
            let _ = self.app.emit(
                "compact:error",
                json!({ "conversation_id": &conversation_id, "error": &msg }),
            );
            return Err(AppError::Http(msg));
        }

        // 5. Stream response, emit compact:token per chunk
        let mut stream = resp.bytes_stream();
        let mut buf = String::new();
        let mut summary = String::new();
        let mut cancelled = false;

        'stream: loop {
            tokio::select! {
                _ = &mut cancel_rx => {
                    cancelled = true;
                    break 'stream;
                }
                chunk = stream.next() => {
                    match chunk {
                        Some(Ok(bytes)) => {
                            buf.push_str(&String::from_utf8_lossy(&bytes));
                            while let Some(pos) = buf.find('\n') {
                                let line = buf[..pos].trim().to_string();
                                buf.drain(..=pos);
                                if line.is_empty() {
                                    continue;
                                }
                                if let Ok(data) = serde_json::from_str::<StreamResponse>(&line) {
                                    let token = data.message.content.as_str();
                                    if !token.is_empty() {
                                        summary.push_str(token);
                                        let _ = self.app.emit(
                                            "compact:token",
                                            json!({
                                                "conversation_id": &conversation_id,
                                                "content": token
                                            }),
                                        );
                                    }
                                    if data.done {
                                        break 'stream;
                                    }
                                }
                            }
                        }
                        Some(Err(e)) => {
                            if let Ok(mut lock) = self.state.compact_cancel_tx.lock() {
                                *lock = None;
                            }
                            let msg = e.to_string();
                            let _ = self.app.emit(
                                "compact:error",
                                json!({ "conversation_id": &conversation_id, "error": &msg }),
                            );
                            return Err(AppError::Http(msg));
                        }
                        None => break 'stream,
                    }
                }
            }
        }

        if let Ok(mut lock) = self.state.compact_cancel_tx.lock() {
            *lock = None;
        }

        if cancelled {
            let _ = self.app.emit(
                "compact:error",
                json!({
                    "conversation_id": &conversation_id,
                    "error": "cancelled"
                }),
            );
            return Err(AppError::Internal("Compaction cancelled".into()));
        }

        if summary.trim().is_empty() {
            let _ = self.app.emit(
                "compact:error",
                json!({ "conversation_id": &conversation_id, "error": "Empty summary from model" }),
            );
            return Err(AppError::Internal("Empty summary from model".into()));
        }

        // 6. DB writes: archive messages, record event, insert summary message
        let conv_id2 = conversation_id.clone();
        let summary_content = summary.clone();
        spawn_db(self.state.db.clone(), move |conn| {
            let tx = conn.unchecked_transaction()?;
            messages::archive_all_for_conversation(&tx, &conv_id2)?;
            compaction_events::create(&tx, &conv_id2, archived_count)?;
            messages::create(
                &tx,
                messages::NewMessage {
                    conversation_id: conv_id2.clone(),
                    role: messages::MessageRole::CompactSummary,
                    content: summary_content,
                    parent_id: None,
                    sibling_order: 0,
                    is_active: true,
                    images_json: None,
                    files_json: None,
                    tokens_used: None,
                    generation_time_ms: None,
                    prompt_tokens: None,
                    tokens_per_sec: None,
                    total_duration_ms: None,
                    load_duration_ms: None,
                    prompt_eval_duration_ms: None,
                    eval_duration_ms: None,
                    seed: None,
                },
            )?;
            tx.commit()?;
            Ok(())
        })
        .await
        .inspect_err(|e| {
            let _ = self.app.emit(
                "compact:error",
                json!({
                    "conversation_id": &conversation_id,
                    "error": e.to_string()
                }),
            );
        })?;

        // 7. Emit done event and desktop notification
        let _ = self.app.emit(
            "compact:done",
            json!({ "conversation_id": &conversation_id }),
        );
        crate::system::notifications::send_notification(
            &self.app,
            "Alpaka",
            "Conversation compacted",
            Some(&conversation_id),
        );

        Ok(conversation_id)
    }
}
