use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::jwt::{generate_access_token, generate_refresh_token, JwtConfig},
    crypto::argon2::{hash_login_password, verify_login_password},
    models::user::CreateUser,
    repositories::user_repository::UserRepository,
    AppState,
};

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
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
) -> Json<AuthResponse> {
    tracing::debug!(email = %payload.email, "register attempt");
    let repo = UserRepository::new(state.db.clone());

    if repo.email_exists(&payload.email).await.unwrap_or(false) {
        return Json(AuthResponse {
            access_token: String::new(),
            refresh_token: String::new(),
            message: "Email already registered".to_string(),
        });
    }

    let login_hash = match hash_login_password(&payload.password) {
        Ok(hash) => hash,
        Err(e) => {
            tracing::warn!(?e, "password hashing failed");
            return Json(AuthResponse {
                access_token: String::new(),
                refresh_token: String::new(),
                message: "Failed to hash password".to_string(),
            });
        }
    };

    let create_user = CreateUser {
        email: payload.email,
        login_hash,
    };

    match repo.create(create_user).await {
        Ok(user) => {
            let config = JwtConfig::default();
            let access_token = generate_access_token(user.id, &config).unwrap();
            let refresh_token = generate_refresh_token(user.id, &config).unwrap();

            Json(AuthResponse {
                access_token,
                refresh_token,
                message: "User registered successfully".to_string(),
            })
        }
        Err(e) => {
            tracing::warn!(?e, "failed to create user");
            Json(AuthResponse {
                access_token: String::new(),
                refresh_token: String::new(),
                message: "Failed to create user".to_string(),
            })
        }
    }
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Json<AuthResponse> {
    tracing::debug!(email = %payload.email, "login attempt");
    let repo = UserRepository::new(state.db.clone());

    let user = match repo.find_by_email(&payload.email).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Json(AuthResponse {
                access_token: String::new(),
                refresh_token: String::new(),
                message: "Invalid credentials".to_string(),
            });
        }
        Err(e) => {
            tracing::warn!(?e, "database error during login");
            return Json(AuthResponse {
                access_token: String::new(),
                refresh_token: String::new(),
                message: "Database error".to_string(),
            });
        }
    };

    let is_valid = verify_login_password(&payload.password, &user.login_hash).unwrap_or(false);

    if is_valid {
        let config = JwtConfig::default();
        let access_token = generate_access_token(user.id, &config).unwrap();
        let refresh_token = generate_refresh_token(user.id, &config).unwrap();

        Json(AuthResponse {
            access_token,
            refresh_token,
            message: "Login successful".to_string(),
        })
    } else {
        Json(AuthResponse {
            access_token: String::new(),
            refresh_token: String::new(),
            message: "Invalid credentials".to_string(),
        })
    }
}
