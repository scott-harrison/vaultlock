pub mod jwt;

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};

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

#[derive(Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub message: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> (StatusCode, Json<AuthResponse>) {
    tracing::debug!(email = %payload.email, "register attempt");
    let repo = UserRepository::new(state.db.clone());

    if repo.email_exists(&payload.email).await.unwrap_or(false) {
        return (
            StatusCode::CONFLICT,
            Json(AuthResponse {
                access_token: String::new(),
                refresh_token: String::new(),
                message: "Email already registered".to_string(),
            }),
        );
    }

    if let Err(e) = validate_master_password_hash(&payload.master_password_hash) {
        tracing::warn!(?e, "invalid master password hash format");
        return (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                access_token: String::new(),
                refresh_token: String::new(),
                message: "Invalid master password hash format".to_string(),
            }),
        );
    }

    let create_user = CreateUser {
        email: payload.email,
        master_password_hash: payload.master_password_hash,
    };

    match repo.create(create_user).await {
        Ok(user) => match issue_tokens(user.id) {
            Ok((access_token, refresh_token)) => (
                StatusCode::CREATED,
                Json(AuthResponse {
                    access_token,
                    refresh_token,
                    message: "User registered successfully".to_string(),
                }),
            ),
            Err(e) => {
                tracing::warn!(?e, "failed to issue tokens");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(AuthResponse {
                        access_token: String::new(),
                        refresh_token: String::new(),
                        message: "Failed to issue tokens".to_string(),
                    }),
                )
            }
        },
        Err(e) => {
            tracing::warn!(?e, "failed to create user");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthResponse {
                    access_token: String::new(),
                    refresh_token: String::new(),
                    message: "Failed to create user".to_string(),
                }),
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
                Json(AuthResponse {
                    access_token: String::new(),
                    refresh_token: String::new(),
                    message: "Database error".to_string(),
                }),
            );
        }
    };

    let is_valid =
        verify_master_password_hash(&payload.master_password_hash, &user.master_password_hash);

    if is_valid {
        state.login_delay.clear(&payload.email).await;
        match issue_tokens(user.id) {
            Ok((access_token, refresh_token)) => (
                StatusCode::OK,
                Json(AuthResponse {
                    access_token,
                    refresh_token,
                    message: "Login successful".to_string(),
                }),
            ),
            Err(e) => {
                tracing::warn!(?e, "failed to issue tokens");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(AuthResponse {
                        access_token: String::new(),
                        refresh_token: String::new(),
                        message: "Failed to issue tokens".to_string(),
                    }),
                )
            }
        }
    } else {
        state.login_delay.record_failure(&payload.email).await;
        invalid_credentials()
    }
}

fn invalid_credentials() -> (StatusCode, Json<AuthResponse>) {
    (
        StatusCode::UNAUTHORIZED,
        Json(AuthResponse {
            access_token: String::new(),
            refresh_token: String::new(),
            message: "Invalid credentials".to_string(),
        }),
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
