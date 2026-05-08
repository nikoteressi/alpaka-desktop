use crate::db::{conversations, messages, spawn_db};
use crate::error::AppError;
use crate::ollama::client::OllamaClient;
use crate::ollama::types::{ChatOptions, ChatRequest, Message, StreamResponse};
use tauri::Runtime;

use super::{ChatService, CompactParams};

impl<'a, R: Runtime> ChatService<'a, R> {
    /// Compact a conversation: summarize it, create a new conversation with the summary
    /// as the system prompt, and copy the last 4 messages across.
    /// Returns the new conversation ID.
    pub async fn compact(&self, params: CompactParams) -> Result<String, AppError> {
        let CompactParams {
            conversation_id,
            model,
            title,
        } = params;

        if conversation_id.is_empty() {
            return Err(AppError::Internal(
                "conversation_id must not be empty".into(),
            ));
        }

        // 1. Load full conversation history and source title from DB
        let conv_id = conversation_id.clone();
        let (history, conv_title) = spawn_db(self.state.db.clone(), move |conn| {
            let msgs = messages::list_for_conversation(conn, &conv_id)?;
            let conv = conversations::get_by_id(conn, &conv_id)?;
            Ok((msgs, conv.title))
        })
        .await?;

        // 2. Build summarization prompt from user+assistant turns only
        let dialogue: String = history
            .iter()
            .filter(|m| {
                matches!(
                    m.role,
                    messages::MessageRole::User | messages::MessageRole::Assistant
                )
            })
            .map(|m| format!("{}: {}", m.role.as_str().to_uppercase(), m.content))
            .collect::<Vec<_>>()
            .join("\n\n");

        if dialogue.trim().is_empty() {
            return Err(AppError::Internal("No messages to compact".into()));
        }

        let summarization_prompt = format!(
            "Summarize the following conversation concisely but comprehensively. Preserve:\n\
            - Key decisions and conclusions\n\
            - Important facts, values, and names\n\
            - Code snippets or technical details (condensed)\n\
            - The current task or open question\n\
            Keep the summary under 600 words.\n\n\
            CONVERSATION:\n{dialogue}"
        );

        // 3. Call Ollama non-streaming for summary
        let http = self
            .state
            .http_client
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let client = OllamaClient::from_state(http, self.state.db.clone()).await?;
        let req = ChatRequest {
            model: model.clone(),
            messages: vec![Message {
                role: "user".to_string(),
                content: summarization_prompt,
                images: None,
                thinking: None,
                tool_calls: None,
                name: None,
            }],
            stream: false,
            think: None,
            tools: None,
            options: Some(ChatOptions {
                temperature: Some(0.3),
                ..Default::default()
            }),
        };

        let resp = client.post("/api/chat").json(&req).send().await?;

        if !resp.status().is_success() {
            return Err(AppError::Http(format!("Ollama returned {}", resp.status())));
        }

        let chat_resp = resp.json::<StreamResponse>().await?;

        let summary = chat_resp.message.content;
        if summary.trim().is_empty() {
            return Err(AppError::Internal("Empty summary from model".into()));
        }

        // 4. Create new conversation with the chosen (or derived) title
        let new_title = title.unwrap_or_else(|| format!("Compact: {}", conv_title));
        let new_conv = spawn_db(self.state.db.clone(), move |conn| {
            conversations::create(
                conn,
                conversations::NewConversation {
                    title: new_title,
                    model,
                    settings_json: None,
                    tags: None,
                },
            )
        })
        .await?;

        // 5. Set summary as system message (context for the new conversation)
        let new_conv_id = new_conv.id.clone();
        let system_content = format!(
            "You are continuing a previous conversation. Here is a summary of what was discussed:\n\n\
            {summary}\n\nContinue from this context."
        );
        spawn_db(self.state.db.clone(), move |conn| {
            conversations::update_system_prompt(conn, &new_conv_id, &system_content)
        })
        .await?;

        // 6. Copy last 4 user+assistant messages from the old conversation
        let tail: Vec<_> = history
            .iter()
            .filter(|m| {
                matches!(
                    m.role,
                    messages::MessageRole::User | messages::MessageRole::Assistant
                )
            })
            .rev()
            .take(4)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .cloned()
            .collect();

        let new_conv_id_for_msgs = new_conv.id.clone();
        spawn_db(self.state.db.clone(), move |conn| {
            for msg in tail {
                messages::create(
                    conn,
                    messages::NewMessage {
                        conversation_id: new_conv_id_for_msgs.clone(),
                        role: msg.role.clone(),
                        content: msg.content.clone(),
                        images_json: Some(msg.images_json.clone()),
                        files_json: None,
                        tokens_used: msg.tokens_used,
                        generation_time_ms: msg.generation_time_ms,
                        // Clear prompt_tokens so the new conversation's context bar starts
                        // at zero rather than inheriting the old conversation's cumulative count.
                        prompt_tokens: None,
                        tokens_per_sec: msg.tokens_per_sec,
                        total_duration_ms: msg.total_duration_ms,
                        load_duration_ms: msg.load_duration_ms,
                        prompt_eval_duration_ms: msg.prompt_eval_duration_ms,
                        eval_duration_ms: msg.eval_duration_ms,
                        seed: msg.seed,
                    },
                )?;
            }
            Ok(())
        })
        .await?;

        Ok(new_conv.id)
    }
}
