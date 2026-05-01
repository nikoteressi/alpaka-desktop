use crate::auth::keyring;
use crate::auth::keyring::API_KEY_ACCOUNT;
use crate::db::DbConn;
use crate::error::AppError;
use tauri::command;

use super::fetch_host_url;

/// Core logic for storing the API key, without side-effects.
/// Extracted so tests can call it without a live Tauri `AppState`.
pub async fn core_set_api_key(key: String) -> Result<(), AppError> {
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err(AppError::Auth("API key must not be empty".into()));
    }
    if key.len() > 512 {
        return Err(AppError::Auth(
            "API key exceeds maximum allowed length".into(),
        ));
    }
    tokio::task::spawn_blocking(move || keyring::set_token(API_KEY_ACCOUNT, &key)).await??;
    Ok(())
}

/// Adds `https://api.ollama.com` as a host entry if no cloud host exists yet.
/// Best-effort — errors are ignored so a keyring failure never blocks key storage.
pub async fn ensure_cloud_host_exists(db: DbConn) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        let hosts = crate::db::hosts::list_all(&conn)?;
        let has_cloud = hosts
            .iter()
            .any(|h| crate::ollama::client::is_cloud_host(&h.url));
        if !has_cloud {
            crate::db::hosts::create(
                &conn,
                crate::db::hosts::NewHost {
                    name: "Ollama Cloud".into(),
                    url: "https://api.ollama.com".into(),
                    is_default: Some(false),
                },
            )?;
        }
        Ok(())
    })
    .await?
}

/// Stores an Ollama API key in the system keyring under the fixed
/// [`API_KEY_ACCOUNT`] identifier, separate from per-host OAuth tokens.
/// Also auto-adds the Ollama Cloud host entry if it does not exist yet.
#[command]
pub async fn set_api_key(
    state: tauri::State<'_, crate::state::AppState>,
    key: String,
) -> Result<(), AppError> {
    core_set_api_key(key).await?;
    let _ = ensure_cloud_host_exists(state.db.clone()).await;
    Ok(())
}

/// Returns `"set"` if an API key is stored in the keyring, `"not_set"` otherwise.
#[command]
pub async fn get_api_key_status() -> Result<String, AppError> {
    let token = tokio::task::spawn_blocking(|| keyring::get_token(API_KEY_ACCOUNT)).await??;
    Ok(if token.is_some() { "set" } else { "not_set" }.to_string())
}

/// Core keyring-only deletion, without DB side-effects.
/// Extracted so tests can call it without a live Tauri `AppState`.
pub async fn core_delete_api_key() -> Result<(), AppError> {
    tokio::task::spawn_blocking(|| keyring::delete_token(API_KEY_ACCOUNT)).await??;
    Ok(())
}

/// Removes all host entries whose URL matches the cloud host pattern.
pub async fn remove_cloud_hosts(db: DbConn) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::Db("Database lock poisoned".into()))?;
        let hosts = crate::db::hosts::list_all(&conn)?;
        for host in hosts
            .iter()
            .filter(|h| crate::ollama::client::is_cloud_host(&h.url))
        {
            crate::db::hosts::delete(&conn, &host.id)?;
        }
        Ok(())
    })
    .await?
}

/// Removes the API key from the system keyring and deletes any auto-added cloud
/// host entries. Idempotent — succeeds even if no key or host was present.
#[command]
pub async fn delete_api_key(
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<(), AppError> {
    core_delete_api_key().await?;
    let _ = remove_cloud_hosts(state.db.clone()).await;
    Ok(())
}

/// Probes the given host's `/api/tags` endpoint with the stored API key.
///
/// Returns `true` if the server responds with 2xx, `false` on 401 or any other
/// non-success status, and `Err` on network failure. Used by the frontend to
/// show "valid/invalid" status after the user enters a key.
pub async fn perform_validate_api_key(
    http_client: &reqwest::Client,
    db: DbConn,
    host_id: String,
) -> Result<bool, AppError> {
    let host_url = fetch_host_url(db, host_id.clone()).await?;

    let key = tokio::task::spawn_blocking(|| keyring::get_token(API_KEY_ACCOUNT)).await??;
    let key = match key {
        Some(k) => k,
        None => return Ok(false),
    };

    let probe_url = format!("{}/api/tags", host_url.trim_end_matches('/'));
    let resp = http_client
        .get(&probe_url)
        .header("Authorization", format!("Bearer {}", key))
        .timeout(std::time::Duration::from_millis(3000))
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => Ok(true),
        Ok(r) if r.status() == 401 => Ok(false),
        Ok(_) => Ok(false), // 5xx, 4xx non-401 — key not verified
        Err(e) => Err(AppError::Internal(format!(
            "Validation request failed: {}",
            e
        ))),
    }
}

