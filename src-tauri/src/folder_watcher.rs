use std::path::Path;
use std::time::Duration;

use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use tauri::{AppHandle, Emitter, Runtime};

use crate::commands::folders::{guard_path, read_folder_context};
use crate::db::folders::{get_folder_context, update_token_estimate};
use crate::db::DbConn;
use crate::error::AppError;

pub struct FolderWatcher {
    _debouncer: Debouncer<notify_debouncer_mini::notify::RecommendedWatcher>,
}

impl FolderWatcher {
    pub fn start<R: Runtime>(
        app: &AppHandle<R>,
        context_id: &str,
        path: &Path,
        db: DbConn,
    ) -> Result<Self, AppError> {
        let app = app.clone();
        let ctx_id = context_id.to_owned();

        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            None,
            move |result: DebounceEventResult| {
                if let Err(errors) = result {
                    log::warn!("Watcher errors for context {ctx_id}: {errors:?}");
                    return;
                }
                match reestimate_tokens(&db, &ctx_id) {
                    Ok(token_estimate) => {
                        let _ = app.emit(
                            "folder:refreshed",
                            serde_json::json!({
                                "context_id": ctx_id,
                                "token_estimate": token_estimate,
                            }),
                        );
                    }
                    Err(e) => {
                        log::warn!("Failed to re-estimate tokens for {ctx_id}: {e}");
                    }
                }
            },
        )
        .map_err(|e| AppError::Internal(format!("Failed to create watcher: {e}")))?;

        debouncer
            .watcher()
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| AppError::Internal(format!("Failed to watch path: {e}")))?;

        Ok(FolderWatcher {
            _debouncer: debouncer,
        })
    }
}

fn reestimate_tokens(db: &DbConn, context_id: &str) -> Result<i64, AppError> {
    let (path, included_files_json) = {
        let guard = db
            .lock()
            .map_err(|_| AppError::Db("lock poisoned".into()))?;
        let ctx = get_folder_context(&guard, context_id)?;
        (ctx.path, ctx.included_files_json)
    };

    let base_path = guard_path(Path::new(&path))?;

    let included: Vec<String> = match included_files_json.as_deref() {
        Some(s) => serde_json::from_str(s).unwrap_or_else(|e| {
            log::warn!("Failed to parse included_files_json for {context_id}: {e}");
            Vec::new()
        }),
        None => Vec::new(),
    };

    let token_estimate: i64 = if !included.is_empty() {
        let mut total = 0usize;
        for rel in &included {
            let full = base_path.join(rel);
            if full.is_symlink() {
                continue;
            }
            if let Ok(canonical) = dunce::canonicalize(&full) {
                if canonical.starts_with(&base_path) {
                    if let Ok(content) = std::fs::read_to_string(&canonical) {
                        total += content.chars().count();
                    }
                }
            }
        }
        (total / 4) as i64
    } else {
        read_folder_context(&base_path)
            .map(|p| p.token_estimate as i64)
            .unwrap_or_else(|e| {
                log::warn!("Failed to scan folder for context {context_id}: {e}");
                0
            })
    };

    {
        let guard = db
            .lock()
            .map_err(|_| AppError::Db("lock poisoned".into()))?;
        update_token_estimate(&guard, context_id, token_estimate)?;
    }

    Ok(token_estimate)
}
