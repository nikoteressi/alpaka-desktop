use crate::error::AppError;
use crate::state::AppState;
use tauri::{command, State};

#[command]
pub async fn report_active_view(
    state: State<'_, AppState>,
    is_chat_view: bool,
    conversation_id: Option<String>,
) -> Result<(), AppError> {
    *state
        .is_chat_view
        .lock()
        .map_err(|_| AppError::Internal("is_chat_view lock poisoned".into()))? = is_chat_view;
    *state
        .active_conversation_id
        .lock()
        .map_err(|_| AppError::Internal("active_conversation_id lock poisoned".into()))? =
        conversation_id;
    Ok(())
}

#[command]
pub async fn open_browser(app: tauri::AppHandle, url: String) -> Result<(), AppError> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}
