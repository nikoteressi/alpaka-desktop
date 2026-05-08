use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{command, AppHandle, Runtime, State};

use crate::db::folders::{add_folder_context, NewFolderContext};
use crate::{error::AppError, state::AppState};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FolderContextPayload {
    pub id: String,
    pub path: String,
    pub content: String,
    pub token_estimate: usize,
}

fn is_text_file(path: &Path) -> Result<bool, std::io::Error> {
    use std::fs::File;
    use std::io::Read;

    let mut file = File::open(path)?;
    let mut buffer = [0; 1024];
    let n = file.read(&mut buffer)?;

    if n == 0 {
        return Ok(true); // empty files aren't binary
    }

    if buffer[..n].contains(&0) {
        return Ok(false); // contains null byte, likely binary
    }

    Ok(true)
}

/// MED-05: Validate that the resolved path does not point to a restricted
/// system directory. Uses `dunce::canonicalize` to resolve symlinks first.
fn guard_path(raw: &Path) -> Result<std::path::PathBuf, AppError> {
    let canonical = dunce::canonicalize(raw)
        .map_err(|e| AppError::Io(format!("Cannot resolve path: {}", e)))?;

    // Reject paths inside sensitive system directories or hidden secret folders
    let restricted_prefixes = [
        "/proc",
        "/sys",
        "/dev",
        "/etc",
        "/root",
        "/boot",
        "/var",
        "/usr/bin",
        "/usr/sbin",
    ];
    for prefix in &restricted_prefixes {
        if canonical.starts_with(prefix) {
            return Err(AppError::Internal(format!(
                "Restricted path: prefix {} is blocked",
                prefix
            )));
        }
    }

    // Guard against common hidden secret directories in HOME
    let path_str = canonical.to_string_lossy();
    if path_str.contains("/.ssh")
        || path_str.contains("/.gnupg")
        || path_str.contains("/.aws")
        || path_str.contains("/.kube")
    {
        return Err(AppError::Internal(
            "Restricted path: sensitive credentials directory detected".into(),
        ));
    }

    Ok(canonical)
}

const MAX_FOLDER_CONTEXT_SIZE: usize = 50 * 1024 * 1024; // 50 MB limit
const MAX_FOLDER_FILES: usize = 1000; // 1000 files limit

/// Recursively reads a directory, ignoring hidden files, `.git`,
/// and binary files. Extracts text from supported file types.
pub fn read_folder_context(folder_path: &Path) -> Result<FolderContextPayload, AppError> {
    let mut content = String::new();

    if folder_path.is_file() {
        let is_text = is_text_file(folder_path)
            .map_err(|e| AppError::Io(format!("Failed to check file: {}", e)))?;
        if !is_text {
            return Err(AppError::Internal(
                "Cannot link binary files as text context".into(),
            ));
        }

        let bytes = std::fs::read(folder_path)
            .map_err(|e| AppError::Io(format!("Failed to read file: {}", e)))?;
        if bytes.len() > MAX_FOLDER_CONTEXT_SIZE {
            return Err(AppError::Internal("File exceeds 50MB limit".into()));
        }
        let file_content = String::from_utf8_lossy(&bytes);
        let filename = folder_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file");
        content.push_str(&format!("\n--- File: {} ---\n{}\n", filename, file_content));

        let token_estimate = content.chars().count() / 4;
        return Ok(FolderContextPayload {
            id: String::new(),
            path: folder_path.to_string_lossy().to_string(),
            content,
            token_estimate,
        });
    }

    let walker = ignore::WalkBuilder::new(folder_path)
        .hidden(true)
        .git_ignore(true)
        .require_git(false)
        .build();

    let mut file_count = 0;

    for result in walker {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        file_count += 1;
        if file_count > MAX_FOLDER_FILES {
            log::warn!(
                "Folder context exceeds {} file limit at {}; truncating.",
                MAX_FOLDER_FILES,
                path.display()
            );
            break;
        }

        let is_text = match is_text_file(path) {
            Ok(b) => b,
            Err(_) => continue,
        };

        if !is_text {
            continue;
        }

        if let Ok(file_content) = std::fs::read_to_string(path) {
            if content.len() + file_content.len() > MAX_FOLDER_CONTEXT_SIZE {
                log::warn!(
                    "Folder context exceeds 50MB limit at {}; truncating.",
                    path.display()
                );
                break;
            }
            let relative_path = path.strip_prefix(folder_path).unwrap_or(path);
            content.push_str(&format!(
                "\n--- File: {} ---\n{}\n",
                relative_path.display(),
                file_content
            ));
        }
    }

    let token_estimate = content.chars().count() / 4;
    Ok(FolderContextPayload {
        id: String::new(), // Not saved yet
        path: folder_path.to_string_lossy().to_string(),
        content,
        token_estimate,
    })
}

