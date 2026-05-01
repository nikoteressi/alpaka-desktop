use tauri::command;

use crate::db::model_user_data::ModelUserDataRow;
use crate::error::AppError;
use crate::state::AppState;
use tauri::State;

#[command]
pub async fn toggle_model_favorite(
    state: State<'_, AppState>,
    name: String,
) -> Result<bool, AppError> {
    crate::db::model_user_data::toggle_favorite_async(state.db.clone(), name).await
}

#[command]
pub async fn set_model_tags(
    state: State<'_, AppState>,
    name: String,
    tags: Vec<String>,
) -> Result<(), AppError> {
    crate::db::model_user_data::set_tags_async(state.db.clone(), name, tags).await
}

#[command]
pub async fn list_model_user_data(
    state: State<'_, AppState>,
) -> Result<Vec<ModelUserDataRow>, AppError> {
    crate::db::model_user_data::list_all_async(state.db.clone()).await
}
