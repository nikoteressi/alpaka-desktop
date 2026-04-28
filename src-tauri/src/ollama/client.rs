use crate::db::DbConn;
use crate::error::AppError;
use reqwest::{Client, RequestBuilder};

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
            let token = crate::auth::keyring::get_token(&host.id).unwrap_or(None);
            Ok::<_, AppError>((host, token))
        })
        .await??;

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
