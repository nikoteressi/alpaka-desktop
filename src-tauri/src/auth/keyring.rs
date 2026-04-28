use crate::error::AppError;
use keyring::Entry;

pub const SERVICE_NAME: &str = "ollama-desktop";

/// Sets a bearer token in the system's secure credential store (keyring).
///
/// Under Linux, this uses the Secret Service API.
pub fn set_token(host_id: &str, token: &str) -> Result<(), AppError> {
    let entry = Entry::new(SERVICE_NAME, host_id)?;
    entry.set_password(token)?;
    Ok(())
}

/// Retrieves a bearer token from the system's secure credential store.
///
/// We first check our own service 'ollama-desktop'.
/// If not found, we check the official client's service 'ollama' (account 'cloud').
pub fn get_token(host_id: &str) -> Result<Option<String>, AppError> {
    // 1. Try our own service/identifier first
    let entry = Entry::new(SERVICE_NAME, host_id)?;
    match entry.get_password() {
        Ok(token) => return Ok(Some(token)),
        Err(keyring::Error::NoEntry) => (),
        Err(e) => return Err(AppError::from(e)),
    }

    // 2. If host_id is 'cloud', try official Ollama client's service name
    if host_id == "cloud" {
        // We only check the official 'ollama' service for 'cloud' or 'default' accounts
        // to avoid over-privileged scanning of the whole keyring.
        for service in &["ollama", "ollama-desktop"] {
            for account in &["cloud", "default"] {
                if let Ok(token) = Entry::new(service, account).and_then(|e| e.get_password()) {
                    log::info!("Found Ollama token for {}/{}", service, account);
                    return Ok(Some(token));
                }
            }
        }
    }

    Ok(None)
}

/// Returns true if the system keyring is accessible.
pub fn check_keyring_available() -> bool {
    match keyring::Entry::new("alpaka-desktop-health-check", "probe") {
        Ok(entry) => match entry.get_password() {
            Ok(_) | Err(keyring::Error::NoEntry) => true,
            Err(e) => {
                log::warn!("System keyring may be unavailable: {}", e);
                false
            }
        },
        Err(e) => {
            log::warn!("Cannot access system keyring backend: {}", e);
            false
        }
    }
}

/// Deletes a bearer token from the system's secure credential store.
///
/// Returns `Ok(())` even if the token did not exist.
pub fn delete_token(host_id: &str) -> Result<(), AppError> {
    let entry = Entry::new(SERVICE_NAME, host_id)?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::from(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_set_and_get_token_happy_path() {
        // Use a random UUID so tests don't collide or mess up user state
        let host_id = Uuid::new_v4().to_string();
        let test_token = "ollama_test_token_123";

        // In headless CI/environments, keyring might not be available,
        // so we tolerate NoBackend errors gracefully in tests or assert explicitly.
        let set_res = set_token(&host_id, test_token);

        if let Err(ref e) = set_res {
            let msg = format!("{e:?}");
            if msg.contains("No secret-service")
                || msg.contains("NoBackend")
                || msg.contains("locked")
                || msg.contains("Platform secure storage")
                || msg.contains("ServiceUnknown")
                || msg.contains("org.freedesktop")
            {
                return; // No Secret Service daemon in this environment
            }
        }

        // Assert we could set it
        assert!(set_res.is_ok(), "Setting token should succeed");

        // Assert we can read it back
        let retrieved = get_token(&host_id).expect("Should read back the token");
        assert_eq!(retrieved, Some(test_token.to_string()));

        // Delete it
        let del_res = delete_token(&host_id);
        assert!(del_res.is_ok(), "Deleting token should succeed");

        // Assert it's gone
        let retrieved_after =
            get_token(&host_id).expect("Should not fail when querying missing token");
        assert_eq!(retrieved_after, None);
    }

    #[test]
    fn test_get_nonexistent_token() {
        let host_id = Uuid::new_v4().to_string();

        let retrieved = get_token(&host_id);
        match retrieved {
            Ok(None) => (), // Expected
            Err(AppError::Auth(msg))
                if msg.contains("No secret-service")
                    || msg.contains("NoBackend")
                    || msg.contains("locked")
                    || msg.contains("Platform secure storage")
                    || msg.contains("ServiceUnknown") =>
            {
                ()
            }
            Ok(Some(_)) => panic!("Token shouldn't exist"),
            Err(e) => panic!("Unexpected error: {:?}", e),
        }
    }

    #[test]
    fn test_delete_nonexistent_token() {
        let host_id = Uuid::new_v4().to_string();

        let del_res = delete_token(&host_id);
        match del_res {
            Ok(_) => (), // Expected, should silently succeed
            Err(AppError::Auth(msg))
                if msg.contains("No secret-service")
                    || msg.contains("NoBackend")
                    || msg.contains("locked")
                    || msg.contains("Platform secure storage")
                    || msg.contains("ServiceUnknown") =>
            {
                ()
            }
            Err(e) => panic!("Unexpected error: {:?}", e),
        }
    }
}
