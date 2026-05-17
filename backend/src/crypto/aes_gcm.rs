use aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand::RngCore;

/// Encrypts plaintext using AES-256-GCM
/// Returns (nonce, ciphertext)
pub fn encrypt(plaintext: &[u8], key: &[u8; 32]) -> Result<(Vec<u8>, Vec<u8>), aead::Error> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, plaintext)?;
    Ok((nonce_bytes.to_vec(), ciphertext))
}

/// Decrypts ciphertext using AES-256-GCM
pub fn decrypt(nonce: &[u8], ciphertext: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, aead::Error> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Nonce::from_slice(nonce);

    cipher.decrypt(nonce, ciphertext)
}

/// Wraps a DEK using the Master Key (AES-256-GCM)
pub fn wrap_dek(dek: &[u8; 32], master_key: &[u8; 32]) -> Result<(Vec<u8>, Vec<u8>), aead::Error> {
    encrypt(dek, master_key)
}

/// Unwraps a DEK using the Master Key
pub fn unwrap_dek(nonce: &[u8], wrapped_dek: &[u8], master_key: &[u8; 32]) -> Result<Vec<u8>, aead::Error> {
    decrypt(nonce, wrapped_dek, master_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let key = [0x42u8; 32];
        let plaintext = b"Hello, Vaultlock!";

        let (nonce, ciphertext) = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&nonce, &ciphertext, &key).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn wrap_unwrap_dek() {
        let master_key = [0x11u8; 32];
        let dek = [0x22u8; 32];

        let (nonce, wrapped) = wrap_dek(&dek, &master_key).unwrap();
        let unwrapped = unwrap_dek(&nonce, &wrapped, &master_key).unwrap();

        assert_eq!(unwrapped, dek.as_slice());
    }

    #[test]
    fn wrong_key_fails() {
        let key1 = [0x01u8; 32];
        let key2 = [0x02u8; 32];
        let plaintext = b"secret data";

        let (nonce, ciphertext) = encrypt(plaintext, &key1).unwrap();
        let result = decrypt(&nonce, &ciphertext, &key2);

        assert!(result.is_err());
    }
}