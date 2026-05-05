/// Parses `"slug:tag"` or `"slug"` (→ `"latest"` tag).
/// Returns `None` for cloud models (`:cloud` suffix), private models (`/` in name), or empty input.
pub(crate) fn parse_model_name(name: &str) -> Option<(String, String)> {
    if name.is_empty() || name.contains('/') {
        return None;
    }
    let (slug, tag) = name
        .split_once(':')
        .map(|(s, t)| (s.to_string(), t.to_string()))
        .unwrap_or_else(|| (name.to_string(), "latest".to_string()));
    if tag == "cloud" {
        return None;
    }
    Some((slug, tag))
}

/// Returns true when `local_digest` (sha256:hex64) does NOT start with `lib_hash` (short 7-12 hex).
/// A mismatch means a newer version is available.
pub(crate) fn digest_has_update(local_digest: &str, lib_hash: &str) -> bool {
    if lib_hash.is_empty() {
        return false;
    }
    let local_hex = local_digest.trim_start_matches("sha256:");
    !local_hex.starts_with(lib_hash)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_normal_model_with_tag() {
        assert_eq!(
            parse_model_name("llama3:8b"),
            Some(("llama3".into(), "8b".into()))
        );
    }

    #[test]
    fn parse_model_no_tag_defaults_to_latest() {
        assert_eq!(
            parse_model_name("llama3"),
            Some(("llama3".into(), "latest".into()))
        );
    }

    #[test]
    fn parse_model_with_dots_in_slug() {
        assert_eq!(
            parse_model_name("llama3.1:70b"),
            Some(("llama3.1".into(), "70b".into()))
        );
    }

    #[test]
    fn parse_cloud_model_returns_none() {
        assert_eq!(parse_model_name("llama3:cloud"), None);
    }

    #[test]
    fn parse_private_model_with_slash_returns_none() {
        assert_eq!(parse_model_name("user/private-model"), None);
    }

    #[test]
    fn parse_empty_returns_none() {
        assert_eq!(parse_model_name(""), None);
    }

    #[test]
    fn same_hash_means_no_update() {
        assert!(!digest_has_update("sha256:abc123def456789", "abc123d"));
    }

    #[test]
    fn different_hash_means_update_available() {
        assert!(digest_has_update("sha256:abc123def456789", "xyz789a"));
    }

    #[test]
    fn empty_lib_hash_means_no_update() {
        assert!(!digest_has_update("sha256:abc123def456789", ""));
    }

    #[test]
    fn digest_without_prefix_still_matches() {
        assert!(!digest_has_update("abc123def456789", "abc123d"));
    }
}
