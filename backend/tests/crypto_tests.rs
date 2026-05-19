use vaultlock_backend::crypto::aes_gcm::{decrypt, encrypt, unwrap_dek, wrap_dek};

#[test]
fn test_encrypt_decrypt_roundtrip() {
    let key = [0x42u8; 32];
    let plaintext = b"Hello, Vaultlock! This is a test message.";

    let (nonce, ciphertext) = encrypt(plaintext, &key).unwrap();
    let decrypted = decrypt(&nonce, &ciphertext, &key).unwrap();

    assert_eq!(decrypted, plaintext);
}

#[test]
fn test_dek_wrapping() {
    let master_key = [0x11u8; 32];
    let dek = [0x22u8; 32];

    let (nonce, wrapped) = wrap_dek(&dek, &master_key).unwrap();
    let unwrapped = unwrap_dek(&nonce, &wrapped, &master_key).unwrap();

    assert_eq!(unwrapped, dek.as_slice());
}

#[test]
fn test_wrong_key_fails() {
    let key1 = [0x01u8; 32];
    let key2 = [0x02u8; 32];
    let plaintext = b"secret data that should not decrypt";

    let (nonce, ciphertext) = encrypt(plaintext, &key1).unwrap();
    let result = decrypt(&nonce, &ciphertext, &key2);

    assert!(result.is_err());
}

#[test]
fn test_empty_plaintext() {
    let key = [0x42u8; 32];
    let plaintext = b"";

    let (nonce, ciphertext) = encrypt(plaintext, &key).unwrap();
    let decrypted = decrypt(&nonce, &ciphertext, &key).unwrap();

    assert_eq!(decrypted, plaintext);
}

#[test]
fn test_large_data() {
    let key = [0x42u8; 32];
    let plaintext = vec![0xABu8; 10_000]; // 10KB of data

    let (nonce, ciphertext) = encrypt(&plaintext, &key).unwrap();
    let decrypted = decrypt(&nonce, &ciphertext, &key).unwrap();

    assert_eq!(decrypted, plaintext);
}