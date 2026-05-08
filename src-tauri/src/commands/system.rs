use crate::db::folders::get_auto_refresh_contexts;
use crate::error::AppError;
use crate::folder_watcher::FolderWatcher;
use crate::state::AppState;
use tauri::{command, State};

#[command]
pub async fn report_active_view(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    is_chat_view: bool,
    conversation_id: Option<String>,
) -> Result<(), AppError> {
    *state
        .is_chat_view
        .write()
        .map_err(|_| AppError::Internal("is_chat_view lock poisoned".into()))? = is_chat_view;
    *state
        .active_conversation_id
        .write()
        .map_err(|_| AppError::Internal("active_conversation_id lock poisoned".into()))? =
        conversation_id.clone();

    {
        let mut watchers = state
            .folder_watchers
            .lock()
            .map_err(|_| AppError::Internal("folder_watchers lock poisoned".into()))?;
        watchers.clear();
    }

    if let Some(ref conv_id) = conversation_id {
        let contexts = {
            let conn = state
                .db
                .lock()
                .map_err(|_| AppError::Internal("db lock poisoned".into()))?;
            get_auto_refresh_contexts(&conn, conv_id)?
        };
        let mut watchers = state
            .folder_watchers
            .lock()
            .map_err(|_| AppError::Internal("folder_watchers lock poisoned".into()))?;
        for ctx in contexts {
            match FolderWatcher::start(
                &app,
                &ctx.id,
                std::path::Path::new(&ctx.path),
                state.db.clone(),
            ) {
                Ok(watcher) => {
                    watchers.insert(ctx.id, watcher);
                }
                Err(e) => {
                    log::warn!("Failed to start watcher for context {}: {e}", ctx.id);
                }
            }
        }
    }

    Ok(())
}

#[command]
pub async fn open_browser(app: tauri::AppHandle, url: String) -> Result<(), AppError> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(AppError::Internal(
            "only http/https URLs are permitted".into(),
        ));
    }
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}
