use rand::RngCore;
use sha2::{Digest, Sha256};

/// Hashes a refresh token using SHA-256 + random salt
/// (Fast hash is acceptable for refresh tokens)
pub fn hash_refresh_token(token: &str) -> (String, String) {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);

    let mut hasher = Sha256::new();
    hasher.update(salt);
    hasher.update(token.as_bytes());
    let hash = hasher.finalize();

    (hex::encode(hash), hex::encode(salt))
}

/// Verifies a refresh token against stored hash + salt
pub fn verify_refresh_token(token: &str, hash: &str, salt: &str) -> bool {
    let salt_bytes = match hex::decode(salt) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let mut hasher = Sha256::new();
    hasher.update(&salt_bytes);
    hasher.update(token.as_bytes());
    let computed = hex::encode(hasher.finalize());

    computed == hash
}