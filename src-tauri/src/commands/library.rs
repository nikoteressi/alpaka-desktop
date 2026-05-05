use crate::error::AppError;
use crate::services::library::{LibraryModel, LibraryTag};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn search_ollama_library(
    state: State<'_, AppState>,
    query: String,
    filter: Option<String>,
) -> Result<Vec<LibraryModel>, AppError> {
    let client = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    crate::services::library::search(&client, &query, filter.as_deref()).await
}

#[tauri::command]
pub async fn get_library_tags(
    state: State<'_, AppState>,
    slug: String,
) -> Result<Vec<LibraryTag>, AppError> {
    let client = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    crate::services::library::get_tags(&client, &slug).await
}

#[tauri::command]
pub async fn get_library_model_readme(
    state: State<'_, AppState>,
    slug: String,
) -> Result<crate::services::library::LibraryModelDetails, AppError> {
    let client = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    crate::services::library::get_readme(&client, &slug).await
}

#[tauri::command]
pub async fn get_user_models(
    state: State<'_, AppState>,
    username: String,
) -> Result<Vec<LibraryModel>, AppError> {
    if username.is_empty() {
        return Ok(Vec::new());
    }
    let client = state
        .http_client
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let query = format!("{}/", username);
    crate::services::library::search(&client, &query, None).await
}