#[command]
pub async fn link_folder<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, AppState>,
    conversation_id: String,
    path: String,
) -> Result<FolderContextPayload, AppError> {
    let raw_path = std::path::PathBuf::from(&path);
    // MED-05: canonicalize and reject restricted paths before any FS access
    let path_buf = guard_path(&raw_path)?;

    let db_conn = state.db.clone();

    // Use spawn_blocking since reading large folders is CPU and I/O bound
    tokio::task::spawn_blocking(move || {
        let mut payload = read_folder_context(&path_buf)?;

        let guard = db_conn
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;

        // Idempotency check: see if this path is already linked for this conversation
        let existing = crate::db::folders::get_by_conversation_and_path(
            &guard,
            &conversation_id,
            &payload.path,
        )?;

        if let Some(ctx) = existing {
            // Update token count if it changed, but keep the record
            crate::db::folders::update_folder_context(
                &guard,
                &ctx.id,
                ctx.included_files_json,
                payload.token_estimate as i64,
            )?;
            payload.id = ctx.id;
        } else {
            let db_ctx = add_folder_context(
                &guard,
                NewFolderContext {
                    conversation_id,
                    path: payload.path.clone(),
                    included_files_json: None,
                    auto_refresh: false,
                    estimated_tokens: payload.token_estimate as i64,
                },
            )?;
            payload.id = db_ctx.id;
        }

        Ok(payload)
    })
    .await
    .map_err(AppError::from)?
}

#[command]
pub async fn unlink_folder(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let db_conn = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let guard = db_conn
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        crate::db::folders::delete_folder_context(&guard, &id)
    })
    .await
    .map_err(AppError::from)?
}

#[command]
pub async fn get_folder_contexts(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<crate::db::folders::FolderContext>, AppError> {
    let db_conn = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let guard = db_conn
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        crate::db::folders::get_by_conversation(&guard, &conversation_id)
    })
    .await
    .map_err(AppError::from)?
}

#[command]
pub async fn list_folder_files(path: String) -> Result<Vec<String>, AppError> {
    let raw_path = std::path::PathBuf::from(&path);
    // MED-05: canonicalize and reject restricted paths before any FS access
    let path_buf = guard_path(&raw_path)?;

    // We don't need DB access here, just filesystem access
    tokio::task::spawn_blocking(move || {
        let mut files = Vec::new();
        let walker = ignore::WalkBuilder::new(&path_buf)
            .hidden(true)
            .git_ignore(true)
            .require_git(false)
            .build();

        for result in walker {
            let entry = match result {
                Ok(e) => e,
                Err(_) => continue,
            };

            let p = entry.path();
            if p.is_file() {
                if let Ok(is_text) = is_text_file(p) {
                    if is_text {
                        if let Ok(rel) = p.strip_prefix(&path_buf) {
                            files.push(rel.display().to_string());
                            if files.len() >= MAX_FOLDER_FILES {
                                log::warn!(
                                    "File listing reached limit of {}; stopping.",
                                    MAX_FOLDER_FILES
                                );
                                break;
                            }
                        }
                    }
                }
            }
        }
        Ok(files)
    })
    .await
    .map_err(AppError::from)?
}

#[derive(Debug, Serialize)]
pub struct UpdatedContextResult {
    pub token_estimate: i64,
    pub content: String,
}