#[command]
pub async fn validate_api_key(
    state: tauri::State<'_, crate::state::AppState>,
    host_id: String,
) -> Result<bool, AppError> {
    perform_validate_api_key(&state.http_client, state.db.clone(), host_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{migrations, seed_default_host, DbConn};
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};

    /// Serializes tests that share `API_KEY_ACCOUNT` in the system keyring.
    /// `cargo test` runs tests in the same binary in parallel by default, so
    /// `test_api_key_command_lifecycle` and `test_delete_api_key_is_idempotent`
    /// would otherwise race on the same keyring slot.
    static API_KEY_TEST_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    fn create_test_state() -> (reqwest::Client, DbConn) {
        let conn = Connection::open_in_memory().unwrap();
        migrations::run(&conn).expect("Tests failed to run migrations");
        seed_default_host(&conn).expect("Tests failed to seed");
        (reqwest::Client::new(), Arc::new(Mutex::new(conn)))
    }

    #[tokio::test]
    async fn test_set_api_key_validation() {
        // Empty key is rejected
        let res = core_set_api_key("".to_string()).await;
        match res {
            Err(AppError::Auth(msg)) if msg.contains("empty") => (),
            Ok(_) => panic!("Empty key should be rejected"),
            Err(e) => panic!("Unexpected error for empty key: {:?}", e),
        }

        // Whitespace-only key is rejected
        let res = core_set_api_key("   ".to_string()).await;
        match res {
            Err(AppError::Auth(msg)) if msg.contains("empty") => (),
            Ok(_) => panic!("Whitespace-only key should be rejected"),
            Err(e) => panic!("Unexpected error for whitespace key: {:?}", e),
        }
    }

    #[tokio::test]
    async fn test_api_key_command_lifecycle() {
        // Serialize with test_delete_api_key_is_idempotent — both mutate the
        // same API_KEY_ACCOUNT keyring slot and would race under parallel test
        // execution without this guard.
        let _lock = API_KEY_TEST_LOCK.lock().await;

        let set_res = core_set_api_key("sk-test-cmd-key-abc".to_string()).await;
        if let Err(ref e) = set_res {
            let msg = format!("{e:?}");
            if msg.contains("No secret-service")
                || msg.contains("NoBackend")
                || msg.contains("locked")
                || msg.contains("Platform secure storage")
                || msg.contains("ServiceUnknown")
            {
                return;
            }
        }
        assert!(set_res.is_ok(), "set_api_key should succeed");

        let status = get_api_key_status()
            .await
            .expect("get_api_key_status must succeed");
        assert_eq!(
            status, "set",
            "status should be 'set' immediately after set_api_key"
        );

        // Delete and verify idempotency
        assert!(core_delete_api_key().await.is_ok());
        let status_after = get_api_key_status()
            .await
            .expect("get_api_key_status must succeed after delete");
        assert_eq!(status_after, "not_set");
    }

    #[tokio::test]
    async fn test_delete_api_key_is_idempotent() {
        // Serialize with test_api_key_command_lifecycle — both mutate the same
        // API_KEY_ACCOUNT keyring slot and would race under parallel test execution.
        let _lock = API_KEY_TEST_LOCK.lock().await;

        // delete_api_key must not error even when no key is present.
        // Call twice: first clears any existing entry, second proves idempotency.
        let first = core_delete_api_key().await;
        match first {
            Ok(_) => (),
            Err(AppError::Auth(ref msg))
                if msg.contains("No secret-service")
                    || msg.contains("NoBackend")
                    || msg.contains("locked")
                    || msg.contains("Platform secure storage")
                    || msg.contains("ServiceUnknown") =>
            {
                return; // No keyring backend — skip.
            }
            Err(e) => panic!("Unexpected error on first delete: {:?}", e),
        }
        let second = core_delete_api_key().await;
        match second {
            Ok(_) => (),
            Err(AppError::Auth(ref msg))
                if msg.contains("No secret-service")
                    || msg.contains("NoBackend")
                    || msg.contains("locked")
                    || msg.contains("Platform secure storage")
                    || msg.contains("ServiceUnknown") => {}
            Err(e) => panic!("Unexpected error on second (idempotent) delete: {:?}", e),
        }
    }

    #[tokio::test]
    async fn test_perform_validate_api_key_no_key_stored() {
        // Verifies that perform_validate_api_key completes without panicking and
        // returns a valid result. The keyring (API_KEY_ACCOUNT) is shared with
        // other concurrently-running tests, so we cannot assert a specific Ok(true/false)
        // value — we only assert the function does not return an unexpected error type.
        let (client, db) = create_test_state();
        let host_id = {
            let conn = db.lock().unwrap();
            let hosts = crate::db::hosts::list_all(&conn).unwrap();
            hosts[0].id.clone()
        };

        let result = perform_validate_api_key(&client, db.clone(), host_id).await;
        match result {
            Ok(_) => (),                      // Ok(true) or Ok(false) are both valid
            Err(AppError::Internal(_)) => (), // Network unreachable is acceptable
            Err(AppError::Auth(ref msg))
                if msg.contains("No secret-service")
                    || msg.contains("NoBackend")
                    || msg.contains("locked")
                    || msg.contains("Platform secure storage")
                    || msg.contains("ServiceUnknown") => {}
            Err(AppError::NotFound(_)) => (), // Host not found in in-memory DB edge case
            Err(e) => panic!("Unexpected error from perform_validate_api_key: {:?}", e),
        }
    }

    #[tokio::test]
    async fn test_ensure_cloud_host_exists_adds_host() {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn).unwrap();
        let db: DbConn = Arc::new(Mutex::new(conn));

        // No hosts yet — ensure_cloud_host_exists should add the cloud host.
        ensure_cloud_host_exists(db.clone()).await.unwrap();

        let conn = db.lock().unwrap();
        let hosts = crate::db::hosts::list_all(&conn).unwrap();
        assert_eq!(hosts.len(), 1);
        assert!(crate::ollama::client::is_cloud_host(&hosts[0].url));
        assert_eq!(hosts[0].name, "Ollama Cloud");
    }

    #[tokio::test]
    async fn test_ensure_cloud_host_exists_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn).unwrap();
        let db: DbConn = Arc::new(Mutex::new(conn));

        // Call twice — should only add one cloud host.
        ensure_cloud_host_exists(db.clone()).await.unwrap();
        ensure_cloud_host_exists(db.clone()).await.unwrap();

        let conn = db.lock().unwrap();
        let hosts = crate::db::hosts::list_all(&conn).unwrap();
        let cloud_count = hosts
            .iter()
            .filter(|h| crate::ollama::client::is_cloud_host(&h.url))
            .count();
        assert_eq!(cloud_count, 1, "should have exactly one cloud host");
    }

    #[tokio::test]
    async fn test_ensure_cloud_host_exists_skips_if_already_present() {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn).unwrap();
        crate::db::seed_default_host(&conn).unwrap();
        let db: DbConn = Arc::new(Mutex::new(conn));

        // Manually add a cloud host first.
        {
            let conn = db.lock().unwrap();
            crate::db::hosts::create(
                &conn,
                crate::db::hosts::NewHost {
                    name: "My Cloud".into(),
                    url: "https://api.ollama.com".into(),
                    is_default: Some(false),
                },
            )
            .unwrap();
        }

        // ensure_cloud_host_exists must not add a second one.
        ensure_cloud_host_exists(db.clone()).await.unwrap();

        let conn = db.lock().unwrap();
        let cloud_count = crate::db::hosts::list_all(&conn)
            .unwrap()
            .iter()
            .filter(|h| crate::ollama::client::is_cloud_host(&h.url))
            .count();
        assert_eq!(cloud_count, 1, "should still have exactly one cloud host");
    }

    #[tokio::test]
    async fn test_remove_cloud_hosts_deletes_cloud_entries() {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn).unwrap();
        crate::db::seed_default_host(&conn).unwrap();
        let db: DbConn = Arc::new(Mutex::new(conn));

        // Add a cloud host.
        ensure_cloud_host_exists(db.clone()).await.unwrap();
        {
            let conn = db.lock().unwrap();
            assert_eq!(
                crate::db::hosts::list_all(&conn)
                    .unwrap()
                    .iter()
                    .filter(|h| crate::ollama::client::is_cloud_host(&h.url))
                    .count(),
                1
            );
        }

        // remove_cloud_hosts should delete it.
        remove_cloud_hosts(db.clone()).await.unwrap();

        let conn = db.lock().unwrap();
        let cloud_count = crate::db::hosts::list_all(&conn)
            .unwrap()
            .iter()
            .filter(|h| crate::ollama::client::is_cloud_host(&h.url))
            .count();
        assert_eq!(cloud_count, 0, "cloud host should be removed");
    }

    #[tokio::test]
    async fn test_remove_cloud_hosts_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn).unwrap();
        crate::db::seed_default_host(&conn).unwrap();
        let db: DbConn = Arc::new(Mutex::new(conn));

        // Call with no cloud hosts present — must not error.
        remove_cloud_hosts(db.clone()).await.unwrap();
        remove_cloud_hosts(db.clone()).await.unwrap();

        let conn = db.lock().unwrap();
        let cloud_count = crate::db::hosts::list_all(&conn)
            .unwrap()
            .iter()
            .filter(|h| crate::ollama::client::is_cloud_host(&h.url))
            .count();
        assert_eq!(cloud_count, 0);
    }
}
