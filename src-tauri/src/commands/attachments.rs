use std::path::Path;

/// Reads an image file from the local filesystem with strict validation.
///
/// Permitted extensions: jpg, jpeg, png, gif, webp, bmp (case-insensitive).
/// Maximum file size: 20 MB.
///
/// This command replaces the broad `fs:allow-read-file` capability permission
/// with a narrow, extension- and size-checked path that the frontend uses for
/// drag-and-drop image attachments.
#[tauri::command]
pub async fn read_image_file(path: String) -> Result<Vec<u8>, String> {
    const MAX_SIZE: u64 = 20 * 1024 * 1024; // 20 MB
    const ALLOWED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "bmp"];

    // Validate extension
    let extension = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .ok_or_else(|| "File has no extension or extension is invalid".to_string())?;

    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!(
            "File extension '{}' is not permitted. Allowed: {}",
            extension,
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }

    // Check file size before reading
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|e| format!("Failed to read file metadata: {e}"))?;

    if metadata.len() > MAX_SIZE {
        return Err(format!(
            "File size {} bytes exceeds the 20 MB limit",
            metadata.len()
        ));
    }

    // Read file bytes
    tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read image file: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn rejects_missing_extension() {
        let result = read_image_file("/tmp/imagewithoutextension".to_string()).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("no extension"), "got: {err}");
    }

    #[tokio::test]
    async fn rejects_disallowed_extension() {
        let result = read_image_file("/tmp/document.pdf".to_string()).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("not permitted"), "got: {err}");
    }

    #[tokio::test]
    async fn rejects_executable_extension() {
        let result = read_image_file("/tmp/malware.exe".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn accepts_valid_image_extension_and_reads_bytes() {
        let mut file = NamedTempFile::with_suffix(".png").unwrap();
        let data = b"\x89PNG\r\n\x1a\nfake";
        file.write_all(data).unwrap();

        let path = file.path().to_str().unwrap().to_string();
        let result = read_image_file(path).await;
        assert!(result.is_ok(), "expected Ok, got: {:?}", result);
        assert_eq!(result.unwrap(), data);
    }

    #[tokio::test]
    async fn accepts_uppercase_extension() {
        let mut file = NamedTempFile::with_suffix(".JPEG").unwrap();
        file.write_all(b"fake jpeg").unwrap();

        let path = file.path().to_str().unwrap().to_string();
        let result = read_image_file(path).await;
        assert!(result.is_ok(), "expected Ok, got: {:?}", result);
    }

    #[tokio::test]
    async fn rejects_nonexistent_file_with_valid_extension() {
        let result = read_image_file("/tmp/nonexistent_file_abc123.png".to_string()).await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("metadata"), "got: {err}");
    }
}
