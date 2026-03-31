use crate::error::AppError;
use crate::system::systemd;

#[tauri::command]
pub async fn start_ollama() -> Result<(), AppError> {
    systemd::start_service().await
}

#[tauri::command]
pub async fn stop_ollama() -> Result<(), AppError> {
    systemd::stop_service().await
}

#[tauri::command]
pub async fn ollama_service_status() -> Result<bool, AppError> {
    systemd::check_status().await
}
