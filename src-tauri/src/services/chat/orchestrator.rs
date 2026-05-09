use crate::db::repo::AssistantMetrics;
use crate::error::AppError;
use crate::ollama::client::OllamaClient;
use crate::ollama::streaming;
use crate::ollama::types::{ChatOptions, ChatRequest, Message, ThinkParam, Tool};
use crate::services::search::WebSearchService;
use serde_json::json;
use tauri::{Emitter, Runtime};

use super::{ChatService, OrchestrationResult};

impl<'a, R: Runtime> ChatService<'a, R> {
    /// Orchestrates the chat generation process, including the agent loop for tools.
    ///
    /// This method manages:
    /// - Initialization of the Ollama client.
    /// - Setup of cancellation tokens.
    /// - The multi-turn agent loop (max 5 iterations).
    /// - Gathering and aggregating performance metrics across all turns.
    /// - Emission of the final `chat:done` event.
    #[allow(clippy::too_many_arguments)]
    pub async fn orchestrate_stream(
        &self,
        conversation_id: String,
        initial_messages: Vec<Message>,
        model: String,
        think: Option<ThinkParam>,
        tools: Option<Vec<Tool>>,
        options: Option<ChatOptions>,
        initial_parent_id: String,
    ) -> Result<OrchestrationResult, AppError> {
        self.orchestrate_stream_with_context(
            conversation_id,
            initial_messages,
            model,
            think,
            tools,
            options,
            None,
            initial_parent_id,
        )
        .await
    }

