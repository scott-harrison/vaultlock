pub mod jwt;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Html,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::jwt::{generate_access_token, generate_refresh_token, JwtConfig},
    crypto::argon2::{
        validate_master_password_hash, verify_login_password, verify_master_password_hash,
    },
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
    /// Master password preimage — verified with Argon2 against the stored PHC (multi-device login).
    #[serde(default)]
    pub master_password: Option<String>,
    /// Legacy same-device login: exact PHC string from registration.
    #[serde(default)]
    pub master_password_hash: Option<String>,
}

#[derive(Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Deserialize)]
pub struct VerifyEmailOpenQuery {
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
    /// Stored Argon2 PHC — lets clients cache for offline unlock verification.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub master_password_hash: Option<String>,
}

impl AuthResponse {
    fn new(
        access_token: String,
        refresh_token: String,
        message: String,
        master_password_hash: Option<String>,
    ) -> Self {
        Self {
            token: access_token.clone(),
            access_token,
            refresh_token,
            message,
            master_password_hash,
        }
    }

    #[allow(clippy::missing_const_for_fn)]
    fn error(message: String) -> Self {
        Self {
            access_token: String::new(),
            token: String::new(),
            refresh_token: String::new(),
            message,
            master_password_hash: None,
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

    let create_user = CreateUser {
        email: payload.email.clone(),
        master_password_hash: payload.master_password_hash,
        verification_token: verification_token.clone(),
    };

    match repo.create(create_user).await {
        Ok(_user) => {
            if let Err(e) = send_verification_email(&payload.email, &verification_token).await {
                tracing::error!(?e, "failed to send verification email");
            }

            (
                StatusCode::CREATED,
                Json(RegisterResponse {
                    message:
                        "Registration successful. Please check your email to verify your account."
                            .to_string(),
                    email: payload.email,
                }),
            )
        }
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
        Ok(Some(user)) => {
            match issue_auth_success(&user, "Email verified successfully".to_string()) {
                Ok(response) => (StatusCode::OK, Json(response)),
                Err(e) => {
                    tracing::warn!(?e, "failed to issue tokens after verification");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(AuthResponse::error("Failed to issue tokens".to_string())),
                    )
                }
            }
        }
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

/// Browser landing page linked from verification emails.
///
/// Email clients only reliably hyperlink `http(s)://` URLs; this handler verifies
/// the account in the browser so users can return to the desktop app and sign in.
pub async fn verify_email_open(
    State(state): State<AppState>,
    Query(query): Query<VerifyEmailOpenQuery>,
) -> Html<String> {
    let token = query.token.trim();
    if token.is_empty() {
        return Html(verify_email_open_error_html(
            "Missing verification token.",
            "Return to Vaultlock and try again, or paste the token from your email.",
        ));
    }

    let repo = UserRepository::new(state.db.clone());
    match repo.verify_email(token).await {
        Ok(Some(user)) => Html(verify_email_open_success_html(&user.email)),
        Ok(None) => Html(verify_email_open_error_html(
            "This verification link is invalid or has already been used.",
            "If you already verified your email, return to Vaultlock and sign in.",
        )),
        Err(error) => {
            tracing::warn!(?error, "database error during email verification open");
            Html(verify_email_open_error_html(
                "Something went wrong while verifying your email.",
                "Try again later, or paste the token from your email into Vaultlock.",
            ))
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
            Json(AuthResponse::error(
                "Email not verified. Please check your email and verify your account.".to_string(),
            )),
        );
    }

    let is_valid = match validate_login_request(&payload, &user.master_password_hash) {
        Ok(valid) => valid,
        Err(message) => {
            return (StatusCode::BAD_REQUEST, Json(AuthResponse::error(message)));
        }
    };

    if is_valid {
        state.login_delay.clear(&payload.email).await;
        match issue_auth_success(&user, "Login successful".to_string()) {
            Ok(response) => (StatusCode::OK, Json(response)),
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

fn validate_login_request(payload: &LoginRequest, stored_hash: &str) -> Result<bool, String> {
    let has_password = payload
        .master_password
        .as_ref()
        .is_some_and(|value| !value.is_empty());
    let has_hash = payload
        .master_password_hash
        .as_ref()
        .is_some_and(|value| !value.is_empty());

    match (has_password, has_hash) {
        (true, false) => {
            let password = payload.master_password.as_deref().unwrap_or("");
            match verify_login_password(password, stored_hash) {
                Ok(valid) => Ok(valid),
                Err(e) => {
                    tracing::warn!(?e, "failed to verify master password");
                    Ok(false)
                }
            }
        }
        (false, true) => {
            let submitted = payload.master_password_hash.as_deref().unwrap_or("");
            Ok(verify_master_password_hash(submitted, stored_hash))
        }
        (false, false) => {
            Err("Either master_password or master_password_hash is required".to_string())
        }
        (true, true) => {
            Err("Provide either master_password or master_password_hash, not both".to_string())
        }
    }
}

fn issue_auth_success(
    user: &crate::models::user::User,
    message: String,
) -> Result<AuthResponse, Box<dyn std::error::Error + Send + Sync>> {
    let (access_token, refresh_token) = issue_tokens(user.id)?;
    Ok(AuthResponse::new(
        access_token,
        refresh_token,
        message,
        Some(user.master_password_hash.clone()),
    ))
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

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

const VERIFY_EMAIL_TOKEN_PLACEHOLDER: &str = r"{token}";

const fn vaultlock_sign_in_deep_link() -> &'static str {
    "vaultlock://sign-in"
}

fn build_verification_email_url(token: &str, base: &str) -> String {
    if base.contains(VERIFY_EMAIL_TOKEN_PLACEHOLDER) {
        base.replace(VERIFY_EMAIL_TOKEN_PLACEHOLDER, token)
    } else {
        format!("{base}{token}")
    }
}

fn verification_email_url(token: &str) -> String {
    if let Ok(template) = std::env::var("VERIFY_EMAIL_URL") {
        return build_verification_email_url(token, &template);
    }

    let public_base =
        std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let public_base = public_base.trim_end_matches('/');
    format!("{public_base}/verify-email/open?token={token}")
}

fn verification_email_html(verify_link: &str) -> String {
    let escaped_link = html_escape(verify_link);

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <h2>Welcome to Vaultlock!</h2>
  <p>Please verify your email address by clicking the link below:</p>
  <p><a href="{escaped_link}" style="color: #2563eb;">Verify Email</a></p>
  <p>After verifying, return to the Vaultlock app and sign in.</p>
  <p>If you did not create this account, you can safely ignore this email.</p>
</body>
</html>"#
    )
}

fn verify_email_open_success_html(email: &str) -> String {
    let escaped_email = html_escape(email);
    let open_app_link = html_escape(vaultlock_sign_in_deep_link());

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Email verified — Vaultlock</title>
</head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111; max-width: 32rem; margin: 2rem auto; padding: 0 1rem;">
  <h1>Email verified</h1>
  <p>Your email address <strong>{escaped_email}</strong> has been verified.</p>
  <p>Return to the Vaultlock app and sign in to continue.</p>
  <p><a href="{open_app_link}" style="color: #2563eb;">Open Vaultlock</a></p>
  <p style="color: #555; font-size: 0.9rem;">The Open Vaultlock link works when the app is installed. During development, switch back to the app manually and sign in.</p>
</body>
</html>"#
    )
}

fn verify_email_open_error_html(title: &str, detail: &str) -> String {
    let escaped_title = html_escape(title);
    let escaped_detail = html_escape(detail);
    let open_app_link = html_escape(vaultlock_sign_in_deep_link());

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Verification — Vaultlock</title>
</head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111; max-width: 32rem; margin: 2rem auto; padding: 0 1rem;">
  <h1>{escaped_title}</h1>
  <p>{escaped_detail}</p>
  <p><a href="{open_app_link}" style="color: #2563eb;">Open Vaultlock</a></p>
</body>
</html>"#
    )
}

/// Sends verification email using Resend.
async fn send_verification_email(email: &str, token: &str) -> anyhow::Result<()> {
    let api_key = std::env::var("RESEND_API_KEY")
        .map_err(|_| anyhow::anyhow!("RESEND_API_KEY must be set for email verification"))?;

    let verify_url = verification_email_url(token);
    let html = verification_email_html(&verify_url);

    let payload = serde_json::json!({
        "from": "Vaultlock <onboarding@resend.dev>",
        "to": [email],
        "subject": "Verify your Vaultlock account",
        "html": html
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
        tracing::info!(email = %email, "verification email sent via Resend");
        Ok(())
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        tracing::error!(
            email = %email,
            status = %status,
            error = %error_text,
            "failed to send verification email via Resend"
        );
        anyhow::bail!("Resend API returned {status}: {error_text}");
    }
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
            None,
        );
        assert_eq!(response.token, response.access_token);
    }

    #[test]
    fn verification_email_url_uses_public_base_url_by_default() {
        assert_eq!(
            build_verification_email_url(
                "abc-123",
                "http://localhost:8080/verify-email/open?token="
            ),
            "http://localhost:8080/verify-email/open?token=abc-123"
        );
    }

    #[test]
    fn verification_email_url_supports_token_placeholder() {
        assert_eq!(
            build_verification_email_url("abc-123", "https://app.example/verify?token={token}"),
            "https://app.example/verify?token=abc-123"
        );
    }

    #[test]
    fn verification_email_html_includes_clickable_https_link() {
        let html = verification_email_html("http://localhost:8080/verify-email/open?token=abc-123");
        assert!(html.contains(r#"href="http://localhost:8080/verify-email/open?token=abc-123""#));
        assert!(html.contains("Verify Email"));
    }

    #[test]
    fn verify_email_open_success_html_prompts_sign_in() {
        let html = verify_email_open_success_html("user@example.com");
        assert!(html.contains("Email verified"));
        assert!(html.contains("user@example.com"));
        assert!(html.contains("vaultlock://sign-in"));
    }
}