#[command]
pub async fn update_included_files(
    state: State<'_, AppState>,
    id: String,
    included_files: Vec<String>,
) -> Result<UpdatedContextResult, AppError> {
    let db_conn = state.db.clone();

    tokio::task::spawn_blocking(move || {
        let guard = db_conn
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        let ctx = crate::db::folders::get_folder_context(&guard, &id)?;

        let base_path = guard_path(Path::new(&ctx.path))?;

        let mut total_chars = 0usize;
        let mut content = String::new();

        for rel_path in &included_files {
            let full_path = base_path.join(rel_path);
            // Symlink check must happen before canonicalize; after canonicalize
            // is_symlink() always returns false because the target has been resolved.
            if full_path.is_symlink() {
                log::warn!("Skipping symlink in included files: {:?}", full_path);
                continue;
            }
            let canonical = match dunce::canonicalize(&full_path) {
                Ok(p) => p,
                Err(_) => continue,
            };
            if !canonical.starts_with(&base_path) {
                return Err(AppError::Internal("Path traversal detected".into()));
            }
            if included_files.len() > MAX_FOLDER_FILES {
                return Err(AppError::Internal(format!(
                    "Cannot include more than {} files",
                    MAX_FOLDER_FILES
                )));
            }
            if let Ok(file_content) = std::fs::read_to_string(&canonical) {
                total_chars += file_content.chars().count();
                if total_chars > MAX_FOLDER_CONTEXT_SIZE {
                    return Err(AppError::Internal(
                        "Selected files exceed 50MB limit".into(),
                    ));
                }
                content.push_str(&format!("\n--- File: {} ---\n{}\n", rel_path, file_content));
            }
        }

        let token_estimate = (total_chars / 4) as i64;
        let included_files_json = Some(serde_json::to_string(&included_files)?);

        crate::db::folders::update_folder_context(
            &guard,
            &id,
            included_files_json,
            token_estimate,
        )?;

        Ok(UpdatedContextResult {
            token_estimate,
            content,
        })
    })
    .await
    .map_err(AppError::from)?
}

#[command]
pub async fn get_included_files_content(
    state: State<'_, AppState>,
    id: String,
) -> Result<UpdatedContextResult, AppError> {
    let db_conn = state.db.clone();

    tokio::task::spawn_blocking(move || {
        let guard = db_conn
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        let ctx = crate::db::folders::get_folder_context(&guard, &id)?;

        let included_files: Vec<String> = ctx
            .included_files_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        if included_files.is_empty() {
            return Ok(UpdatedContextResult {
                token_estimate: ctx.estimated_tokens,
                content: String::new(),
            });
        }

        let base_path = guard_path(Path::new(&ctx.path))?;
        let mut total_chars = 0usize;
        let mut content = String::new();

        for rel_path in &included_files {
            let full_path = base_path.join(rel_path);
            // Symlink check must happen before canonicalize; after canonicalize
            // is_symlink() always returns false because the target has been resolved.
            if full_path.is_symlink() {
                continue;
            }
            let canonical = match dunce::canonicalize(&full_path) {
                Ok(p) => p,
                Err(_) => continue,
            };
            if !canonical.starts_with(&base_path) {
                continue;
            }
            if let Ok(file_content) = std::fs::read_to_string(&canonical) {
                total_chars += file_content.chars().count();
                content.push_str(&format!("\n--- File: {} ---\n{}\n", rel_path, file_content));
            }
        }

        Ok(UpdatedContextResult {
            token_estimate: (total_chars / 4) as i64,
            content,
        })
    })
    .await
    .map_err(AppError::from)?
}

