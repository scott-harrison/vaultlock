pub mod jwt;

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::jwt::{generate_access_token, generate_refresh_token, JwtConfig},
    crypto::argon2::{validate_master_password_hash, verify_master_password_hash},
    models::user::CreateUser,
    repositories::user_repository::UserRepository,
    AppState,
};

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub master_password_hash: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub master_password_hash: String,
}

#[derive(Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub message: String,
    pub email: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    /// JWT access token alias for API consumers expecting a `token` field.
    pub token: String,
    pub refresh_token: String,
    pub message: String,
}

impl AuthResponse {
    fn new(access_token: String, refresh_token: String, message: String) -> Self {
        Self {
            token: access_token.clone(),
            access_token,
            refresh_token,
            message,
        }
    }

    #[allow(clippy::missing_const_for_fn)]
    fn error(message: String) -> Self {
        Self {
            access_token: String::new(),
            token: String::new(),
            refresh_token: String::new(),
            message,
        }
    }
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> (StatusCode, Json<RegisterResponse>) {
    tracing::debug!(email = %payload.email, "register attempt");
    let repo = UserRepository::new(state.db.clone());

    if repo.email_exists(&payload.email).await.unwrap_or(false) {
        return (
            StatusCode::CONFLICT,
            Json(RegisterResponse {
                message: "Email already registered".to_string(),
                email: payload.email,
            }),
        );
    }

    if let Err(e) = validate_master_password_hash(&payload.master_password_hash) {
        tracing::warn!(?e, "invalid master password hash format");
        return (
            StatusCode::BAD_REQUEST,
            Json(RegisterResponse {
                message: "Invalid master password hash format".to_string(),
                email: payload.email,
            }),
        );
    }

    let verification_token = Uuid::new_v4().to_string();
    stub_send_verification_email(&payload.email, &verification_token);

    let create_user = CreateUser {
        email: payload.email.clone(),
        master_password_hash: payload.master_password_hash,
        verification_token,
    };

    match repo.create(create_user).await {
        Ok(_user) => (
            StatusCode::CREATED,
            Json(RegisterResponse {
                message: "Registration successful. Please verify your email.".to_string(),
                email: payload.email,
            }),
        ),
        Err(e) => {
            tracing::warn!(?e, "failed to create user");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(RegisterResponse {
                    message: "Failed to create user".to_string(),
                    email: payload.email,
                }),
            )
        }
    }
}

pub async fn verify_email(
    State(state): State<AppState>,
    Json(payload): Json<VerifyEmailRequest>,
) -> (StatusCode, Json<AuthResponse>) {
    let repo = UserRepository::new(state.db.clone());

    match repo.verify_email(&payload.token).await {
        Ok(Some(user)) => match issue_tokens(user.id) {
            Ok((access_token, refresh_token)) => (
                StatusCode::OK,
                Json(AuthResponse::new(
                    access_token,
                    refresh_token,
                    "Email verified successfully".to_string(),
                )),
            ),
            Err(e) => {
                tracing::warn!(?e, "failed to issue tokens after verification");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(AuthResponse::error("Failed to issue tokens".to_string())),
                )
            }
        },
        Ok(None) => (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse::error(
                "Invalid or expired verification token".to_string(),
            )),
        ),
        Err(e) => {
            tracing::warn!(?e, "database error during email verification");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthResponse::error("Database error".to_string())),
            )
        }
    }
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> (StatusCode, Json<AuthResponse>) {
    tracing::debug!(email = %payload.email, "login attempt");
    state.login_delay.wait_before_login(&payload.email).await;

    let repo = UserRepository::new(state.db.clone());

    let user = match repo.find_by_email(&payload.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            state.login_delay.record_failure(&payload.email).await;
            return invalid_credentials();
        }
        Err(e) => {
            tracing::warn!(?e, "database error during login");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthResponse::error("Database error".to_string())),
            );
        }
    };

    if !user.email_verified {
        return (
            StatusCode::FORBIDDEN,
            Json(AuthResponse::error("Email not verified".to_string())),
        );
    }

    let is_valid =
        verify_master_password_hash(&payload.master_password_hash, &user.master_password_hash);

    if is_valid {
        state.login_delay.clear(&payload.email).await;
        match issue_tokens(user.id) {
            Ok((access_token, refresh_token)) => (
                StatusCode::OK,
                Json(AuthResponse::new(
                    access_token,
                    refresh_token,
                    "Login successful".to_string(),
                )),
            ),
            Err(e) => {
                tracing::warn!(?e, "failed to issue tokens");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(AuthResponse::error("Failed to issue tokens".to_string())),
                )
            }
        }
    } else {
        state.login_delay.record_failure(&payload.email).await;
        invalid_credentials()
    }
}

fn stub_send_verification_email(email: &str, token: &str) {
    tracing::info!(
        email = %email,
        token = %token,
        verify_url = %format!("/verify-email"),
        "email verification stub: would send verification email"
    );
}

fn invalid_credentials() -> (StatusCode, Json<AuthResponse>) {
    (
        StatusCode::UNAUTHORIZED,
        Json(AuthResponse::error("Invalid credentials".to_string())),
    )
}

fn issue_tokens(
    user_id: uuid::Uuid,
) -> Result<(String, String), Box<dyn std::error::Error + Send + Sync>> {
    let config = JwtConfig::from_env()?;
    let access_token = generate_access_token(user_id, &config)?;
    let refresh_token = generate_refresh_token(user_id, &config)?;
    Ok((access_token, refresh_token))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_response_includes_token_alias() {
        let response = AuthResponse::new(
            "access.jwt".to_string(),
            "refresh.jwt".to_string(),
            "ok".to_string(),
        );
        assert_eq!(response.token, response.access_token);
    }
}
