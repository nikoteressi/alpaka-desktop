use crate::error::AppError;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct HardwareInfo {
    pub gpu_name: Option<String>,
    pub vram_mb: Option<u64>,
    pub ram_mb: u64,
}

// ── RAM detection ──────────────────────────────────────────────────────────────

/// Parse `/proc/meminfo` and return total RAM in MB.  Returns 0 on any error.
fn read_ram_mb() -> u64 {
    let content = match std::fs::read_to_string("/proc/meminfo") {
        Ok(s) => s,
        Err(_) => return 0,
    };

    for line in content.lines() {
        if line.starts_with("MemTotal:") {
            // Format: "MemTotal:       16384000 kB"
            let kb: u64 = line
                .split_whitespace()
                .nth(1)
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
            return kb / 1024;
        }
    }
    0
}

// ── GPU/VRAM detection ─────────────────────────────────────────────────────────

/// Attempt to read a single file from `/sys/class/drm/card<N>/device/<filename>`.
/// Returns the trimmed string contents or None.
fn read_drm_card_file(card_dir: &std::path::Path, filename: &str) -> Option<String> {
    let path = card_dir.join("device").join(filename);
    std::fs::read_to_string(&path)
        .ok()
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
}

/// Try AMD amdgpu sysfs.  Returns `(gpu_name, vram_mb)` or None.
fn detect_amd_gpu() -> Option<(Option<String>, u64)> {
    let drm_dir = std::path::Path::new("/sys/class/drm");
    let entries = std::fs::read_dir(drm_dir).ok()?;

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        // Only process card<N> entries (not renderD*)
        if !name_str.starts_with("card") {
            continue;
        }
        // Ensure the suffix after "card" is all digits
        if !name_str["card".len()..].chars().all(|c| c.is_ascii_digit()) {
            continue;
        }

        let card_path = entry.path();

        // Read VRAM total (bytes)
        let vram_bytes: Option<u64> =
            read_drm_card_file(&card_path, "mem_info_vram_total").and_then(|s| s.parse().ok());

        if let Some(bytes) = vram_bytes {
            let vram_mb = bytes / (1024 * 1024);
            let gpu_name = read_drm_card_file(&card_path, "product_name");
            return Some((gpu_name, vram_mb));
        }
    }
    None
}

/// Try NVIDIA via `nvidia-smi`.  Returns `(gpu_name, vram_mb)` or None.
///
/// Runs the subprocess in a `spawn_blocking` thread so it doesn't block the
/// Tokio runtime.  A 5-second timeout guards against a hung driver.
async fn detect_nvidia_gpu() -> Option<(Option<String>, u64)> {
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::task::spawn_blocking(|| {
            std::process::Command::new("nvidia-smi")
                .args([
                    "--query-gpu=name,memory.total",
                    "--format=csv,noheader,nounits",
                ])
                .output()
        }),
    )
    .await;

    // Timeout or join error → no NVIDIA GPU
    let output = result.ok()?.ok()?.ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout.lines().next()?;

    // Format: "NVIDIA GeForce RTX 3080, 10240"
    // Split on the last comma to tolerate GPU names that contain commas.
    let comma_pos = first_line.rfind(',')?;
    let name_part = first_line[..comma_pos].trim().to_owned();
    let vram_part = first_line[comma_pos + 1..].trim();

    let vram_mb: u64 = vram_part.parse().ok()?;
    let gpu_name = if name_part.is_empty() {
        None
    } else {
        Some(name_part)
    };

    Some((gpu_name, vram_mb))
}

// ── Tauri command ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn detect_hardware() -> Result<HardwareInfo, AppError> {
    let ram_mb = read_ram_mb();

    // Try AMD first (pure filesystem, no subprocess)
    if let Some((gpu_name, vram_mb)) = detect_amd_gpu() {
        return Ok(HardwareInfo {
            gpu_name,
            vram_mb: Some(vram_mb),
            ram_mb,
        });
    }

    // Try NVIDIA (subprocess with timeout)
    if let Some((gpu_name, vram_mb)) = detect_nvidia_gpu().await {
        return Ok(HardwareInfo {
            gpu_name,
            vram_mb: Some(vram_mb),
            ram_mb,
        });
    }

    // No GPU detected — return partial info (no error)
    Ok(HardwareInfo {
        gpu_name: None,
        vram_mb: None,
        ram_mb,
    })
}
