use std::path::Path;
use std::time::Duration;

use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use tauri::{AppHandle, Emitter, Runtime};

use crate::commands::folders::{guard_path, read_folder_context, CHARS_PER_TOKEN};
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
        guard_path(path)?;

        let app = app.clone();
        let ctx_id = context_id.to_owned();

        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            move |result: DebounceEventResult| {
                if let Err(err) = result {
                    log::warn!("Watcher error for context {ctx_id}: {err}");
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
        (total / CHARS_PER_TOKEN) as i64
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::folders::{add_folder_context, NewFolderContext};
    use std::sync::{mpsc, Arc, Mutex};
    use tauri::Listener;

    #[test]
    fn file_change_triggers_folder_refreshed_event() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.txt"), "x".repeat(400)).unwrap();

        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        crate::db::migrations::run(&conn).unwrap();
        conn.execute("INSERT INTO conversations (id) VALUES ('c')", [])
            .unwrap();
        let ctx = add_folder_context(
            &conn,
            NewFolderContext {
                conversation_id: "c".into(),
                path: dir.path().to_string_lossy().into_owned(),
                included_files_json: None,
                auto_refresh: true,
                estimated_tokens: 0,
            },
        )
        .unwrap();
        let db: DbConn = Arc::new(Mutex::new(conn));

        let app = tauri::test::mock_app();
        let (tx, rx) = mpsc::channel::<String>();
        app.listen("folder:refreshed", move |event| {
            let _ = tx.send(event.payload().to_owned());
        });

        let _watcher = FolderWatcher::start(app.handle(), &ctx.id, dir.path(), db).unwrap();
        std::fs::write(dir.path().join("b.txt"), "y".repeat(800)).unwrap();

        let payload = rx
            .recv_timeout(Duration::from_secs(10))
            .expect("watcher should emit folder:refreshed after a file change");
        let value: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(value["context_id"], ctx.id.as_str());
        assert!(value["token_estimate"].as_i64().unwrap() > 0);
    }
}
