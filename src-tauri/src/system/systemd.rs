use crate::error::AppError;
use std::process::{ExitStatus, Stdio};
use tokio::process::Command;

/// Returns the path to ~/.config/systemd/user/ollama.service.d
fn override_dir() -> std::path::PathBuf {
    let base = std::env::var("XDG_CONFIG_HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_else(|_| String::new());
            std::path::PathBuf::from(home).join(".config")
        });
    base.join("systemd/user/ollama.service.d")
}

/// Creates (or overwrites) the OLLAMA_MODELS override.conf in `dir`.
pub(crate) fn write_override_file(dir: &std::path::Path, models_path: &str) -> Result<(), AppError> {
    std::fs::create_dir_all(dir)?;
    let escaped = models_path.replace('"', "\\\"");
    let content = format!("[Service]\nEnvironment=\"OLLAMA_MODELS={}\"\n", escaped);
    std::fs::write(dir.join("override.conf"), content)?;
    Ok(())
}

/// Removes the override.conf from `dir`. No-ops if it doesn't exist.
pub(crate) fn remove_override_file(dir: &std::path::Path) -> Result<(), AppError> {
    let path = dir.join("override.conf");
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

/// Writes the OLLAMA_MODELS systemd user service override and reloads the daemon.
/// Returns Err if the file write or daemon-reload fails.
pub(crate) async fn write_model_path_override(models_path: &str) -> Result<(), AppError> {
    let dir = override_dir();
    write_override_file(&dir, models_path)?;
    let output = run_command("systemctl", &["--user", "daemon-reload"]).await?;
    handle_result(output, "override file written but systemctl --user daemon-reload failed")
}

/// Removes the OLLAMA_MODELS override and does a best-effort daemon-reload.
pub(crate) async fn remove_model_path_override() -> Result<(), AppError> {
    let dir = override_dir();
    remove_override_file(&dir)?;
    // Best-effort: if daemon-reload fails (e.g. no user service), that's acceptable for a reset.
    let _ = run_command("systemctl", &["--user", "daemon-reload"]).await;
    Ok(())
}

fn systemctl_available() -> bool {
    std::process::Command::new("which")
        .arg("systemctl")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Starts the Ollama systemd service.
/// It first attempts to run `systemctl --user start ollama` (no polkit needed).
/// If that fails, it falls back to `systemctl start ollama` which might trigger polkit.
pub async fn start_service() -> Result<(), AppError> {
    if !systemctl_available() {
        return Err(AppError::Service(
            "systemd not found on this system. \
             Please start Ollama manually: run 'ollama serve' in a terminal."
                .into(),
        ));
    }

    // Attempt 1: Start the user service first (no polkit needed)
    if let Ok(true) = try_systemctl(&["--user", "start", "ollama"]).await {
        return Ok(());
    }

    // Attempt 2: Fallback to system-level service manager
    let output = run_command("systemctl", &["start", "ollama"]).await?;
    handle_result(output, "failed to start Ollama service")
}

/// Stops the Ollama systemd service.
/// First attempts user service, then falls back to system service.
pub async fn stop_service() -> Result<(), AppError> {
    if !systemctl_available() {
        return Err(AppError::Service(
            "systemd not found on this system. \
             Please start Ollama manually: run 'ollama serve' in a terminal."
                .into(),
        ));
    }

    if let Ok(true) = try_systemctl(&["--user", "stop", "ollama"]).await {
        return Ok(());
    }

    let output = run_command("systemctl", &["stop", "ollama"]).await?;
    handle_result(output, "failed to stop Ollama service")
}

/// Checks if the Ollama service is running.
/// Returns true if either the user or system service is active.
pub async fn check_status() -> Result<bool, AppError> {
    // Check user service
    if let Ok(true) = try_systemctl(&["--user", "is-active", "ollama"]).await {
        return Ok(true);
    }

    // Check system service
    let output = run_command("systemctl", &["is-active", "ollama"]).await?;
    // is-active returns 0 if active, non-zero otherwise.
    Ok(output.status.success())
}

/// Internal helper to try a systemctl command and return true if it succeeded.
/// Used for attempts that can fail silently (like --user when no user service exists).
async fn try_systemctl(args: &[&str]) -> Result<bool, AppError> {
    let output = run_command("systemctl", args).await?;
    Ok(output.status.success())
}

/// Internal helper to run a command and capture its output.
async fn run_command(cmd: &str, args: &[&str]) -> Result<CommandOutput, AppError> {
    let output = Command::new(cmd)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| AppError::Service(format!("Failed to execute {}: {}", cmd, e)))?;

    Ok(CommandOutput {
        status: output.status,
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

/// Handles the result of a command execution, mapping non-zero exit codes to AppError::Service.
fn handle_result(output: CommandOutput, context: &str) -> Result<(), AppError> {
    if output.status.success() {
        Ok(())
    } else {
        let stderr = output.stderr.trim();
        if stderr.is_empty() {
            Err(AppError::Service(context.to_string()))
        } else {
            Err(AppError::Service(format!("{}: {}", context, stderr)))
        }
    }
}

struct CommandOutput {
    status: ExitStatus,
    stderr: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::process::ExitStatusExt;
    use std::process::ExitStatus;

    #[test]
    fn test_handle_result_success() {
        let output = CommandOutput {
            status: ExitStatus::from_raw(0),
            stderr: "".to_string(),
        };
        assert!(handle_result(output, "context").is_ok());
    }

    #[test]
    fn test_handle_result_failure_with_stderr() {
        let output = CommandOutput {
            status: ExitStatus::from_raw(256), // usually means 1
            stderr: "permission denied".to_string(),
        };
        let err = handle_result(output, "failed").unwrap_err();
        if let AppError::Service(msg) = err {
            assert!(msg.contains("failed: permission denied"));
        } else {
            panic!("Expected Service error");
        }
    }

    #[test]
    fn test_handle_result_failure_no_stderr() {
        let output = CommandOutput {
            status: ExitStatus::from_raw(256),
            stderr: "".to_string(),
        };
        let err = handle_result(output, "failed").unwrap_err();
        if let AppError::Service(msg) = err {
            assert_eq!(msg, "failed");
        } else {
            panic!("Expected Service error");
        }
    }

    #[test]
    fn write_override_file_creates_dir_and_file() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("ollama.service.d");
        write_override_file(&dir, "/mnt/ssd/models").unwrap();

        let content = std::fs::read_to_string(dir.join("override.conf")).unwrap();
        assert!(content.contains("[Service]"), "missing [Service] section");
        assert!(
            content.contains("Environment=\"OLLAMA_MODELS=/mnt/ssd/models\""),
            "missing OLLAMA_MODELS line"
        );
    }

    #[test]
    fn write_override_file_overwrites_existing() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("ollama.service.d");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("override.conf"), "[Service]\nEnvironment=OLLAMA_MODELS=/old\n").unwrap();

        write_override_file(&dir, "/mnt/new").unwrap();
        let content = std::fs::read_to_string(dir.join("override.conf")).unwrap();
        assert!(content.contains("OLLAMA_MODELS=/mnt/new"));
        assert!(!content.contains("/old"));
    }

    #[test]
    fn remove_override_file_deletes_existing_file() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("ollama.service.d");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("override.conf"), "[Service]\n").unwrap();

        remove_override_file(&dir).unwrap();
        assert!(!dir.join("override.conf").exists());
    }

    #[test]
    fn remove_override_file_ok_when_missing() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("nonexistent-service.d");
        // Neither dir nor file exists — must return Ok
        remove_override_file(&dir).unwrap();
    }

    #[test]
    fn write_override_file_quotes_path_with_spaces() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("ollama.service.d");
        write_override_file(&dir, "/home/user/My Models").unwrap();
        let content = std::fs::read_to_string(dir.join("override.conf")).unwrap();
        assert!(content.contains("\"OLLAMA_MODELS=/home/user/My Models\""));
    }
}
