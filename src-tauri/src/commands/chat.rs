use crate::db::{conversations, messages, spawn_db};
use crate::error::AppError;
use crate::ollama::types::ChatOptions;
use crate::state::AppState;
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_dialog::DialogExt;

use base64::{engine::general_purpose, Engine as _};

#[tauri::command]
pub async fn get_messages(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<messages::Message>, AppError> {
    spawn_db(state.db.clone(), move |conn| {
        messages::list_for_conversation(conn, &conversation_id)
    })
    .await
}

const MAX_TITLE_LEN: usize = 500;
const MAX_SYSTEM_PROMPT_LEN: usize = 32_000;

#[tauri::command]
pub async fn create_conversation(
    state: State<'_, AppState>,
    model: String,
    title: Option<String>,
    system_prompt: Option<String>,
) -> Result<conversations::Conversation, AppError> {
    if let Some(ref t) = title {
        if t.len() > MAX_TITLE_LEN {
            return Err(AppError::Internal(format!(
                "Title too long: {} chars (max {})",
                t.len(),
                MAX_TITLE_LEN
            )));
        }
    }
    if let Some(ref sp) = system_prompt {
        if sp.len() > MAX_SYSTEM_PROMPT_LEN {
            return Err(AppError::Internal(format!(
                "System prompt too long: {} chars (max {})",
                sp.len(),
                MAX_SYSTEM_PROMPT_LEN
            )));
        }
    }
    spawn_db(state.db.clone(), move |conn| {
        let conv = conversations::create(
            conn,
            conversations::NewConversation {
                title: title.unwrap_or_else(|| "New Chat".to_string()),
                model,
                settings_json: None,
                tags: None,
            },
        )?;

        if let Some(prompt) = system_prompt {
            if !prompt.is_empty() {
                conversations::update_system_prompt(conn, &conv.id, &prompt)?;
            }
        }
        Ok(conv)
    })
    .await
}

#[tauri::command]
pub async fn list_conversations(
    state: State<'_, AppState>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<conversations::Conversation>, AppError> {
    let l = limit.unwrap_or(20);
    let o = offset.unwrap_or(0);
    spawn_db(state.db.clone(), move |conn| {
        conversations::list(conn, l, o)
    })
    .await
}

#[tauri::command]
pub async fn delete_conversation(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<(), AppError> {
    spawn_db(state.db.clone(), move |conn| {
        conversations::delete(conn, &conversation_id)
    })
    .await
}

#[tauri::command]
pub async fn update_chat_draft(
    state: State<'_, AppState>,
    conversation_id: String,
    draft_json: Option<String>,
) -> Result<(), AppError> {
    spawn_db(state.db.clone(), move |conn| {
        conversations::update_draft(conn, &conversation_id, draft_json.as_deref())
    })
    .await
}

#[tauri::command]
pub async fn update_conversation_title(
    state: State<'_, AppState>,
    conversation_id: String,
    title: String,
) -> Result<(), AppError> {
    if title.len() > MAX_TITLE_LEN {
        return Err(AppError::Internal(format!(
            "Title too long: {} chars (max {})",
            title.len(),
            MAX_TITLE_LEN
        )));
    }
    spawn_db(state.db.clone(), move |conn| {
        conversations::update_title(conn, &conversation_id, &title)
    })
    .await
}

#[tauri::command]
pub async fn update_conversation_model(
    state: State<'_, AppState>,
    conversation_id: String,
    model: String,
) -> Result<(), AppError> {
    spawn_db(state.db.clone(), move |conn| {
        conversations::update_model(conn, &conversation_id, &model)
    })
    .await
}

#[tauri::command]
pub async fn update_conversation_settings(
    state: State<'_, AppState>,
    conversation_id: String,
    settings: ChatOptions,
) -> Result<(), AppError> {
    super::model_settings::validate_chat_options(&settings)?;
    let json = serde_json::to_string(&settings)?;
    spawn_db(state.db.clone(), move |conn| {
        conversations::update_settings(conn, &conversation_id, &json)
    })
    .await
}

#[tauri::command]
pub async fn set_conversation_pinned(
    state: State<'_, AppState>,
    conversation_id: String,
    pinned: bool,
) -> Result<(), AppError> {
    spawn_db(state.db.clone(), move |conn| {
        conversations::set_pinned(conn, &conversation_id, pinned)
    })
    .await
}

#[tauri::command]
pub async fn update_system_prompt(
    state: State<'_, AppState>,
    conversation_id: String,
    system_prompt: String,
) -> Result<(), AppError> {
    if system_prompt.len() > MAX_SYSTEM_PROMPT_LEN {
        return Err(AppError::Internal(format!(
            "System prompt too long: {} chars (max {})",
            system_prompt.len(),
            MAX_SYSTEM_PROMPT_LEN
        )));
    }
    spawn_db(state.db.clone(), move |conn| {
        conversations::update_system_prompt(conn, &conversation_id, &system_prompt)
    })
    .await
}

const MAX_IMAGE_SIZE_BYTES: usize = 20 * 1024 * 1024; // 20 MB per image
const MAX_IMAGES: usize = 10;

#[allow(clippy::too_many_arguments)] // Tauri IPC commands cannot be split; args are the wire interface
#[tauri::command]
pub async fn send_message<R: Runtime>(
    state: State<'_, AppState>,
    app: AppHandle<R>,
    conversation_id: String,
    content: String,
    images: Option<Vec<Vec<u8>>>,
    model: String,
    folder_context: Option<String>,
    web_search_enabled: Option<bool>,
    // "true"/"false" for binary-think models; "low"/"medium"/"high" for GPT-OSS
    think_mode: Option<String>,
    chat_options: Option<ChatOptions>,
) -> Result<(), AppError> {
    // Validate image bounds
    if let Some(ref imgs) = images {
        if imgs.len() > MAX_IMAGES {
            return Err(AppError::Internal(format!(
                "Too many images: {} (max {})",
                imgs.len(),
                MAX_IMAGES
            )));
        }
        for img in imgs {
            if img.len() > MAX_IMAGE_SIZE_BYTES {
                return Err(AppError::Internal(format!(
                    "Image too large: {} bytes (max {} MB)",
                    img.len(),
                    MAX_IMAGE_SIZE_BYTES / 1_048_576
                )));
            }
        }
    }

    let base64_images = images.map(|imgs| {
        imgs.into_iter()
            .map(|bytes| general_purpose::STANDARD.encode(bytes))
            .collect::<Vec<String>>()
    });

    let service = crate::services::chat::ChatService::new(app, &state);
    service
        .send(crate::services::chat::SendParams {
            conversation_id,
            original_content: content.clone(),
            content,
            base64_images,
            model,
            folder_context,
            web_search_enabled: web_search_enabled.unwrap_or(false),
            think_mode,
            chat_options,
        })
        .await
}

#[tauri::command]
pub async fn stop_generation(state: State<'_, AppState>) -> Result<(), AppError> {
    if let Some(tx) = state
        .cancel_tx
        .lock()
        .map_err(|_| AppError::Internal("Cancel lock poisoned".into()))?
        .take()
    {
        let _ = tx.send(());
    }
    Ok(())
}

#[tauri::command]
pub async fn export_conversation<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<(), AppError> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("JSON", &["json"])
        .save_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    let default_path = rx.await.map_err(|e| AppError::Internal(e.to_string()))?;

    if let Some(file_path) = default_path {
        let path = file_path
            .into_path()
            .map_err(|e| AppError::Io(e.to_string()))?;
        spawn_db(state.db.clone(), move |conn| {
            conversations::export_to_path(conn, &conversation_id, &path)
        })
        .await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn backup_database<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<Option<String>, AppError> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let now = chrono::Local::now();
    let filename = format!(
        "{}_alpaka-desktop-backup.db",
        now.format("%Y-%m-%d_%H-%M-%S")
    );

    app.dialog()
        .file()
        .add_filter("SQLite Database", &["db", "sqlite3"])
        .set_file_name(&filename)
        .save_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    let default_path = rx.await.map_err(|e| AppError::Internal(e.to_string()))?;

    if let Some(file_path) = default_path {
        let backup_path = file_path
            .into_path()
            .map_err(|e| AppError::Io(e.to_string()))?;
        let db_path = state.db_path.clone();
        let app_handle = app.clone();
        let backup_path_str = backup_path.display().to_string();

        tokio::task::spawn_blocking(move || {
            let res = crate::db::backup_to_path(&db_path, &backup_path);
            match res {
                Ok(_) => {
                    crate::system::notifications::notify_backup_success(
                        &app_handle,
                        &backup_path.display().to_string(),
                    );
                }
                Err(ref e) => {
                    crate::system::notifications::notify_db_operation_failed(
                        &app_handle,
                        "backup database",
                        &e.to_string(),
                    );
                }
            }
            res
        })
        .await??;

        return Ok(Some(backup_path_str));
    }
    Ok(None)
}

#[tauri::command]
pub async fn restore_database<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("SQLite Database", &["db", "sqlite3"])
        .pick_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    let default_path = rx.await.map_err(|e| AppError::Internal(e.to_string()))?;

    if let Some(file_path) = default_path {
        let backup_path = file_path
            .into_path()
            .map_err(|e| AppError::Io(e.to_string()))?;
        let db_path = state.db_path.clone();
        let db_conn = state.db.clone();
        let app_handle = app.clone();

        tokio::task::spawn_blocking(move || {
            let res = crate::db::restore_from_path(db_conn, &db_path, &backup_path);
            match res {
                Ok(_) => {
                    crate::system::notifications::notify_restore_success(&app_handle);
                }
                Err(ref e) => {
                    crate::system::notifications::notify_db_operation_failed(
                        &app_handle,
                        "restore database",
                        &e.to_string(),
                    );
                }
            }
            res
        })
        .await??;
    }
    Ok(())
}

#[tauri::command]
pub async fn compact_conversation<R: Runtime>(
    state: State<'_, AppState>,
    app: AppHandle<R>,
    conversation_id: String,
    model: String,
    title: Option<String>,
) -> Result<String, AppError> {
    let service = crate::services::chat::ChatService::new(app, &state);
    service
        .compact(crate::services::chat::CompactParams {
            conversation_id,
            model,
            title,
        })
        .await
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn regenerate_message<R: Runtime>(
    conversation_id: String,
    parent_message_id: String,
    model: String,
    think_mode: Option<String>,
    chat_options: Option<ChatOptions>,
    web_search_enabled: bool,
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let service = crate::services::chat::ChatService::new(app, &state);
    service
        .send_regenerate(crate::services::chat::RegenerateParams {
            conversation_id,
            parent_message_id,
            model,
            think_mode,
            chat_options,
            web_search_enabled,
        })
        .await
}

#[tauri::command]
pub async fn switch_version(
    sibling_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if sibling_id.is_empty() {
        return Err(AppError::Internal("sibling_id must not be empty".into()));
    }
    spawn_db(state.db.clone(), move |conn| {
        messages::set_active_sibling(conn, &sibling_id)
    })
    .await
}

#[tauri::command]
pub async fn truncate_from(message_id: String, state: State<'_, AppState>) -> Result<(), AppError> {
    if message_id.is_empty() {
        return Err(AppError::Internal("message_id must not be empty".into()));
    }
    spawn_db(state.db.clone(), move |conn| {
        messages::truncate_after(conn, &message_id)
    })
    .await
}

#[cfg(test)]
#[path = "chat.tests.rs"]
mod tests;
