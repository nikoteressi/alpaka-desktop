use crate::error::AppError;
use crate::state::AppState;
use tauri::{Runtime, State};

#[tauri::command]
pub async fn get_models_with_updates(
    state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    let cache = state
        .models_with_updates
        .read()
        .unwrap_or_else(|e| e.into_inner());
    Ok(cache.clone())
}

#[tauri::command]
pub async fn check_model_updates<R: Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<(), AppError> {
    tauri::async_runtime::spawn(async move {
        crate::services::model_updates::do_update_check(&app).await;
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::migrations;
    use crate::state::AppState;
    use rusqlite::Connection;
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};

    fn setup_state() -> AppState {
        let conn = Connection::open_in_memory().unwrap();
        migrations::run(&conn).unwrap();
        let db = Arc::new(Mutex::new(conn));
        AppState::new(db, PathBuf::from("/tmp/test_model_updates.db")).unwrap()
    }

    #[test]
    fn get_models_with_updates_returns_cached_list() {
        let state = setup_state();
        {
            let mut cache = state.models_with_updates.write().unwrap();
            *cache = vec!["llama3:8b".to_string(), "mistral".to_string()];
        }
        let result = state
            .models_with_updates
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        assert_eq!(result, vec!["llama3:8b", "mistral"]);
    }

    #[test]
    fn get_models_with_updates_empty_by_default() {
        let state = setup_state();
        let result = state
            .models_with_updates
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        assert!(result.is_empty());
    }
}
