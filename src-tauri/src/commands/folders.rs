use std::path::Path;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command, Runtime, State};

use crate::{error::AppError, state::AppState};
use crate::db::folders::{add_folder_context, NewFolderContext};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FolderContextPayload {
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

/// Recursively reads a directory, ignoring hidden files, `.git`,
/// and binary files. Extracts text from supported file types.
pub fn read_folder_context(folder_path: &Path) -> Result<FolderContextPayload, AppError> {
    let mut content = String::new();

    let walker = ignore::WalkBuilder::new(folder_path)
        .hidden(true)
        .git_ignore(true)
        .require_git(false)
        .build();

    for result in walker {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let is_text = match is_text_file(path) {
            Ok(b) => b,
            Err(_) => continue,
        };

        if !is_text {
            continue;
        }

        if let Ok(file_content) = std::fs::read_to_string(path) {
            let relative_path = path.strip_prefix(folder_path).unwrap_or(path);
            content.push_str(&format!("\n--- File: {} ---\n{}\n", relative_path.display(), file_content));
        }
    }

    let token_estimate = content.chars().count() / 4;
    Ok(FolderContextPayload {
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
    let path_buf = std::path::PathBuf::from(path);
    let db_conn = state.db.clone();
    
    // Use spawn_blocking since reading large folders is CPU and I/O bound
    tokio::task::spawn_blocking(move || {
        let payload = read_folder_context(&path_buf)?;
        
        let guard = db_conn.lock().unwrap();
        add_folder_context(&guard, NewFolderContext {
            conversation_id,
            path: payload.path.clone(),
            included_files_json: None,
            auto_refresh: false,
            estimated_tokens: payload.token_estimate as i64,
        })?;
        
        Ok(payload)
    })
    .await
    .map_err(AppError::from)?
}

#[command]
pub async fn unlink_folder(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let db_conn = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let guard = db_conn.lock().unwrap();
        crate::db::folders::delete_folder_context(&guard, &id)
    })
    .await
    .map_err(AppError::from)?
}

#[command]
pub async fn list_folder_files(
    path: String,
) -> Result<Vec<String>, AppError> {
    let path_buf = std::path::PathBuf::from(path);
    
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

#[command]
pub async fn update_included_files(
    state: State<'_, AppState>,
    id: String,
    included_files: Vec<String>,
) -> Result<i64, AppError> {
    let db_conn = state.db.clone();
    
    tokio::task::spawn_blocking(move || {
        let guard = db_conn.lock().unwrap();
        let ctx = crate::db::folders::get_folder_context(&guard, &id)?;
        
        // Recalculate tokens based on new selection
        let base_path = Path::new(&ctx.path);
        let mut total_chars = 0;
        
        for rel_path in &included_files {
            let full_path = base_path.join(rel_path);
            if let Ok(content) = std::fs::read_to_string(full_path) {
                total_chars += content.chars().count();
            }
        }
        
        let token_estimate = (total_chars / 4) as i64;
        let included_files_json = Some(serde_json::to_string(&included_files)?);
        
        crate::db::folders::update_folder_context(&guard, &id, included_files_json, token_estimate)?;
        
        Ok(token_estimate)
    })
    .await
    .map_err(AppError::from)?
}

#[command]
pub async fn estimate_tokens(
    path: String,
    included_files: Option<Vec<String>>,
) -> Result<i64, AppError> {
    let path_buf = std::path::PathBuf::from(path);
    
    tokio::task::spawn_blocking(move || {
        let mut total_chars = 0;
        
        if let Some(files) = included_files {
            for rel_path in files {
                let full_path = path_buf.join(rel_path);
                if let Ok(content) = std::fs::read_to_string(full_path) {
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
    use std::fs;
    use std::io::Write;
    use tempfile::tempdir;

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
        f.write_all(&[0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]).unwrap();

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
}
