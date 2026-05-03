use crate::db::DbConn;
use crate::error::AppError;
use reqwest::{Client, RequestBuilder};

/// Returns true if `url` points to the Ollama Cloud API endpoint.
/// Cloud hosts use the global API key rather than a per-host OAuth token.
pub fn is_cloud_host(url: &str) -> bool {
    url::Url::parse(url)
        .ok()
        .filter(|u| u.scheme() == "https")
        .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
        .map(|h| h == "api.ollama.com")
        .unwrap_or(false)
}

#[derive(Clone)]
pub struct OllamaClient {
    pub http: Client,
    pub base_url: String,
    pub auth_token: Option<String>,
}

impl OllamaClient {
    /// Create a new client manually
    pub fn new(http: Client, base_url: String, auth_token: Option<String>) -> Self {
        Self {
            http,
            base_url,
            auth_token,
        }
    }

    /// Read the active host from the database and retrieve its auth token from the system keyring.
    ///
    /// For cloud hosts (`api.ollama.com`), the global API key stored under
    /// [`crate::auth::keyring::API_KEY_ACCOUNT`] is used instead of a per-host OAuth token.
    /// Returns [`AppError::Auth`] with a user-friendly message if the cloud API key is missing.
    pub async fn from_state(http: Client, db: DbConn) -> Result<Self, AppError> {
        let (host, config_token) = tokio::task::spawn_blocking(move || {
            let conn = db
                .lock()
                .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
            let hosts = crate::db::hosts::list_all(&conn)?;
            let host = hosts
                .into_iter()
                .find(|h| h.is_active)
                .ok_or_else(|| AppError::NotFound("No active host".to_string()))?;

            let token = if is_cloud_host(&host.url) {
                crate::auth::keyring::get_token(crate::auth::keyring::API_KEY_ACCOUNT)
                    .unwrap_or(None)
            } else {
                crate::auth::keyring::get_token(&host.id).unwrap_or(None)
            };

            Ok::<_, AppError>((host, token))
        })
        .await??;

        if is_cloud_host(&host.url) && config_token.is_none() {
            return Err(AppError::Auth(
                "Cloud model requires an API key. Go to Settings → Account to add one.".into(),
            ));
        }

        Ok(Self {
            http,
            base_url: host.url,
            auth_token: config_token,
        })
    }

    fn attach_auth(&self, builder: RequestBuilder) -> RequestBuilder {
        if let Some(token) = &self.auth_token {
            builder.bearer_auth(token)
        } else {
            builder
        }
    }

    pub fn get(&self, path: &str) -> RequestBuilder {
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        self.attach_auth(self.http.get(&url))
    }

    pub fn post(&self, path: &str) -> RequestBuilder {
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        self.attach_auth(self.http.post(&url))
    }

    pub fn delete(&self, path: &str) -> RequestBuilder {
        let url = format!("{}{}", self.base_url.trim_end_matches('/'), path);
        self.attach_auth(self.http.delete(&url))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_cloud_host_detects_api_ollama_com() {
        assert!(is_cloud_host("https://api.ollama.com"));
        assert!(is_cloud_host("https://api.ollama.com/"));
    }

    #[test]
    fn test_is_cloud_host_does_not_flag_local() {
        assert!(!is_cloud_host("http://localhost:11434"));
        assert!(!is_cloud_host("http://127.0.0.1:11434"));
        assert!(!is_cloud_host("http://192.168.1.10:11434"));
        assert!(!is_cloud_host("https://my.custom-ollama.example.com"));
        // Plaintext HTTP to cloud host must not be classified as cloud — key would leak.
        assert!(!is_cloud_host("http://api.ollama.com"));
        // Subdomain-prefix attack: hostname contains "api.ollama.com" as a substring
        // but is a different domain. Must not be classified as cloud.
        assert!(!is_cloud_host("https://api.ollama.com.attacker.tld"));
        assert!(!is_cloud_host(
            "https://api.ollama.com.attacker.tld/api/chat"
        ));
    }
}
