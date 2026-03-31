use tauri::command;
use crate::error::AppError;
use crate::auth::keyring;

#[command]
pub async fn login(host_id: String, token: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || keyring::set_token(&host_id, &token)).await??;
    Ok(())
}

#[command]
pub async fn logout(host_id: String) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || keyring::delete_token(&host_id)).await??;
    Ok(())
}

#[command]
pub async fn get_auth_status(host_id: String) -> Result<bool, AppError> {
    let token = tokio::task::spawn_blocking(move || keyring::get_token(&host_id)).await??;
    Ok(token.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_auth_commands_flow() {
        let host_id = Uuid::new_v4().to_string();
        let token = "test_token_commands".to_string();

        let initial_status = get_auth_status(host_id.clone()).await;
        if let Err(AppError::Auth(ref msg)) = initial_status {
            if msg.contains("No secret-service") || msg.contains("NoBackend") || msg.contains("locked") {
                return; // Gracefully pass in headless environments without mocked DBus
            }
        }
        assert!(!initial_status.unwrap());

        // Login (Set token)
        let login_res = login(host_id.clone(), token.clone()).await;
        assert!(login_res.is_ok());

        // Verify status is true
        let status_after_login = get_auth_status(host_id.clone()).await.unwrap();
        assert!(status_after_login);

        // Logout (Delete token)
        let logout_res = logout(host_id.clone()).await;
        assert!(logout_res.is_ok());

        // Verify status is false
        let status_after_logout = get_auth_status(host_id.clone()).await.unwrap();
        assert!(!status_after_logout);
    }
}
