use tauri::{command, State};

use crate::db;
use crate::error::AppError;
use crate::ollama::types::ChatOptions;
use crate::state::AppState;

#[command]
pub async fn get_model_defaults(
    state: State<'_, AppState>,
    model_name: String,
) -> Result<Option<ChatOptions>, AppError> {
    db::model_settings::get_async(state.db.clone(), model_name).await
}

#[command]
pub async fn set_model_defaults(
    state: State<'_, AppState>,
    model_name: String,
    defaults: ChatOptions,
) -> Result<(), AppError> {
    validate_chat_options(&defaults)?;
    db::model_settings::set_async(state.db.clone(), model_name, defaults).await
}

#[command]
pub async fn reset_model_defaults(
    state: State<'_, AppState>,
    model_name: String,
) -> Result<(), AppError> {
    db::model_settings::delete_async(state.db.clone(), model_name).await
}

pub(crate) fn validate_chat_options(opts: &ChatOptions) -> Result<(), AppError> {
    if let Some(t) = opts.temperature {
        if !(0.0..=2.0).contains(&t) {
            return Err(AppError::Validation(
                "temperature must be in [0.0, 2.0]".into(),
            ));
        }
    }
    if let Some(p) = opts.top_p {
        if !(0.0..=1.0).contains(&p) {
            return Err(AppError::Validation("top_p must be in [0.0, 1.0]".into()));
        }
    }
    if let Some(k) = opts.top_k {
        if !(0..=500).contains(&k) {
            return Err(AppError::Validation("top_k must be in [0, 500]".into()));
        }
    }
    if let Some(ctx) = opts.num_ctx {
        if !(256..=131072).contains(&ctx) {
            return Err(AppError::Validation(
                "num_ctx must be in [256, 131072]".into(),
            ));
        }
    }
    if let Some(rp) = opts.repeat_penalty {
        if !(0.0..=2.0).contains(&rp) {
            return Err(AppError::Validation(
                "repeat_penalty must be in [0.0, 2.0]".into(),
            ));
        }
    }
    if let Some(rn) = opts.repeat_last_n {
        if !(0..=512).contains(&rn) {
            return Err(AppError::Validation(
                "repeat_last_n must be in [0, 512]".into(),
            ));
        }
    }
    if let Some(np) = opts.num_predict {
        // -1 is the Ollama sentinel for "generate until stop token"; cap positive values
        if np != -1 && !(1..=32768).contains(&np) {
            return Err(AppError::Validation(
                "num_predict must be -1 (unlimited) or in [1, 32768]".into(),
            ));
        }
    }
    Ok(())
}
