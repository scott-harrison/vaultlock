#![allow(clippy::expect_used)]

mod common;

use axum::http::StatusCode;
use common::{assert_status, TestApp};
use rand::Rng;
use serde_json::{json, Value};
use vaultlock_backend::crypto::argon2::hash_login_password;

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
}
