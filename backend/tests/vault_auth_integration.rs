#![allow(clippy::expect_used)]

mod common;

use axum::http::StatusCode;
use base64::{engine::general_purpose::STANDARD, Engine};
use common::{assert_status, TestApp};
use rand::Rng;
use serde_json::json;
use vaultlock_backend::auth::jwt::{generate_access_token, JwtConfig};
use vaultlock_backend::crypto::{aes_gcm::encrypt, argon2::hash_login_password};

const CREDENTIAL_CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

fn random_credential(len: usize) -> String {
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| CREDENTIAL_CHARSET[rng.gen_range(0..CREDENTIAL_CHARSET.len())] as char)
        .collect()
}

fn phc_hash_for_credential(credential: &str) -> String {
    hash_login_password(credential).expect("hash")
}

fn client_encrypted_blob(plaintext: &[u8]) -> (String, String) {
    let dek = [0x11u8; 32];
    let (nonce, encrypted_data) = encrypt(plaintext, &dek).expect("encrypt");
    (STANDARD.encode(encrypted_data), STANDARD.encode(nonce))
}

async fn verified_access_token(app: &TestApp, email: &str, hash: &str) -> String {
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

    let verify_response = assert_status(
        app.post_json(
            "/verify-email",
            &json!({ "token": verification_token }).to_string(),
        )
        .await,
        StatusCode::OK,
    );
    let verify_body: serde_json::Value =
        serde_json::from_slice(&common::TestApp::response_body(verify_response).await)
            .expect("verify json");

    verify_body["access_token"]
        .as_str()
        .expect("access token")
        .to_string()
}

#[tokio::test]
async fn vault_routes_require_authentication() {
    let app = TestApp::spawn().await;

    assert_status(
        app.post_json("/vault", "{}").await,
        StatusCode::UNAUTHORIZED,
    );
    assert_status(app.get("/vault").await, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn vault_routes_reject_invalid_token() {
    let app = TestApp::spawn().await;

    assert_status(
        app.post_json_bearer("/vault", "{}", "not-a-valid-jwt")
            .await,
        StatusCode::UNAUTHORIZED,
    );
    assert_status(
        app.get_bearer("/vault", "not-a-valid-jwt").await,
        StatusCode::UNAUTHORIZED,
    );
}

#[tokio::test]
async fn vault_create_and_list_return_client_ciphertext() {
    let app = TestApp::spawn().await;
    let email = "vault-user@example.com";
    let hash = phc_hash_for_credential(&random_credential(24));
    let token = verified_access_token(&app, email, &hash).await;

    let (encrypted_data, nonce) = client_encrypted_blob(b"client-side secret");
    let create_response = assert_status(
        app.post_json_bearer(
            "/vault",
            &json!({
                "encrypted_data": encrypted_data,
                "nonce": nonce,
                "item_type": "login"
            })
            .to_string(),
            &token,
        )
        .await,
        StatusCode::OK,
    );
    let created: serde_json::Value =
        serde_json::from_slice(&common::TestApp::response_body(create_response).await)
            .expect("create json");
    let item_id = created["id"].as_str().expect("item id");
    assert_ne!(item_id, "00000000-0000-0000-0000-000000000000");
    assert_eq!(created["encrypted_data"], encrypted_data);
    assert_eq!(created["nonce"], nonce);

    let list_response = assert_status(app.get_bearer("/vault", &token).await, StatusCode::OK);
    let listed: Vec<serde_json::Value> =
        serde_json::from_slice(&common::TestApp::response_body(list_response).await)
            .expect("list json");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0]["id"].as_str(), Some(item_id));
    assert_eq!(listed[0]["encrypted_data"], encrypted_data);
    assert_eq!(listed[0]["nonce"], nonce);
}

#[tokio::test]
async fn vault_rejects_legacy_plaintext_payload() {
    let app = TestApp::spawn().await;
    let token = verified_access_token(
        &app,
        "legacy-payload@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    let response = app
        .post_json_bearer(
            "/vault",
            &json!({
                "plaintext": [1, 2, 3],
                "item_type": "login",
                "dek": vec![0u8; 32]
            })
            .to_string(),
            &token,
        )
        .await;

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn vault_token_user_isolation() {
    let app = TestApp::spawn().await;

    let token_a = verified_access_token(
        &app,
        "vault-a@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;
    let token_b = verified_access_token(
        &app,
        "vault-b@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    let (encrypted_data, nonce) = client_encrypted_blob(b"user-a-only");
    assert_status(
        app.post_json_bearer(
            "/vault",
            &json!({
                "encrypted_data": encrypted_data,
                "nonce": nonce,
                "item_type": "note"
            })
            .to_string(),
            &token_a,
        )
        .await,
        StatusCode::OK,
    );

    let list_b = assert_status(app.get_bearer("/vault", &token_b).await, StatusCode::OK);
    let listed_b: Vec<serde_json::Value> =
        serde_json::from_slice(&common::TestApp::response_body(list_b).await).expect("list json");
    assert!(listed_b.is_empty());
}

#[tokio::test]
async fn vault_rejects_expired_or_wrong_secret_token() {
    let app = TestApp::spawn().await;
    let user_id = uuid::Uuid::new_v4();
    let wrong_secret_config = JwtConfig {
        secret: "wrong-secret".to_string(),
        access_token_expiry_minutes: 15,
        refresh_token_expiry_days: 7,
    };
    let token = generate_access_token(user_id, &wrong_secret_config).expect("token");

    assert_status(
        app.post_json_bearer("/vault", "{}", &token).await,
        StatusCode::UNAUTHORIZED,
    );
}
