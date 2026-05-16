use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2, Params,
};

/// Recommended OWASP parameters for interactive login (~0.5-1s on modern hardware)
const ARGON2_MEMORY_KB: u32 = 19456; // 19 MiB
const ARGON2_ITERATIONS: u32 = 2;
const ARGON2_PARALLELISM: u32 = 1;

/// Hashes a password for login verification (server-side only)
pub fn hash_login_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        Params::new(
            ARGON2_MEMORY_KB,
            ARGON2_ITERATIONS,
            ARGON2_PARALLELISM,
            None,
        )?,
    );
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(password_hash.to_string())
}

/// Verifies a password against a stored hash (server-side only)
pub fn verify_login_password(
    password: &str,
    hash: &str,
) -> Result<bool, argon2::password_hash::Error> {
    let parsed_hash = PasswordHash::new(hash)?;
    let argon2 = Argon2::default();
    match argon2.verify_password(password.as_bytes(), &parsed_hash) {
        Ok(()) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() -> Result<(), argon2::password_hash::Error> {
        let password = "correct horse battery staple";
        let hash = hash_login_password(password)?;
        assert!(verify_login_password(password, &hash)?);
        assert!(!verify_login_password("wrong password", &hash)?);
        Ok(())
    }

    #[test]
    fn test_different_passwords_produce_different_hashes(
    ) -> Result<(), argon2::password_hash::Error> {
        let hash1 = hash_login_password("password1")?;
        let hash2 = hash_login_password("password2")?;
        assert_ne!(hash1, hash2);
        Ok(())
    }
}
