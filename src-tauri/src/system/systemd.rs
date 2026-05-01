use crate::error::AppError;
use std::process::{ExitStatus, Stdio};
use tokio::process::Command;

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
}
