#[allow(unused_imports)]
use crate::db;
#[allow(unused_imports)]
use crate::error::AppError;
#[allow(unused_imports)]
use crate::state::AppState;
use serde::Serialize;
use std::path::PathBuf;
use std::process::Stdio;
#[allow(unused_imports)]
use tauri::State;
use tokio::process::Command;

// ── Public response types ──────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ModelPathInfo {
    pub resolved_path: String,
    pub exists: bool,
    pub accessible: bool,
    pub model_count: u32,
}

#[derive(Debug, Serialize)]
pub struct ApplyModelPathResult {
    pub service_type: String,
    pub applied: bool,
    pub restarted: bool,
    pub message: String,
}

// ── Internal helpers ───────────────────────────────────────────────────────────

#[derive(Debug, PartialEq)]
enum ServiceType {
    User,
    System,
    None,
}

/// Expand a leading `~` to the value of `$HOME`.
pub fn expand_tilde(path: &str) -> PathBuf {
    if path == "~" {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home);
        }
    } else if let Some(rest) = path.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(path)
}

/// Count Ollama model manifests under `<path>/manifests/`.
/// Ollama stores manifests at: <path>/manifests/registry.ollama.ai/library/<name>/<tag>
/// We walk up to 5 levels deep and count leaf files.
pub fn count_models(base: &std::path::Path) -> u32 {
    let manifests = base.join("manifests");
    if !manifests.is_dir() {
        return 0;
    }
    fn walk(dir: &std::path::Path, depth: u8, count: &mut u32) {
        if depth > 5 {
            return;
        }
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    walk(&p, depth + 1, count);
                } else if depth >= 3 {
                    *count += 1;
                }
            }
        }
    }
    let mut count = 0u32;
    walk(&manifests, 0, &mut count);
    count
}

/// Generate the content of a systemd service override that sets `OLLAMA_MODELS`.
pub fn override_file_content(resolved_path: &str) -> String {
    format!("[Service]\nEnvironment=\"OLLAMA_MODELS={resolved_path}\"\n")
}

// ── Commands ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn validate_model_path(path: String) -> Result<ModelPathInfo, AppError> {
    tokio::task::spawn_blocking(move || {
        let resolved = expand_tilde(&path);
        let resolved_str = resolved.to_string_lossy().to_string();
        let exists = resolved.is_dir();
        let (accessible, model_count) = if exists {
            match std::fs::read_dir(&resolved) {
                Ok(_) => (true, count_models(&resolved)),
                Err(_) => (false, 0),
            }
        } else {
            (false, 0)
        };
        Ok(ModelPathInfo {
            resolved_path: resolved_str,
            exists,
            accessible,
            model_count,
        })
    })
    .await?
}

// ── Service detection ─────────────────────────────────────────────────────────

async fn run_systemctl(args: &[&str]) -> bool {
    Command::new("systemctl")
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}

#[allow(dead_code)]
async fn detect_service_type() -> ServiceType {
    // Prefer user service — no elevated privileges needed
    let user_checks: &[&[&str]] = &[
        &["--user", "is-enabled", "ollama"],
        &["--user", "is-active", "ollama"],
    ];
    for args in user_checks {
        if run_systemctl(args).await {
            return ServiceType::User;
        }
    }

    // Fall back to system service
    let system_checks: &[&[&str]] = &[
        &["is-enabled", "ollama"],
        &["is-active", "ollama"],
    ];
    for args in system_checks {
        if run_systemctl(args).await {
            return ServiceType::System;
        }
    }

    ServiceType::None
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    // ── expand_tilde ───────────────────────────────────────────────────────────

    #[test]
    fn expand_tilde_bare() {
        let home = std::env::var("HOME").unwrap();
        assert_eq!(expand_tilde("~"), PathBuf::from(&home));
    }

    #[test]
    fn expand_tilde_with_subpath() {
        let home = std::env::var("HOME").unwrap();
        assert_eq!(
            expand_tilde("~/models"),
            PathBuf::from(home).join("models")
        );
    }

    #[test]
    fn expand_tilde_absolute_path_unchanged() {
        assert_eq!(
            expand_tilde("/usr/share/ollama/models"),
            PathBuf::from("/usr/share/ollama/models")
        );
    }

    #[test]
    fn expand_tilde_relative_path_unchanged() {
        assert_eq!(expand_tilde("models"), PathBuf::from("models"));
    }

    // ── count_models ──────────────────────────────────────────────────────────

    #[test]
    fn count_models_empty_dir() {
        let dir = TempDir::new().unwrap();
        assert_eq!(count_models(dir.path()), 0);
    }

    #[test]
    fn count_models_no_manifests_subdir() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join("blobs")).unwrap();
        assert_eq!(count_models(dir.path()), 0);
    }

    #[test]
    fn count_models_one_model() {
        let dir = TempDir::new().unwrap();
        let manifest_path = dir
            .path()
            .join("manifests/registry.ollama.ai/library/llama3");
        fs::create_dir_all(&manifest_path).unwrap();
        fs::write(manifest_path.join("latest"), b"{}").unwrap();
        assert_eq!(count_models(dir.path()), 1);
    }

    #[test]
    fn count_models_two_models() {
        let dir = TempDir::new().unwrap();
        let base = dir.path().join("manifests/registry.ollama.ai/library");
        fs::create_dir_all(base.join("llama3")).unwrap();
        fs::write(base.join("llama3/latest"), b"{}").unwrap();
        fs::create_dir_all(base.join("mistral")).unwrap();
        fs::write(base.join("mistral/7b"), b"{}").unwrap();
        assert_eq!(count_models(dir.path()), 2);
    }

    // ── override_file_content ─────────────────────────────────────────────────

    #[test]
    fn override_file_content_format() {
        let content = override_file_content("/mnt/data/models");
        assert_eq!(
            content,
            "[Service]\nEnvironment=\"OLLAMA_MODELS=/mnt/data/models\"\n"
        );
    }

    #[test]
    fn override_file_content_with_home_path() {
        let content = override_file_content("/home/user/.ollama/models");
        assert!(content.contains("OLLAMA_MODELS=/home/user/.ollama/models"));
    }

    // ── validate_model_path ───────────────────────────────────────────────────

    #[tokio::test]
    async fn validate_nonexistent_path() {
        let result = validate_model_path("/nonexistent/path/xyz_alpaka_test_123".into())
            .await
            .unwrap();
        assert!(!result.exists);
        assert!(!result.accessible);
        assert_eq!(result.model_count, 0);
    }

    #[tokio::test]
    async fn validate_existing_empty_dir() {
        let dir = tempfile::TempDir::new().unwrap();
        let result = validate_model_path(dir.path().to_str().unwrap().into())
            .await
            .unwrap();
        assert!(result.exists);
        assert!(result.accessible);
        assert_eq!(result.model_count, 0);
    }

    #[tokio::test]
    async fn validate_dir_with_models() {
        let dir = tempfile::TempDir::new().unwrap();
        let base = dir.path().join("manifests/registry.ollama.ai/library/llama3");
        std::fs::create_dir_all(&base).unwrap();
        std::fs::write(base.join("latest"), b"{}").unwrap();

        let result = validate_model_path(dir.path().to_str().unwrap().into())
            .await
            .unwrap();
        assert!(result.exists);
        assert!(result.accessible);
        assert_eq!(result.model_count, 1);
    }

    #[tokio::test]
    async fn validate_tilde_path_resolves() {
        let result = validate_model_path("~".into()).await.unwrap();
        assert!(result.exists);
        assert!(!result.resolved_path.contains('~'));
    }
}
