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
    #![allow(clippy::unwrap_used)] // proptest! bodies must be infallible expressions

    use super::*;
    use proptest::prelude::*;

    // Argon2 is expensive; default 256 cases would make pre-push/CI take many minutes.
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(8))]

        #[test]
        fn prop_hash_and_verify_roundtrip(password in ".{8,64}") {
            let hash = hash_login_password(&password).unwrap();
            prop_assert!(verify_login_password(&password, &hash).unwrap());
        }

        #[test]
        fn prop_different_passwords_different_hashes(p1 in ".{8,32}", p2 in ".{8,32}") {
            prop_assume!(p1 != p2);
            let h1 = hash_login_password(&p1).unwrap();
            let h2 = hash_login_password(&p2).unwrap();
            prop_assert_ne!(h1, h2);
        }

        #[test]
        fn prop_wrong_password_fails(password in ".{8,32}", wrong in ".{8,32}") {
            prop_assume!(password != wrong);
            let hash = hash_login_password(&password).unwrap();
            prop_assert!(!verify_login_password(&wrong, &hash).unwrap());
        }
    }

    #[test]
    fn test_hash_and_verify_basic() -> Result<(), argon2::password_hash::Error> {
        let password = "correct horse battery staple";
        let hash = hash_login_password(password)?;
        assert!(verify_login_password(password, &hash)?);
        assert!(!verify_login_password("wrong password", &hash)?);
        Ok(())
    }
}
