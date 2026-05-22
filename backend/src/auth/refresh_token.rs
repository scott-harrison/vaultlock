use sha2::{Digest, Sha256};

/// Deterministic SHA-256 hash for refresh token storage and lookup.
/// Refresh JWTs are high-entropy; a fast hash is acceptable here.
#[must_use]
pub fn hash_refresh_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_stable_for_same_token() {
        assert_eq!(hash_refresh_token("abc"), hash_refresh_token("abc"));
    }

    #[test]
    fn hash_differs_for_different_tokens() {
        assert_ne!(hash_refresh_token("abc"), hash_refresh_token("def"));
    }
}
