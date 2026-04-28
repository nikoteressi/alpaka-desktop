use crate::db::{conversations, messages, settings, DbConn};
use crate::error::AppError;
use std::collections::HashMap;

/// A repository that encapsulates high-level database workflows for conversations.
///
/// This simplifies command handlers by providing atomic methods for common
/// chat operations, like preparing a session or saving the final response.
pub struct ConversationRepository {
    db: DbConn,
}

impl ConversationRepository {
    pub fn new(db: DbConn) -> Self {
        Self { db }
    }

    /// Prepares the database for a new message exchange.
    ///
    /// This is performed in a single transaction to ensure atomicity:
    /// 1. Inserts the new user message.
    /// 2. Updates the `updated_at` timestamp for the conversation.
    /// 3. Fetches the full message history, conversation details, and app settings.
    pub async fn prepare_session(
        &self,
        conversation_id: String,
        content: String,
        images_json: Option<String>,
    ) -> Result<
        (
            Vec<messages::Message>,
            conversations::Conversation,
            HashMap<String, String>,
        ),
        AppError,
    > {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            let mut conn = db
                .lock()
                .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
            let tx = conn.transaction().map_err(AppError::from)?;

            let new_user_msg = messages::NewMessage {
                conversation_id: conversation_id.clone(),
                role: messages::MessageRole::User,
                content,
                images_json,
                files_json: None,
                tokens_used: None,
                generation_time_ms: None,
                prompt_tokens: None,
                tokens_per_sec: None,
                total_duration_ms: None,
                load_duration_ms: None,
                prompt_eval_duration_ms: None,
                eval_duration_ms: None,
            };

            messages::create(&tx, new_user_msg)?;
            conversations::touch_updated_at(&tx, &conversation_id)?;

            let conv = conversations::get_by_id(&tx, &conversation_id)?;
            let history = messages::list_for_conversation(&tx, &conversation_id)?;
            let settings = settings::get_all(&tx)?;

            tx.commit().map_err(AppError::from)?;

            Ok((history, conv, settings))
        })
        .await?
    }

    /// Saves the assistant's final response message to the database.
    pub async fn save_assistant_message(
        &self,
        conversation_id: String,
        content: String,
        metrics: AssistantMetrics,
    ) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            let conn = db
                .lock()
                .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
            messages::create(
                &conn,
                messages::NewMessage {
                    conversation_id,
                    role: messages::MessageRole::Assistant,
                    content,
                    images_json: None,
                    files_json: None,
                    tokens_used: metrics.tokens_used,
                    generation_time_ms: metrics.generation_time_ms,
                    prompt_tokens: metrics.prompt_tokens,
                    tokens_per_sec: metrics.tokens_per_sec,
                    total_duration_ms: metrics.total_duration_ms,
                    load_duration_ms: metrics.load_duration_ms,
                    prompt_eval_duration_ms: metrics.prompt_eval_duration_ms,
                    eval_duration_ms: metrics.eval_duration_ms,
                },
            )?;
            Ok(())
        })
        .await?
    }
}

/// Performance and usage metrics for an assistant response.
#[derive(Default)]
pub struct AssistantMetrics {
    pub tokens_used: Option<i64>,
    pub generation_time_ms: Option<i64>,
    pub prompt_tokens: Option<i64>,
    pub tokens_per_sec: Option<f64>,
    pub total_duration_ms: Option<i64>,
    pub load_duration_ms: Option<i64>,
    pub prompt_eval_duration_ms: Option<i64>,
    pub eval_duration_ms: Option<i64>,
}
