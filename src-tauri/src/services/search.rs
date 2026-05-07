use crate::db::DbConn;
use crate::error::AppError;
use crate::ollama::client::OllamaClient;
use crate::ollama::search;
use crate::ollama::types::{Message, ToolCall};
use serde_json::json;
use tauri::{AppHandle, Emitter, Runtime};

/// A service for handling web search tool calls.
pub struct WebSearchService<R: Runtime> {
    app: AppHandle<R>,
    db: DbConn,
}

impl<R: Runtime> WebSearchService<R> {
    pub fn new(app: AppHandle<R>, db: DbConn) -> Self {
        Self { app, db }
    }

    /// Executes the tool calls provided by the LLM.
    ///
    /// Currently only supports `web_search`.
    /// Emits `chat:tool-call` and `chat:tool-result` events for each tool call.
    pub async fn handle_tool_calls(
        &self,
        conversation_id: &str,
        tool_calls: Vec<ToolCall>,
        client: &OllamaClient,
    ) -> Result<(Vec<Message>, bool, Vec<(ToolCall, String)>), AppError> {
        self.handle_tool_calls_inner(conversation_id, tool_calls, client, None)
            .await
    }

    /// Like `handle_tool_calls`, but also injects the original user question into the
    /// tool-result message so the LLM is steered to answer it directly.
    pub async fn handle_tool_calls_with_context(
        &self,
        conversation_id: &str,
        tool_calls: Vec<ToolCall>,
        client: &OllamaClient,
        original_user_content: &str,
    ) -> Result<(Vec<Message>, bool, Vec<(ToolCall, String)>), AppError> {
        self.handle_tool_calls_inner(
            conversation_id,
            tool_calls,
            client,
            Some(original_user_content),
        )
        .await
    }

    async fn handle_tool_calls_inner(
        &self,
        conversation_id: &str,
        tool_calls: Vec<ToolCall>,
        client: &OllamaClient,
        original_user_content: Option<&str>,
    ) -> Result<(Vec<Message>, bool, Vec<(ToolCall, String)>), AppError> {
        let mut tool_responses = Vec::new();
        let mut tool_results = Vec::new();
        let mut any_tool_succeeded = false;

        for tc in tool_calls {
            if tc.function.name == "web_search" {
                let query = tc
                    .function
                    .arguments
                    .get("query")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                // Notify frontend that we are about to call a tool
                let _ = self.app.emit(
                    "chat:tool-call",
                    json!({
                        "conversation_id": conversation_id,
                        "tool_name": "web_search",
                        "query": query,
                    }),
                );

                let search_result_text =
                    match search::execute_web_search(query, &client.http, &self.db).await {
                        Ok(data) => {
                            any_tool_succeeded = true;
                            data
                        }
                        // Wrap error in JSON to avoid malformed output if error contains quotes
                        Err(e) => json!({"error": e.to_string()}).to_string(),
                    };

                // Notify frontend of the results
                let _ = self.app.emit(
                    "chat:tool-result",
                    json!({
                        "conversation_id": conversation_id,
                        "tool_name": "web_search",
                        "query": query,
                        "result": search_result_text,
                    }),
                );

                // Parse results for UI preview/reading state
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&search_result_text) {
                    let results = if let Some(arr) = parsed.get("results").and_then(|r| r.as_array()) {
                        arr.clone()
                    } else if let Some(arr) = parsed.as_array() {
                        arr.clone()
                    } else {
                        Vec::new()
                    };

                    let _ = self.app.emit(
                        "chat:tool-reading",
                        json!({
                            "conversation_id": conversation_id,
                            "results_preview": results,
                        }),
                    );
                }

                tool_results.push((tc.clone(), search_result_text.clone()));

                let cleaned_result = search::format_search_results_for_llm(&search_result_text);

                // When the original user question is available, add a steering prompt so the
                // LLM is directed to answer it directly rather than summarising generically.
                let tool_content = if let Some(user_q) = original_user_content {
                    format!(
                        "Web search results for '{}':\n\n{}\n\nUse these results to concisely answer the user's original question: \"{}\"",
                        query, cleaned_result, user_q
                    )
                } else {
                    cleaned_result
                };

                tool_responses.push(Message {
                    role: "tool".to_string(),
                    content: tool_content,
                    images: None,
                    thinking: None,
                    tool_calls: None,
                    name: Some("web_search".to_string()),
                });
            }
        }

        Ok((tool_responses, any_tool_succeeded, tool_results))
    }
}
