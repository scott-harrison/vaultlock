pub mod jwt;

use axum::{extract::State, http::StatusCode, Json};
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

#[derive(Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub message: String,
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
            }),
        );
    }

    let login_hash = match hash_login_password(&payload.password) {
        Ok(hash) => hash,
        Err(e) => {
            tracing::warn!(?e, "password hashing failed");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(RegisterResponse {
                    message: "Failed to hash password".to_string(),
                }),
            );
        }
    };

    let verification_token = Uuid::new_v4().to_string();

    let create_user = CreateUser {
        email: payload.email.clone(),
        login_hash,
        verification_token: verification_token.clone(),
    };

    match repo.create(create_user).await {
        Ok(_) => {
            // Send verification email via Resend
            if let Err(e) = send_verification_email(&payload.email, &verification_token).await {
                tracing::error!(?e, "Failed to send verification email");
            }

            (
                StatusCode::CREATED,
                Json(RegisterResponse {
                    message:
                        "Registration successful. Please check your email to verify your account."
                            .to_string(),
                }),
            )
        }
        Err(e) => {
            tracing::warn!(?e, "failed to create user");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(RegisterResponse {
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

    if !user.email_verified {
        return (
            StatusCode::FORBIDDEN,
            Json(AuthResponse {
                access_token: String::new(),
                refresh_token: String::new(),
                message: "Email not verified. Please check your email and verify your account."
                    .to_string(),
            }),
        );
    }

    let is_valid = verify_login_password(&payload.password, &user.login_hash).unwrap_or(false);

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

pub async fn verify_email(
    State(state): State<AppState>,
    Json(payload): Json<VerifyEmailRequest>,
) -> (StatusCode, Json<AuthResponse>) {
    tracing::debug!(token = %payload.token, "email verification attempt");
    let repo = UserRepository::new(state.db.clone());

    match repo.verify_email(&payload.token).await {
        Ok(Some(user)) => match issue_tokens(user.id) {
            Ok((access_token, refresh_token)) => (
                StatusCode::OK,
                Json(AuthResponse {
                    access_token,
                    refresh_token,
                    message: "Email verified successfully".to_string(),
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
        Ok(None) => (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                access_token: String::new(),
                refresh_token: String::new(),
                message: "Invalid or expired verification token".to_string(),
            }),
        ),
        Err(e) => {
            tracing::warn!(?e, "database error during verification");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthResponse {
                    access_token: String::new(),
                    refresh_token: String::new(),
                    message: "Database error".to_string(),
                }),
            )
        }
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

/// Sends verification email using Resend
async fn send_verification_email(email: &str, token: &str) -> anyhow::Result<()> {
    let api_key = std::env::var("RESEND_API_KEY")
        .map_err(|_| anyhow::anyhow!("RESEND_API_KEY must be set for email verification"))?;

    let verify_url = format!("https://your-domain.com/verify?token={token}");

    let payload = serde_json::json!({
        "from": "Vaultlock <onboarding@resend.dev>",
        "to": [email],
        "subject": "Verify your Vaultlock account",
        "html": format!(
            r#"
            <h2>Welcome to Vaultlock!</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="{}">Verify Email</a></p>
            <p>If you did not create this account, you can safely ignore this email.</p>
            "#,
            verify_url
        )
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.resend.com/emails")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await?;

    if response.status().is_success() {
        tracing::info!(email = %email, "Verification email sent successfully via Resend");
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        tracing::error!(
            email = %email,
            status = %status,
            error = %error_text,
            "Failed to send verification email via Resend"
        );
        anyhow::bail!("Resend API returned {status}: {error_text}");
    }
}
