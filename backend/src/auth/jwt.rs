use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Clone)]
pub struct JwtConfig {
    pub secret: String,
    pub access_token_expiry_minutes: i64,
    pub refresh_token_expiry_days: i64,
}

impl JwtConfig {
    /// Load JWT settings from environment (`JWT_SECRET`).
    ///
    /// # Errors
    ///
    /// Returns [`std::env::VarError`] when `JWT_SECRET` is not set.
    pub fn from_env() -> Result<Self, std::env::VarError> {
        Ok(Self {
            secret: std::env::var("JWT_SECRET")?,
            access_token_expiry_minutes: 15,
            refresh_token_expiry_days: 7,
        })
    }
}

/// Create a signed JWT access token for `user_id`.
///
/// # Errors
///
/// Returns [`jsonwebtoken::errors::Error`] when encoding fails.
pub fn generate_access_token(
    user_id: Uuid,
    config: &JwtConfig,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::minutes(config.access_token_expiry_minutes);

    let claims = Claims {
        sub: user_id,
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.secret.as_bytes()),
    )
}

/// Create a signed JWT refresh token for `user_id`.
///
/// # Errors
///
/// Returns [`jsonwebtoken::errors::Error`] when encoding fails.
pub fn generate_refresh_token(
    user_id: Uuid,
    config: &JwtConfig,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::days(config.refresh_token_expiry_days);

    let claims = Claims {
        sub: user_id,
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.secret.as_bytes()),
    )
}

/// Decode and validate a JWT, returning its claims.
///
/// # Errors
///
/// Returns [`jsonwebtoken::errors::Error`] when the token is invalid or expired.
pub fn validate_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> JwtConfig {
        JwtConfig {
            secret: "test-secret".to_string(),
            access_token_expiry_minutes: 15,
            refresh_token_expiry_days: 7,
        }
    }

    #[test]
    fn access_token_round_trip() -> Result<(), jsonwebtoken::errors::Error> {
        let user_id = Uuid::new_v4();
        let config = test_config();
        let token = generate_access_token(user_id, &config)?;
        let claims = validate_token(&token, &config.secret)?;
        assert_eq!(claims.sub, user_id);
        Ok(())
    }
}
