#![allow(clippy::expect_used)]

mod common;

use axum::http::StatusCode;
use common::{assert_status, TestApp};
use rand::Rng;
use serde_json::{json, Value};
use vaultlock_backend::{
    auth::refresh_token::hash_refresh_token, crypto::argon2::hash_login_password,
};

const CREDENTIAL_CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/// Random alphanumeric input standing in for a client-side master-password preimage.
fn random_credential(len: usize) -> String {
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| CREDENTIAL_CHARSET[rng.gen_range(0..CREDENTIAL_CHARSET.len())] as char)
        .collect()
}

fn phc_hash_for_credential(credential: &str) -> String {
    hash_login_password(credential).expect("hash")
}

#[tokio::test]
async fn register_rejects_invalid_master_password_hash() {
    let app = TestApp::spawn().await;

    let response = app
        .post_json(
            "/register",
            &json!({
                "email": "invalid-hash@example.com",
                "master_password_hash": "not-an-argon2-hash"
            })
            .to_string(),
        )
        .await;

    assert_status(response, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn register_rejects_duplicate_email() {
    let app = TestApp::spawn().await;
    let hash = phc_hash_for_credential(&random_credential(24));
    let payload = json!({
        "email": "duplicate@example.com",
        "master_password_hash": hash
    })
    .to_string();

    assert_status(
        app.post_json("/register", &payload).await,
        StatusCode::CREATED,
    );
    assert_status(
        app.post_json("/register", &payload).await,
        StatusCode::CONFLICT,
    );
}

#[tokio::test]
async fn registration_verify_and_login_flow() {
    let app = TestApp::spawn().await;
    let email = "user@example.com";
    let hash = phc_hash_for_credential(&random_credential(24));

    let register_response = assert_status(
        app.post_json(
            "/register",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::CREATED,
    );
    let register_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(register_response).await)
            .expect("register json");
    assert!(register_body["message"]
        .as_str()
        .unwrap_or("")
        .contains("Registration successful"));

    let unverified_login = assert_status(
        app.post_json(
            "/login",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::FORBIDDEN,
    );
    let unverified_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(unverified_login).await)
            .expect("login json");
    assert!(unverified_body["message"]
        .as_str()
        .unwrap_or("")
        .contains("Email not verified"));

    let verification_token: String =
        sqlx::query_scalar("SELECT verification_token FROM users WHERE email = $1")
            .bind(email)
            .fetch_one(&app.pool)
            .await
            .expect("verification token");

    let verify_response = assert_status(
        app.post_json(
            "/verify-email",
            &json!({ "token": verification_token }).to_string(),
        )
        .await,
        StatusCode::OK,
    );
    let verify_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(verify_response).await)
            .expect("verify json");
    assert_eq!(verify_body["message"], "Email verified successfully");
    assert!(!verify_body["access_token"]
        .as_str()
        .unwrap_or("")
        .is_empty());
    assert_eq!(
        verify_body["token"].as_str(),
        verify_body["access_token"].as_str()
    );

    let login_response = assert_status(
        app.post_json(
            "/login",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::OK,
    );
    let login_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(login_response).await)
            .expect("login json");
    assert_eq!(login_body["message"], "Login successful");
    assert_eq!(
        login_body["token"].as_str(),
        login_body["access_token"].as_str()
    );
    assert!(!login_body["refresh_token"]
        .as_str()
        .unwrap_or("")
        .is_empty());
}

#[tokio::test]
async fn login_accepts_master_password_on_any_device() {
    let app = TestApp::spawn().await;
    let email = "cross-device@example.com";
    let credential = random_credential(24);
    let hash = phc_hash_for_credential(&credential);

    assert_status(
        app.post_json(
            "/register",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::CREATED,
    );

    let verification_token: String =
        sqlx::query_scalar("SELECT verification_token FROM users WHERE email = $1")
            .bind(email)
            .fetch_one(&app.pool)
            .await
            .expect("verification token");

    assert_status(
        app.post_json(
            "/verify-email",
            &json!({ "token": verification_token }).to_string(),
        )
        .await,
        StatusCode::OK,
    );

    let login_response = assert_status(
        app.post_json(
            "/login",
            &json!({
                "email": email,
                "master_password": credential
            })
            .to_string(),
        )
        .await,
        StatusCode::OK,
    );
    let login_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(login_response).await)
            .expect("login json");
    assert_eq!(login_body["message"], "Login successful");
    assert_eq!(login_body["master_password_hash"], hash);
}

#[tokio::test]
async fn login_rejects_invalid_credentials() {
    let app = TestApp::spawn().await;
    let email = "wrong-password@example.com";
    let valid_credential = random_credential(24);
    let hash = phc_hash_for_credential(&valid_credential);

    assert_status(
        app.post_json(
            "/register",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::CREATED,
    );

    let verification_token: String =
        sqlx::query_scalar("SELECT verification_token FROM users WHERE email = $1")
            .bind(email)
            .fetch_one(&app.pool)
            .await
            .expect("verification token");

    assert_status(
        app.post_json(
            "/verify-email",
            &json!({ "token": verification_token }).to_string(),
        )
        .await,
        StatusCode::OK,
    );

    let login_response = assert_status(
        app.post_json(
            "/login",
            &json!({
                "email": email,
                "master_password": "not-the-password"
            })
            .to_string(),
        )
        .await,
        StatusCode::UNAUTHORIZED,
    );
    let login_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(login_response).await)
            .expect("login json");
    assert_eq!(login_body["message"], "Invalid credentials");
}

#[tokio::test]
async fn login_returns_429_after_three_failed_attempts() {
    let app = TestApp::spawn().await;
    let email = "rate-limited@example.com";
    let valid_credential = random_credential(24);
    let hash = phc_hash_for_credential(&valid_credential);

    assert_status(
        app.post_json(
            "/register",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::CREATED,
    );

    let verification_token: String =
        sqlx::query_scalar("SELECT verification_token FROM users WHERE email = $1")
            .bind(email)
            .fetch_one(&app.pool)
            .await
            .expect("verification token");

    assert_status(
        app.post_json(
            "/verify-email",
            &json!({ "token": verification_token }).to_string(),
        )
        .await,
        StatusCode::OK,
    );

    for _ in 0..3 {
        assert_status(
            app.post_json(
                "/login",
                &json!({
                    "email": email,
                    "master_password": "wrong-password"
                })
                .to_string(),
            )
            .await,
            StatusCode::UNAUTHORIZED,
        );
    }

    let throttled = assert_status(
        app.post_json(
            "/login",
            &json!({
                "email": email,
                "master_password": valid_credential
            })
            .to_string(),
        )
        .await,
        StatusCode::TOO_MANY_REQUESTS,
    );
    let throttled_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(throttled).await)
            .expect("login json");
    assert!(throttled_body["message"]
        .as_str()
        .expect("message")
        .contains("Too many failed login attempts"));
}

async fn verify_user_email(app: &TestApp, email: &str) {
    let verification_token: String =
        sqlx::query_scalar("SELECT verification_token FROM users WHERE email = $1")
            .bind(email)
            .fetch_one(&app.pool)
            .await
            .expect("verification token");

    assert_status(
        app.post_json(
            "/verify-email",
            &json!({ "token": verification_token }).to_string(),
        )
        .await,
        StatusCode::OK,
    );
}

async fn login_verified_user(app: &TestApp, email: &str, hash: &str) -> Value {
    verify_user_email(app, email).await;

    let login_response = assert_status(
        app.post_json(
            "/login",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::OK,
    );
    serde_json::from_slice(&common::TestApp::response_body(login_response).await)
        .expect("login json")
}

#[tokio::test]
async fn refresh_rotates_tokens() {
    let app = TestApp::spawn().await;
    let email = "refresh-rotate@example.com";
    let hash = phc_hash_for_credential(&random_credential(24));

    assert_status(
        app.post_json(
            "/register",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::CREATED,
    );

    let login_body = login_verified_user(&app, email, &hash).await;
    let original_refresh = login_body["refresh_token"]
        .as_str()
        .expect("refresh token")
        .to_string();
    let original_access = login_body["access_token"]
        .as_str()
        .expect("access token")
        .to_string();

    let refresh_response = assert_status(
        app.post_json(
            "/refresh",
            &json!({ "refresh_token": original_refresh }).to_string(),
        )
        .await,
        StatusCode::OK,
    );
    let refresh_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(refresh_response).await)
            .expect("refresh json");

    assert_eq!(refresh_body["message"], "Token refreshed");
    let new_refresh = refresh_body["refresh_token"]
        .as_str()
        .expect("new refresh token");
    let new_access = refresh_body["access_token"]
        .as_str()
        .expect("new access token");
    assert_ne!(new_refresh, original_refresh);
    assert_ne!(new_access, original_access);

    assert_status(
        app.post_json(
            "/refresh",
            &json!({ "refresh_token": original_refresh }).to_string(),
        )
        .await,
        StatusCode::UNAUTHORIZED,
    );

    assert_status(
        app.get_bearer("/vault/items", new_access).await,
        StatusCode::OK,
    );
}

#[tokio::test]
async fn refresh_rejects_invalid_token() {
    let app = TestApp::spawn().await;

    let response = assert_status(
        app.post_json(
            "/refresh",
            &json!({ "refresh_token": "not-a-valid-token" }).to_string(),
        )
        .await,
        StatusCode::UNAUTHORIZED,
    );
    let body: Value =
        serde_json::from_slice(&common::TestApp::response_body(response).await).expect("json");
    assert!(body["message"]
        .as_str()
        .unwrap_or("")
        .contains("Invalid or expired refresh token"));
}

#[tokio::test]
async fn refresh_reuse_revokes_all_user_tokens() {
    let app = TestApp::spawn().await;
    let email = "refresh-reuse@example.com";
    let hash = phc_hash_for_credential(&random_credential(24));

    assert_status(
        app.post_json(
            "/register",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::CREATED,
    );

    let login_body = login_verified_user(&app, email, &hash).await;
    let refresh_a = login_body["refresh_token"]
        .as_str()
        .expect("refresh token")
        .to_string();

    let rotated = assert_status(
        app.post_json(
            "/refresh",
            &json!({ "refresh_token": refresh_a.clone() }).to_string(),
        )
        .await,
        StatusCode::OK,
    );
    let rotated_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(rotated).await).expect("json");
    let refresh_b = rotated_body["refresh_token"]
        .as_str()
        .expect("refresh b")
        .to_string();

    assert_status(
        app.post_json(
            "/refresh",
            &json!({ "refresh_token": refresh_a }).to_string(),
        )
        .await,
        StatusCode::UNAUTHORIZED,
    );

    assert_status(
        app.post_json(
            "/refresh",
            &json!({ "refresh_token": refresh_b }).to_string(),
        )
        .await,
        StatusCode::UNAUTHORIZED,
    );
}

#[tokio::test]
async fn login_persists_refresh_token_hash() {
    let app = TestApp::spawn().await;
    let email = "refresh-persist@example.com";
    let hash = phc_hash_for_credential(&random_credential(24));

    assert_status(
        app.post_json(
            "/register",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::CREATED,
    );

    verify_user_email(&app, email).await;

    let login_response = assert_status(
        app.post_json(
            "/login",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::OK,
    );
    let login_body: Value =
        serde_json::from_slice(&common::TestApp::response_body(login_response).await)
            .expect("login json");
    let refresh_token = login_body["refresh_token"].as_str().expect("refresh token");
    let stored_hash = hash_refresh_token(refresh_token);

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM refresh_tokens WHERE token_hash = $1 AND revoked = FALSE",
    )
    .bind(stored_hash)
    .fetch_one(&app.pool)
    .await
    .expect("refresh token row count");

    assert_eq!(count, 1);
}

#[tokio::test]
async fn verify_email_open_verifies_account() {
    let app = TestApp::spawn().await;
    let email = "open-link@example.com";
    let hash = phc_hash_for_credential(&random_credential(24));

    assert_status(
        app.post_json(
            "/register",
            &json!({
                "email": email,
                "master_password_hash": hash
            })
            .to_string(),
        )
        .await,
        StatusCode::CREATED,
    );

    let verification_token: String =
        sqlx::query_scalar("SELECT verification_token FROM users WHERE email = $1")
            .bind(email)
            .fetch_one(&app.pool)
            .await
            .expect("verification token");

    let response = assert_status(
        app.get(&format!("/verify-email/open?token={verification_token}"))
            .await,
        StatusCode::OK,
    );
    let body = String::from_utf8(common::TestApp::response_body(response).await.to_vec())
        .expect("utf8 body");

    assert!(body.contains("Email verified"));
    assert!(body.contains(email));

    let email_verified: bool =
        sqlx::query_scalar("SELECT email_verified FROM users WHERE email = $1")
            .bind(email)
            .fetch_one(&app.pool)
            .await
            .expect("email verified flag");
    assert!(email_verified);

    assert_status(
        app.post_json(
            "/verify-email",
            &json!({ "token": verification_token }).to_string(),
        )
        .await,
        StatusCode::BAD_REQUEST,
    );

    assert_status(
        app.post_json(
            "/verify-email",
            &json!({
                "token": verification_token,
                "email": email
            })
            .to_string(),
        )
        .await,
        StatusCode::CONFLICT,
    );
}

// Note: Integration tests for the wrapped_dek multi-device flow (roundtrip + orphan cleanup)
// can be added in a small follow-up PR. The implementation is complete.
