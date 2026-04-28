use crate::db::messages::Message;
use crate::error::AppError;
use crate::ollama::types::Message as OllamaMessage;
use chrono::Local;
use std::collections::HashMap;

/// A service for building and managing LLM prompts.
pub struct PromptService;

/// Configuration options for building a prompt.
pub struct BuildPromptOptions {
    pub folder_context: Option<String>,
    pub web_search_enabled: bool,
}

impl PromptService {
    /// Constructs the full list of messages to be sent to the LLM.
    ///
    /// This includes:
    /// - Global system prompt from settings.
    /// - Dynamic folder context (if provided).
    /// - Date and web search instructions (if enabled).
    /// - Formatting instructions.
    /// - Full conversation history from the database.
    pub fn build_messages(
        history: Vec<Message>,
        settings: HashMap<String, String>,
        options: BuildPromptOptions,
    ) -> Result<Vec<OllamaMessage>, AppError> {
        let global_prompt = settings
            .get("globalSystemPrompt")
            .map(|s| s.as_str())
            .unwrap_or("");
        let formatting_enabled = settings
            .get("systemFormattingEnabled")
            .map(|s| s == "true")
            .unwrap_or(false);
        let formatting_template = settings
            .get("systemFormattingTemplate")
            .map(|s| s.as_str())
            .unwrap_or("");
        let search_template = settings
            .get("systemSearchTemplate")
            .map(|s| s.as_str())
            .unwrap_or("");
        let folder_template = settings
            .get("systemFolderTemplate")
            .map(|s| s.as_str())
            .unwrap_or("");

        let mut messages = Vec::new();

        // 0. Global System Prompt
        if !global_prompt.is_empty() {
            messages.push(OllamaMessage {
                role: "system".to_string(),
                content: global_prompt.to_string(),
                images: None,
                thinking: None,
                tool_calls: None,
                name: None,
            });
        }

        // 1. Dynamic folder context
        if let Some(ctx) = options.folder_context {
            let content = if !folder_template.is_empty() {
                folder_template.replace("{context}", &ctx)
            } else {
                // Fallback if template is somehow empty but feature is used
                format!("<context_background>\n{}\n</context_background>", ctx)
            };
            messages.push(OllamaMessage {
                role: "system".to_string(),
                content,
                images: None,
                thinking: None,
                tool_calls: None,
                name: None,
            });
        }

        // 2. Dynamic date & web search instructions
        if options.web_search_enabled {
            let now = Local::now();
            let date_str = now.format("%B %d, %Y").to_string();
            let content = if !search_template.is_empty() {
                search_template.replace("{date}", &date_str)
            } else {
                // Fallback
                format!("Current date is {}. Web search is active.", date_str)
            };
            messages.push(OllamaMessage {
                role: "system".to_string(),
                content,
                images: None,
                thinking: None,
                tool_calls: None,
                name: None,
            });
        }

        // 3. Formatting instructions
        if formatting_enabled && !formatting_template.is_empty() {
            messages.push(OllamaMessage {
                role: "system".to_string(),
                content: formatting_template.to_string(),
                images: None,
                thinking: None,
                tool_calls: None,
                name: None,
            });
        }

        // 4. Message history
        for msg in history {
            let msg_imgs: Option<Vec<String>> =
                if msg.images_json != "[]" && !msg.images_json.is_empty() {
                    serde_json::from_str(&msg.images_json).map_err(|e| {
                        AppError::Serialization(format!("Failed to parse image JSON: {}", e))
                    })?
                } else {
                    None
                };
            messages.push(OllamaMessage {
                role: msg.role.as_str().to_string(),
                content: msg.content,
                images: msg_imgs,
                thinking: None,
                tool_calls: None,
                name: None,
            });
        }

        Ok(messages)
    }
}
