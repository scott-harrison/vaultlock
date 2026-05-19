#![allow(clippy::expect_used)]

mod common;

use axum::http::StatusCode;
use common::{assert_status, TestApp};
use serde_json::{json, Value};
use vaultlock_backend::crypto::argon2::hash_login_password;

fn master_password_hash(password: &str) -> String {
    hash_login_password(password).expect("hash")
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
    let hash = master_password_hash("correct horse battery staple");
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
    let password = "correct horse battery staple";
    let hash = master_password_hash(password);

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
    assert_eq!(
        register_body["message"],
        "Registration successful. Please verify your email."
    );

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
    assert_eq!(unverified_body["message"], "Email not verified");

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
async fn login_rejects_invalid_credentials() {
    let app = TestApp::spawn().await;
    let email = "wrong-password@example.com";
    let hash = master_password_hash("correct horse battery staple");
    let wrong_hash = master_password_hash("wrong password");

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
                "master_password_hash": wrong_hash
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