    /// Like `orchestrate_stream`, but passes `original_user_content` into tool call handling
    /// so the LLM is steered to answer the user's original question after a web search.
    #[allow(clippy::too_many_arguments)] // all params are distinct concerns; a struct would obscure call sites
    pub(super) async fn orchestrate_stream_with_context(
        &self,
        conversation_id: String,
        initial_messages: Vec<Message>,
        model: String,
        think: Option<ThinkParam>,
        tools: Option<Vec<Tool>>,
        options: Option<ChatOptions>,
        original_user_content: Option<&str>,
        initial_parent_id: String,
    ) -> Result<OrchestrationResult, AppError> {
        let http = self
            .state
            .http_client
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let client = match OllamaClient::from_state(http, self.state.db.clone()).await {
            Ok(c) => c,
            Err(e) => {
                let _ = self.app.emit(
                    "chat:error",
                    serde_json::json!({
                        "conversation_id": conversation_id,
                        "error": e.to_string(),
                    }),
                );
                return Err(e);
            }
        };
        let search_service = WebSearchService::new(self.app.clone(), self.state.db.clone());

        // Setup cancellation token
        let (cancel_tx, _cancel_keep_alive) = tokio::sync::broadcast::channel(1);
        *self
            .state
            .cancel_tx
            .lock()
            .map_err(|_| AppError::Internal("Cancel lock poisoned".into()))? =
            Some(cancel_tx.clone());

        // Run the generation loop inside an async block so cancel_tx cleanup
        // happens unconditionally at a single site, regardless of how the loop exits
        // (normal completion, cancellation, tool-call error, or any `?` propagation).
        let generation_result: Result<OrchestrationResult, AppError> = async {
            let mut current_messages = initial_messages;
            let mut final_content = String::new();
            let mut final_thinking: Option<String> = None;
            let mut current_parent_id = initial_parent_id.clone();
            let mut metrics = AssistantMetrics::default();

            let mut iteration = 0;
            loop {
                iteration += 1;
                if iteration > 5 {
                    log::warn!("Agent loop exceeded max iterations");
                    break;
                }

                let req = ChatRequest {
                    model: model.clone(),
                    messages: current_messages.clone(),
                    stream: true,
                    think: think.clone(),
                    tools: tools.clone(),
                    options: options.clone(),
                };

                let cancel_rx = cancel_tx.subscribe();
                let result = match streaming::stream_chat(
                    &self.app,
                    &client,
                    req,
                    &conversation_id,
                    cancel_rx,
                )
                .await
                {
                    Ok(r) => r,
                    Err(crate::error::AppError::Cancelled) => {
                        return Err(crate::error::AppError::Cancelled);
                    }
                    Err(e) => {
                        let err_msg = e.to_string();
                        crate::system::notifications::notify_generation_failed(
                            &self.app,
                            &err_msg,
                            &conversation_id,
                        );
                        return Err(e);
                    }
                };

                // Aggregate metrics across all agent turns
                metrics.tokens_used =
                    Some(metrics.tokens_used.unwrap_or(0) + result.tokens_used.unwrap_or(0));

                if let Some(t) = result.generation_time_ms {
                    metrics.generation_time_ms = Some(metrics.generation_time_ms.unwrap_or(0) + t);
                }
                if let Some(pt) = result.prompt_tokens {
                    // Usually we take the prompt tokens from the last turn or the peak
                    metrics.prompt_tokens = Some(pt);
                }
                if let Some(tps) = result.tokens_per_sec {
                    // Using TPS from the last turn is generally indicative
                    metrics.tokens_per_sec = Some(tps);
                }
                if let Some(td) = result.total_duration_ms {
                    metrics.total_duration_ms = Some(metrics.total_duration_ms.unwrap_or(0) + td);
                }
                if let Some(ld) = result.load_duration_ms {
                    metrics.load_duration_ms = Some(metrics.load_duration_ms.unwrap_or(0) + ld);
                }
                if let Some(ped) = result.prompt_eval_duration_ms {
                    metrics.prompt_eval_duration_ms =
                        Some(metrics.prompt_eval_duration_ms.unwrap_or(0) + ped);
                }
                if let Some(ed) = result.eval_duration_ms {
                    metrics.eval_duration_ms = Some(metrics.eval_duration_ms.unwrap_or(0) + ed);
                }

                // Handle tool calls
                if let Some(tool_calls) = result.tool_calls {
                    // Persist the intermediate assistant message (tool dispatch) to DB
                    let tool_calls_json_str =
                        serde_json::to_string(&tool_calls).unwrap_or_else(|_| "[]".to_string());
                    let intermediate_content = result.content.clone();
                    let intermediate_thinking = result.thinking.clone();
                    let conv_id = conversation_id.clone();
                    let cur_parent = current_parent_id.clone();
                    let db_clone = self.state.db.clone();

                    let asst_tool_msg = crate::db::spawn_db(db_clone, move |conn| {
                        crate::db::messages::create(
                            conn,
                            crate::db::messages::NewMessage {
                                conversation_id: conv_id,
                                role: crate::db::messages::MessageRole::Assistant,
                                content: intermediate_content,
                                parent_id: Some(cur_parent),
                                tool_calls_json: Some(tool_calls_json_str),
                                thinking: intermediate_thinking,
                                sibling_order: 0,
                                is_active: true,
                                ..Default::default()
                            },
                        )
                    })
                    .await?;
                    current_parent_id = asst_tool_msg.id.clone();

                    // Add the assistant's response to the replay history
                    current_messages.push(Message {
                        role: "assistant".to_string(),
                        content: result.content.clone(),
                        images: None,
                        thinking: result.thinking.clone(),
                        tool_calls: Some(tool_calls.clone()),
                        name: None,
                    });

                    let (mut tool_responses, any_succeeded, tool_results) =
                        if let Some(user_content) = original_user_content {
                            search_service
                                .handle_tool_calls_with_context(
                                    &conversation_id,
                                    tool_calls,
                                    &client,
                                    user_content,
                                )
                                .await?
                        } else {
                            search_service
                                .handle_tool_calls(&conversation_id, tool_calls, &client)
                                .await?
                        };

                    // Persist each tool result as a role=tool DB message
                    for (tc, result_text) in &tool_results {
                        let tool_name = tc.function.name.clone();
                        let result_content = result_text.clone();
                        let conv_id2 = conversation_id.clone();
                        let parent_id = current_parent_id.clone();
                        let db_clone2 = self.state.db.clone();

                        let tool_msg = crate::db::spawn_db(db_clone2, move |conn| {
                            crate::db::messages::create(
                                conn,
                                crate::db::messages::NewMessage {
                                    conversation_id: conv_id2,
                                    role: crate::db::messages::MessageRole::Tool,
                                    content: result_content,
                                    parent_id: Some(parent_id),
                                    tool_name: Some(tool_name),
                                    sibling_order: 0,
                                    is_active: true,
                                    ..Default::default()
                                },
                            )
                        })
                        .await?;
                        current_parent_id = tool_msg.id.clone();
                    }

                    if !any_succeeded && !tool_responses.is_empty() {
                        log::warn!(
                            "All tool calls failed in agent iteration {}; aborting loop",
                            iteration
                        );
                        break;
                    }

                    if !tool_responses.is_empty() {
                        current_messages.append(&mut tool_responses);
                        continue;
                    } else {
                        break;
                    }
                } else {
                    // No tool calls — this is the final answer
                    final_content = result.content.clone();
                    final_thinking = result.thinking.clone();
                    break;
                }
            }

            metrics.seed = options.as_ref().and_then(|o| o.seed);

            // Emit final done event after all agent turns are complete
            let _ = self.app.emit(
                "chat:done",
                json!({
                    "conversation_id": conversation_id,
                    "total_tokens": metrics.tokens_used,
                    "duration_ms": metrics.generation_time_ms,
                    "prompt_tokens": metrics.prompt_tokens,
                    "tokens_per_sec": metrics.tokens_per_sec,
                    "total_duration_ms": metrics.total_duration_ms,
                    "load_duration_ms": metrics.load_duration_ms,
                    "prompt_eval_duration_ms": metrics.prompt_eval_duration_ms,
                    "eval_duration_ms": metrics.eval_duration_ms,
                    "seed": metrics.seed,
                }),
            );

            crate::system::notifications::notify_generation_complete(
                &self.app,
                &model,
                &conversation_id,
            );

            Ok(OrchestrationResult {
                content: final_content,
                thinking: final_thinking,
                metrics,
                last_parent_id: Some(current_parent_id),
            })
        }
        .await;

        // Unconditionally clear the stored sender so it doesn't outlive this generation.
        // Swallow a poisoned lock here to avoid masking the real generation error.
        if let Ok(mut guard) = self.state.cancel_tx.lock() {
            *guard = None;
        }

        generation_result
    }
}