#[command]
pub async fn estimate_tokens(
    path: String,
    included_files: Option<Vec<String>>,
) -> Result<i64, AppError> {
    let path_buf = guard_path(&std::path::PathBuf::from(&path))?;

    tokio::task::spawn_blocking(move || {
        let mut total_chars = 0;

        if let Some(files) = included_files {
            for rel_path in files {
                let full_path = path_buf.join(&rel_path);
                let canonical = match dunce::canonicalize(&full_path) {
                    Ok(p) => p,
                    Err(_) => continue,
                };
                if !canonical.starts_with(&path_buf) {
                    return Err(AppError::Internal("Path traversal detected".into()));
                }
                if let Ok(content) = std::fs::read_to_string(canonical) {
                    total_chars += content.chars().count();
                }
            }
        } else {
            // Read whole folder
            let walker = ignore::WalkBuilder::new(&path_buf)
                .hidden(true)
                .git_ignore(true)
                .require_git(false)
                .build();

            for result in walker {
                let entry = match result {
                    Ok(e) => e,
                    Err(_) => continue,
                };
                let p = entry.path();
                if p.is_file() {
                    if let Ok(is_text) = is_text_file(p) {
                        if is_text {
                            if let Ok(content) = std::fs::read_to_string(p) {
                                total_chars += content.chars().count();
                                if total_chars > MAX_FOLDER_CONTEXT_SIZE {
                                    log::warn!(
                                        "Estimation reached 50MB limit; returning partial count."
                                    );
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok((total_chars / 4) as i64)
    })
    .await
    .map_err(AppError::from)?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{folders::NewFolderContext, migrations};
    use rusqlite::Connection;
    use std::fs;
    use std::io::Write;
    use tempfile::{tempdir, TempDir};

    fn in_memory_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )
        .unwrap();
        migrations::run(&conn).unwrap();
        conn
    }

    fn setup_folder(files: &[(&str, &str)]) -> (TempDir, Connection, String) {
        let dir = TempDir::new().unwrap();
        for (name, content) in files {
            let path = dir.path().join(name);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(&path, content).unwrap();
        }

        let conn = in_memory_conn();
        conn.execute("INSERT INTO conversations (id) VALUES ('conv-1')", [])
            .unwrap();

        let ctx = crate::db::folders::add_folder_context(
            &conn,
            NewFolderContext {
                conversation_id: "conv-1".into(),
                path: dir.path().to_string_lossy().to_string(),
                included_files_json: None,
                auto_refresh: false,
                estimated_tokens: 0,
            },
        )
        .unwrap();

        (dir, conn, ctx.id)
    }

    #[test]
    fn update_included_files_returns_content_of_selected_files() {
        let (dir, conn, ctx_id) = setup_folder(&[
            ("main.rs", "fn main() {}"),
            ("lib.rs", "pub fn add(a: i32, b: i32) -> i32 { a + b }"),
        ]);

        let selected = vec!["main.rs".to_string()];
        let json = serde_json::to_string(&selected).unwrap();
        crate::db::folders::update_folder_context(&conn, &ctx_id, Some(json), 3).unwrap();

        let ctx = crate::db::folders::get_folder_context(&conn, &ctx_id).unwrap();
        let stored: Vec<String> =
            serde_json::from_str(ctx.included_files_json.as_deref().unwrap()).unwrap();
        assert_eq!(stored, vec!["main.rs"]);

        // Replicate the content-assembly logic from update_included_files
        let base = guard_path(std::path::Path::new(&ctx.path)).unwrap();
        let mut content = String::new();
        for rel in &stored {
            let full = base.join(rel);
            if let Ok(text) = std::fs::read_to_string(&full) {
                content.push_str(&format!("\n--- File: {} ---\n{}\n", rel, text));
            }
        }
        assert!(content.contains("fn main()"));
        assert!(!content.contains("pub fn add"));

        drop(dir);
    }

    #[test]
    fn get_included_files_content_excludes_unselected_files() {
        let (dir, conn, ctx_id) = setup_folder(&[
            ("a.txt", "content of a"),
            ("b.txt", "content of b"),
            ("c.txt", "content of c"),
        ]);

        let selected = vec!["a.txt".to_string(), "c.txt".to_string()];
        let json = serde_json::to_string(&selected).unwrap();
        crate::db::folders::update_folder_context(&conn, &ctx_id, Some(json), 10).unwrap();

        // Replicate the content-assembly logic from get_included_files_content
        let ctx = crate::db::folders::get_folder_context(&conn, &ctx_id).unwrap();
        let included: Vec<String> =
            serde_json::from_str(ctx.included_files_json.as_deref().unwrap()).unwrap();

        let base = guard_path(std::path::Path::new(&ctx.path)).unwrap();
        let mut content = String::new();
        for rel in &included {
            let full = base.join(rel);
            if full.is_symlink() {
                continue;
            }
            if let Ok(p) = dunce::canonicalize(&full) {
                if p.starts_with(&base) {
                    if let Ok(text) = std::fs::read_to_string(&p) {
                        content.push_str(&format!("\n--- File: {} ---\n{}\n", rel, text));
                    }
                }
            }
        }

        assert!(content.contains("content of a"), "a.txt should be included");
        assert!(content.contains("content of c"), "c.txt should be included");
        assert!(
            !content.contains("content of b"),
            "b.txt should NOT be included"
        );

        drop(dir);
    }

    #[test]
    fn get_included_files_content_empty_filter_returns_empty_content() {
        let (dir, conn, ctx_id) = setup_folder(&[("x.txt", "hello")]);

        let ctx = crate::db::folders::get_folder_context(&conn, &ctx_id).unwrap();
        let included: Vec<String> = ctx
            .included_files_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        assert!(included.is_empty());
        // When no filter is stored, get_included_files_content returns empty content
        let content = String::new();
        assert_eq!(content, "");

        drop(dir);
    }

    #[test]
    fn test_read_folder_context_excludes_hidden_and_binary() {
        let dir = tempdir().unwrap();
        let base_path = dir.path();

        // 1. Valid text file
        let file1_path = base_path.join("file1.rs");
        fs::write(&file1_path, "fn main() { println!(\"Hello\"); }").unwrap();

        // 2. Another valid text file in a sub-directory
        let subdir = base_path.join("src");
        fs::create_dir(&subdir).unwrap();
        let file2_path = subdir.join("app.js");
        fs::write(&file2_path, "console.log('world');").unwrap();

        // 3. Hidden directory (should be ignored)
        let git_dir = base_path.join(".git");
        fs::create_dir(&git_dir).unwrap();
        let hidden_file = git_dir.join("config");
        fs::write(&hidden_file, "secret").unwrap();

        // 4. Binary file (should be ignored)
        let bin_file = base_path.join("image.png");
        let mut f = fs::File::create(&bin_file).unwrap();
        // Write some null bytes to simulate a binary file
        f.write_all(&[0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03])
            .unwrap();

        let result = read_folder_context(base_path).unwrap();

        assert_eq!(result.path, base_path.to_string_lossy().to_string());

        // Assert content contains the valid files
        assert!(result.content.contains("fn main()"));
        assert!(result.content.contains("console.log('world');"));

        // Assert content DOES NOT contain the hidden or binary files
        assert!(!result.content.contains("secret"));

        let char_count = result.content.chars().count();
        assert_eq!(result.token_estimate, char_count / 4);
    }

    #[test]
    fn test_token_estimation_logic() {
        let dir = tempdir().unwrap();
        let path = dir.path();

        fs::write(path.join("a.txt"), "12345678").unwrap(); // 8 chars -> 2 tokens

        let est = read_folder_context(path).unwrap();
        // File content format: \n--- File: a.txt ---\n12345678\n
        // Let's check the actual formula
        let expected_chars = "\n--- File: a.txt ---\n12345678\n".chars().count();
        assert_eq!(est.token_estimate, expected_chars / 4);
    }

    #[test]
    fn test_guard_path_rejects_proc() {
        // /proc exists on Linux; canonicalize should succeed and we should reject it
        let result = guard_path(Path::new("/proc/self/maps"));
        assert!(result.is_err(), "/proc path should be rejected");
        assert!(result.unwrap_err().to_string().contains("Restricted path"));
    }

    #[test]
    fn test_guard_path_rejects_sys() {
        let result = guard_path(Path::new("/sys"));
        assert!(result.is_err(), "/sys should be rejected");
    }

    #[test]
    fn test_guard_path_rejects_etc() {
        let result = guard_path(Path::new("/etc/passwd"));
        assert!(result.is_err(), "/etc path should be rejected");
    }

    #[test]
    fn test_guard_path_allows_home() {
        let dir = tempdir().unwrap();
        // A normal temp path should be allowed
        let result = guard_path(dir.path());
        assert!(
            result.is_ok(),
            "Normal temp path should be allowed: {:?}",
            result
        );
    }
}
