use crate::db;
use crate::error::AppError;
use crate::state::AppState;
use serde::Serialize;
use std::path::PathBuf;
use std::process::Stdio;
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

        // Use metadata() instead of is_dir() so we can distinguish EACCES from ENOENT.
        // is_dir() returns false for both, which causes system paths (parent dir mode 700)
        // to incorrectly report as non-existent.
        let (exists, accessible, model_count) = match std::fs::metadata(&resolved) {
            Ok(m) if m.is_dir() => {
                match std::fs::read_dir(&resolved) {
                    Ok(_) => (true, true, count_models(&resolved)),
                    Err(_) => (true, false, 0),
                }
            }
            Ok(_) => (false, false, 0), // exists but is a file, not a dir
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                // Parent directory not traversable (e.g. /usr/share/ollama/.ollama/ is mode 700).
                // The path likely exists — treat as inaccessible, not missing.
                (true, false, 0)
            }
            Err(_) => (false, false, 0),
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

// ── Service application ────────────────────────────────────────────────────────

/// Remove the user-service override and restart Ollama so it falls back to its default model path.
async fn clear_user_service() -> Result<ApplyModelPathResult, AppError> {
    let home = std::env::var("HOME")
        .map_err(|_| AppError::Internal("HOME env var not set".into()))?;

    let override_path = PathBuf::from(&home)
        .join(".config/systemd/user/ollama.service.d/override.conf");

    // Best-effort removal; if the file doesn't exist, that's fine.
    let _ = std::fs::remove_file(&override_path);

    let reload_ok = Command::new("systemctl")
        .args(["--user", "daemon-reload"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false);

    if !reload_ok {
        return Err(AppError::Service(
            "systemctl --user daemon-reload failed".into(),
        ));
    }

    let restarted = Command::new("systemctl")
        .args(["--user", "restart", "ollama"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false);

    Ok(ApplyModelPathResult {
        service_type: "user".into(),
        applied: true,
        restarted,
        message: if restarted {
            "Ollama restarted with default model path".into()
        } else {
            "Model path override removed. Start Ollama to apply.".into()
        },
    })
}

/// Remove the system-service override via pkexec and restart Ollama.
async fn clear_system_service() -> Result<ApplyModelPathResult, AppError> {
    let script =
        "rm -f /etc/systemd/system/ollama.service.d/override.conf && \
         systemctl daemon-reload && \
         systemctl restart ollama";

    let result = Command::new("pkexec")
        .args(["sh", "-c", script])
        .status()
        .await;

    match result {
        Ok(s) if s.success() => Ok(ApplyModelPathResult {
            service_type: "system".into(),
            applied: true,
            restarted: true,
            message: "Ollama restarted with default model path".into(),
        }),
        Ok(_) => Err(AppError::Service(
            "Elevated access was denied or failed. Override not removed.".into(),
        )),
        Err(e) => Err(AppError::Service(format!(
            "pkexec not available: {}. Install polkit to remove the system service override.",
            e
        ))),
    }
}

async fn apply_user_service(resolved_path: &str) -> Result<ApplyModelPathResult, AppError> {
    let home = std::env::var("HOME")
        .map_err(|_| AppError::Internal("HOME env var not set".into()))?;

    let override_dir = PathBuf::from(&home)
        .join(".config/systemd/user/ollama.service.d");
    std::fs::create_dir_all(&override_dir)?;
    std::fs::write(override_dir.join("override.conf"), override_file_content(resolved_path))?;

    let reload_ok = Command::new("systemctl")
        .args(["--user", "daemon-reload"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false);

    if !reload_ok {
        return Err(AppError::Service(
            "systemctl --user daemon-reload failed".into(),
        ));
    }

    let restarted = Command::new("systemctl")
        .args(["--user", "restart", "ollama"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false);

    Ok(ApplyModelPathResult {
        service_type: "user".into(),
        applied: true,
        restarted,
        message: if restarted {
            "Ollama restarted with new model path".into()
        } else {
            "Model path configured. Start Ollama to apply.".into()
        },
    })
}

async fn apply_system_service(resolved_path: &str) -> Result<ApplyModelPathResult, AppError> {
    // Use $XDG_RUNTIME_DIR (mode 0700, per-user) to avoid a world-writable /tmp symlink attack.
    let runtime_dir = std::env::var("XDG_RUNTIME_DIR")
        .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().into_owned());
    let tmp_path = format!("{}/alpaka_ollama_override.conf", runtime_dir);
    std::fs::write(&tmp_path, override_file_content(resolved_path))?;

    // Single pkexec call = single polkit password prompt.
    // The model path lives in the file content, not in shell args, preventing injection.
    let script = format!(
        "mkdir -p /etc/systemd/system/ollama.service.d && \
         cp {tmp} /etc/systemd/system/ollama.service.d/override.conf && \
         systemctl daemon-reload && \
         systemctl restart ollama",
        tmp = tmp_path
    );

    let result = Command::new("pkexec")
        .args(["sh", "-c", &script])
        .status()
        .await;

    let _ = std::fs::remove_file(&tmp_path);

    match result {
        Ok(s) if s.success() => {
            // pkexec exited 0 → all commands in the &&-chain succeeded, including restart
            Ok(ApplyModelPathResult {
                service_type: "system".into(),
                applied: true,
                restarted: true,
                message: "Ollama restarted with new model path".into(),
            })
        }
        Ok(_) => Err(AppError::Service(
            "Elevated access was denied or failed. Model path not applied.".into(),
        )),
        Err(e) => Err(AppError::Service(format!(
            "pkexec not available: {}. Install polkit to configure the system service.",
            e
        ))),
    }
}

#[tauri::command]
pub async fn apply_model_path(
    state: State<'_, AppState>,
    path: String,
) -> Result<ApplyModelPathResult, AppError> {
    db::settings::set_async(state.db.clone(), "modelPath".to_string(), path.clone()).await?;

    // Empty path = clear the override so Ollama reverts to its default model path.
    if path.trim().is_empty() {
        return match detect_service_type().await {
            ServiceType::User => clear_user_service().await,
            ServiceType::System => clear_system_service().await,
            ServiceType::None => Ok(ApplyModelPathResult {
                service_type: "none".into(),
                applied: true,
                restarted: false,
                message: "Model path cleared.".into(),
            }),
        };
    }

    let resolved = expand_tilde(&path);
    let resolved_str = resolved.to_string_lossy().to_string();

    match detect_service_type().await {
        ServiceType::User => apply_user_service(&resolved_str).await,
        ServiceType::System => apply_system_service(&resolved_str).await,
        ServiceType::None => Ok(ApplyModelPathResult {
            service_type: "none".into(),
            applied: false,
            restarted: false,
            message: format!(
                "Path saved. Set OLLAMA_MODELS={resolved_str} in your environment before starting Ollama."
            ),
        }),
    }
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

    // ── apply_user_service ────────────────────────────────────────────────────

    #[test]
    fn user_override_file_content_is_correct() {
        let dir = tempfile::TempDir::new().unwrap();
        let override_dir = dir.path().join("ollama.service.d");
        std::fs::create_dir_all(&override_dir).unwrap();
        let override_path = override_dir.join("override.conf");
        std::fs::write(&override_path, override_file_content("/mnt/models")).unwrap();

        let written = std::fs::read_to_string(&override_path).unwrap();
        assert_eq!(
            written,
            "[Service]\nEnvironment=\"OLLAMA_MODELS=/mnt/models\"\n"
        );
    }
}
