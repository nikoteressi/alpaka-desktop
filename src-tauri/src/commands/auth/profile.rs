use base64::{engine::general_purpose::STANDARD, Engine as _};
use ed25519_dalek::{Signer, SigningKey};
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;

use super::ollama_key_path;
use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct OllamaUserProfile {
    pub name: String,
    pub email: Option<String>,
    pub plan: Option<String>,
}

/// Fetches the authenticated user's profile from ollama.com using the local
/// ed25519 SSH key that `ollama signin` creates at ~/.ollama/id_ed25519.
///
/// Signing scheme mirrors the Ollama CLI (auth/auth.go):
///   challenge  = "POST,/api/me?ts=<unix_seconds>"
///   auth_header = base64(ssh_wire_pubkey) + ":" + base64(raw_ed25519_signature)
#[command]
pub async fn get_ollama_user_profile() -> Result<OllamaUserProfile, AppError> {
    let key_path = ollama_key_path();

    let key_pem = tokio::fs::read(&key_path)
        .await
        .map_err(|_| AppError::Auth("SSH key not found — sign in first.".into()))?;

    let (pub_wire, seed) = parse_openssh_ed25519(&key_pem)?;

    // parts[1] in Go: the raw SSH wire-format bytes of the public key, base64-encoded
    let pubkey_b64 = STANDARD.encode(&pub_wire);

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let challenge = format!("POST,/api/me?ts={ts}");

    let signing_key = SigningKey::from_bytes(&seed);
    let sig = signing_key.sign(challenge.as_bytes());
    let sig_b64 = STANDARD.encode(sig.to_bytes());

    let auth_header = format!("{pubkey_b64}:{sig_b64}");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client build failed: {e}")))?;

    // Go client appends ?ts=<ts> to the actual request URL in addition to including
    // it in the signed challenge string (see api/client.go `do` function).
    let url = format!("https://ollama.com/api/me?ts={ts}");

    let resp = client
        .post(&url)
        .header("Authorization", auth_header)
        // Server requires Content-Length even for empty POST bodies.
        .body("")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to reach ollama.com: {e}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Auth(format!(
            "Profile fetch failed (HTTP {}). Please sign in again.",
            resp.status()
        )));
    }

    let body = resp
        .text()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read profile response: {e}")))?;

    // Server returns all fields but Name/Email may be empty strings if the key
    // is not linked to an account. Treat that as an auth error so the UI can
    // prompt the user to sign in again.
    let profile: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::Internal(format!("Failed to parse profile JSON: {e}")))?;

    let name = profile["Name"]
        .as_str()
        .or_else(|| profile["name"].as_str())
        .unwrap_or("")
        .to_string();

    let email = profile["Email"]
        .as_str()
        .or_else(|| profile["email"].as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    if name.is_empty() {
        return Err(AppError::Auth(
            "Key not linked to an Ollama account — please run 'ollama signin' again.".into(),
        ));
    }

    Ok(OllamaUserProfile {
        name,
        email,
        plan: profile["Plan"]
            .as_str()
            .or_else(|| profile["plan"].as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string()),
    })
}

/// Parse an unencrypted OpenSSH ed25519 private key file.
/// Returns (ssh_wire_pubkey_bytes, ed25519_seed_32_bytes).
///
/// Wire format ref: https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.key
fn parse_openssh_ed25519(pem: &[u8]) -> Result<(Vec<u8>, [u8; 32]), AppError> {
    let pem_str = std::str::from_utf8(pem)
        .map_err(|_| AppError::Internal("Key file is not valid UTF-8".into()))?;

    let b64: String = pem_str
        .lines()
        .filter(|l| !l.starts_with("-----"))
        .collect();

    let data = STANDARD
        .decode(b64.trim())
        .map_err(|_| AppError::Internal("Invalid base64 in key file".into()))?;

    const MAGIC: &[u8] = b"openssh-key-v1\0";
    if !data.starts_with(MAGIC) {
        return Err(AppError::Internal("Not an OpenSSH private key".into()));
    }
    let mut pos = MAGIC.len();

    // cipher_name, kdf_name, kdf_options
    for _ in 0..3 {
        let (_, n) = ssh_read_string(&data, pos)?;
        pos += n;
    }

    // number of keys (uint32) — skip
    pos += 4;

    // public key blob (first key) — this is the SSH wire format we need
    let (pub_wire, n) = ssh_read_string(&data, pos)?;
    pos += n;

    // private keys blob
    let (priv_blob, _) = ssh_read_string(&data, pos)?;
    let mut pp = 0usize;

    // checkint1, checkint2
    pp += 8;

    // key type string
    let (key_type, n) = ssh_read_string(priv_blob, pp)?;
    if key_type != b"ssh-ed25519" {
        return Err(AppError::Auth("Expected an ed25519 key".into()));
    }
    pp += n;

    // public key bytes inside private blob (skip — we already have pub_wire)
    let (_, n) = ssh_read_string(priv_blob, pp)?;
    pp += n;

    // private key: 64 bytes = seed[0..32] || pubkey[32..64]
    let (priv_bytes, _) = ssh_read_string(priv_blob, pp)?;
    if priv_bytes.len() < 32 {
        return Err(AppError::Internal("Private key seed too short".into()));
    }

    let seed: [u8; 32] = priv_bytes[..32]
        .try_into()
        .map_err(|_| AppError::Internal("Failed to extract ed25519 seed".into()))?;

    Ok((pub_wire.to_vec(), seed))
}

/// Read a length-prefixed SSH string at `pos` in `data`.
/// Returns (&content_bytes, total_bytes_consumed_including_4_byte_length).
fn ssh_read_string(data: &[u8], pos: usize) -> Result<(&[u8], usize), AppError> {
    if data.len() < pos + 4 {
        return Err(AppError::Internal("Unexpected end of key data (length)".into()));
    }
    let len = u32::from_be_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]) as usize;
    if data.len() < pos + 4 + len {
        return Err(AppError::Internal("Unexpected end of key data (content)".into()));
    }
    Ok((&data[pos + 4..pos + 4 + len], 4 + len))
}
