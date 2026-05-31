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

async fn parse_list_response(
    response: axum::response::Response,
) -> (Vec<serde_json::Value>, Option<String>) {
    let body: serde_json::Value =
        serde_json::from_slice(&common::TestApp::response_body(response).await).expect("list json");
    let items = body["items"].as_array().expect("items array").clone();
    let sync_token = body["sync_token"].as_str().map(str::to_string);
    (items, sync_token)
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
async fn legacy_vault_route_is_removed() {
    let app = TestApp::spawn().await;

    assert_status(app.post_json("/vault", "{}").await, StatusCode::NOT_FOUND);
    assert_status(app.get("/vault").await, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn vault_routes_require_authentication() {
    let app = TestApp::spawn().await;

    assert_status(
        app.post_json("/vault/items", "{}").await,
        StatusCode::UNAUTHORIZED,
    );
    assert_status(app.get("/vault/items").await, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn vault_routes_reject_invalid_token() {
    let app = TestApp::spawn().await;

    assert_status(
        app.post_json_bearer("/vault/items", "{}", "not-a-valid-jwt")
            .await,
        StatusCode::UNAUTHORIZED,
    );
    assert_status(
        app.get_bearer("/vault/items", "not-a-valid-jwt").await,
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
            "/vault/items",
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

    let list_response = assert_status(app.get_bearer("/vault/items", &token).await, StatusCode::OK);
    let (listed, sync_token) = parse_list_response(list_response).await;
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0]["id"].as_str(), Some(item_id));
    assert_eq!(listed[0]["encrypted_data"], encrypted_data);
    assert_eq!(listed[0]["nonce"], nonce);
    assert!(sync_token.is_some());
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
            "/vault/items",
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
async fn vault_accepts_supported_item_types() {
    let app = TestApp::spawn().await;
    let token = verified_access_token(
        &app,
        "item-types@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    for item_type in ["login", "note", "card"] {
        let (encrypted_data, nonce) = client_encrypted_blob(item_type.as_bytes());
        assert_status(
            app.post_json_bearer(
                "/vault/items",
                &json!({
                    "encrypted_data": encrypted_data,
                    "nonce": nonce,
                    "item_type": item_type
                })
                .to_string(),
                &token,
            )
            .await,
            StatusCode::OK,
        );
    }

    let list_response = assert_status(app.get_bearer("/vault/items", &token).await, StatusCode::OK);
    let (listed, _) = parse_list_response(list_response).await;
    assert_eq!(listed.len(), 3);
}

#[tokio::test]
async fn vault_rejects_invalid_item_type() {
    let app = TestApp::spawn().await;
    let token = verified_access_token(
        &app,
        "invalid-type@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    let (encrypted_data, nonce) = client_encrypted_blob(b"secret");
    let response = app
        .post_json_bearer(
            "/vault/items",
            &json!({
                "encrypted_data": encrypted_data,
                "nonce": nonce,
                "item_type": "password"
            })
            .to_string(),
            &token,
        )
        .await;

    assert_status(response, StatusCode::BAD_REQUEST);
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
            "/vault/items",
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

    let list_b = assert_status(
        app.get_bearer("/vault/items", &token_b).await,
        StatusCode::OK,
    );
    let (listed_b, sync_token_b) = parse_list_response(list_b).await;
    assert!(listed_b.is_empty());
    assert!(sync_token_b.is_none());
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
        app.post_json_bearer("/vault/items", "{}", &token).await,
        StatusCode::UNAUTHORIZED,
    );
}

#[tokio::test]
async fn vault_item_routes_require_authentication() {
    let app = TestApp::spawn().await;
    let item_id = uuid::Uuid::new_v4();

    assert_status(
        app.get(&format!("/vault/items/{item_id}")).await,
        StatusCode::UNAUTHORIZED,
    );
    assert_status(
        app.put_json(&format!("/vault/items/{item_id}"), "{}").await,
        StatusCode::UNAUTHORIZED,
    );
    assert_status(
        app.delete(&format!("/vault/items/{item_id}")).await,
        StatusCode::UNAUTHORIZED,
    );
}

#[tokio::test]
async fn vault_update_rejects_invalid_item_type() {
    let app = TestApp::spawn().await;
    let token = verified_access_token(
        &app,
        "invalid-update-type@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    let item_id = create_vault_item(&app, &token, b"secret", "login").await;
    let (encrypted_data, nonce) = client_encrypted_blob(b"updated");

    assert_status(
        app.put_json_bearer(
            &format!("/vault/items/{item_id}"),
            &json!({
                "encrypted_data": encrypted_data,
                "nonce": nonce,
                "item_type": "password"
            })
            .to_string(),
            &token,
        )
        .await,
        StatusCode::BAD_REQUEST,
    );
}

#[tokio::test]
async fn vault_sync_includes_items_updated_after_since() {
    let app = TestApp::spawn().await;
    let token = verified_access_token(
        &app,
        "vault-sync-update@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    let item_id = create_vault_item(&app, &token, b"before update", "login").await;

    let initial_list = assert_status(app.get_bearer("/vault/items", &token).await, StatusCode::OK);
    let (_, sync_token) = parse_list_response(initial_list).await;
    let sync_token = sync_token.expect("sync token");

    let (updated_data, updated_nonce) = client_encrypted_blob(b"after update");
    let update_response = assert_status(
        app.put_json_bearer(
            &format!("/vault/items/{item_id}"),
            &json!({
                "encrypted_data": updated_data,
                "nonce": updated_nonce
            })
            .to_string(),
            &token,
        )
        .await,
        StatusCode::OK,
    );
    let updated: serde_json::Value =
        serde_json::from_slice(&common::TestApp::response_body(update_response).await)
            .expect("update json");

    let incremental = assert_status(
        app.get_bearer(&format!("/vault/items?since={sync_token}"), &token)
            .await,
        StatusCode::OK,
    );
    let (incremental_items, incremental_sync_token) = parse_list_response(incremental).await;
    assert_eq!(incremental_items.len(), 1);
    assert_eq!(incremental_items[0]["id"].as_str(), Some(item_id.as_str()));
    assert_eq!(incremental_items[0]["encrypted_data"], updated_data);
    assert_eq!(
        incremental_items[0]["updated_at"].as_str(),
        updated["updated_at"].as_str()
    );
    assert!(incremental_sync_token.is_some());
    assert_ne!(incremental_sync_token.as_deref(), Some(sync_token.as_str()));
}

#[tokio::test]
async fn vault_full_crud_and_sync_lifecycle() {
    let app = TestApp::spawn().await;
    let token = verified_access_token(
        &app,
        "vault-lifecycle@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    let login_id = create_vault_item(&app, &token, b"login entry", "login").await;
    let note_id = create_vault_item(&app, &token, b"secure note", "note").await;

    let full_list = assert_status(app.get_bearer("/vault/items", &token).await, StatusCode::OK);
    let (all_items, baseline_sync) = parse_list_response(full_list).await;
    assert_eq!(all_items.len(), 2);
    let baseline_sync = baseline_sync.expect("baseline sync token");

    for item_id in [&login_id, &note_id] {
        assert_status(
            app.get_bearer(&format!("/vault/items/{item_id}"), &token)
                .await,
            StatusCode::OK,
        );
    }

    let (updated_data, updated_nonce) = client_encrypted_blob(b"rotated login secret");
    assert_status(
        app.put_json_bearer(
            &format!("/vault/items/{login_id}"),
            &json!({
                "encrypted_data": updated_data,
                "nonce": updated_nonce,
                "item_type": "card"
            })
            .to_string(),
            &token,
        )
        .await,
        StatusCode::OK,
    );

    let after_update = assert_status(
        app.get_bearer(&format!("/vault/items?since={baseline_sync}"), &token)
            .await,
        StatusCode::OK,
    );
    let (changed_items, _) = parse_list_response(after_update).await;
    assert_eq!(changed_items.len(), 1);
    assert_eq!(changed_items[0]["id"].as_str(), Some(login_id.as_str()));
    assert_eq!(changed_items[0]["item_type"], "card");

    assert_status(
        app.delete_bearer(&format!("/vault/items/{note_id}"), &token)
            .await,
        StatusCode::NO_CONTENT,
    );

    let remaining = assert_status(app.get_bearer("/vault/items", &token).await, StatusCode::OK);
    let (remaining_items, _) = parse_list_response(remaining).await;
    assert_eq!(remaining_items.len(), 1);
    assert_eq!(remaining_items[0]["id"].as_str(), Some(login_id.as_str()));

    assert_status(
        app.delete_bearer(&format!("/vault/items/{login_id}"), &token)
            .await,
        StatusCode::NO_CONTENT,
    );
    assert_status(
        app.get_bearer(&format!("/vault/items/{login_id}"), &token)
            .await,
        StatusCode::NOT_FOUND,
    );

    let empty_list = assert_status(app.get_bearer("/vault/items", &token).await, StatusCode::OK);
    let (empty_items, empty_sync) = parse_list_response(empty_list).await;
    assert!(empty_items.is_empty());
    assert!(empty_sync.is_none());
}

async fn create_vault_item(
    app: &TestApp,
    token: &str,
    plaintext: &[u8],
    item_type: &str,
) -> String {
    let (encrypted_data, nonce) = client_encrypted_blob(plaintext);
    let create_response = assert_status(
        app.post_json_bearer(
            "/vault/items",
            &json!({
                "encrypted_data": encrypted_data,
                "nonce": nonce,
                "item_type": item_type
            })
            .to_string(),
            token,
        )
        .await,
        StatusCode::OK,
    );
    let created: serde_json::Value =
        serde_json::from_slice(&common::TestApp::response_body(create_response).await)
            .expect("create json");
    created["id"].as_str().expect("item id").to_string()
}

#[tokio::test]
async fn vault_get_update_delete_item_for_owner() {
    let app = TestApp::spawn().await;
    let token = verified_access_token(
        &app,
        "vault-crud@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    let item_id = create_vault_item(&app, &token, b"original secret", "login").await;

    let get_response = assert_status(
        app.get_bearer(&format!("/vault/items/{item_id}"), &token)
            .await,
        StatusCode::OK,
    );
    let fetched: serde_json::Value =
        serde_json::from_slice(&common::TestApp::response_body(get_response).await)
            .expect("get json");
    assert_eq!(fetched["item_type"], "login");

    let (updated_data, updated_nonce) = client_encrypted_blob(b"updated secret");
    let update_response = assert_status(
        app.put_json_bearer(
            &format!("/vault/items/{item_id}"),
            &json!({
                "encrypted_data": updated_data,
                "nonce": updated_nonce,
                "item_type": "note"
            })
            .to_string(),
            &token,
        )
        .await,
        StatusCode::OK,
    );
    let updated: serde_json::Value =
        serde_json::from_slice(&common::TestApp::response_body(update_response).await)
            .expect("update json");
    assert_eq!(updated["item_type"], "note");
    assert_eq!(updated["encrypted_data"], updated_data);
    assert_ne!(updated["updated_at"], fetched["updated_at"]);

    assert_status(
        app.delete_bearer(&format!("/vault/items/{item_id}"), &token)
            .await,
        StatusCode::NO_CONTENT,
    );
    assert_status(
        app.get_bearer(&format!("/vault/items/{item_id}"), &token)
            .await,
        StatusCode::NOT_FOUND,
    );
}

#[tokio::test]
async fn vault_item_crud_enforces_ownership() {
    let app = TestApp::spawn().await;

    let token_a = verified_access_token(
        &app,
        "vault-crud-a@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;
    let token_b = verified_access_token(
        &app,
        "vault-crud-b@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    let item_id = create_vault_item(&app, &token_a, b"owned by a", "login").await;
    let (encrypted_data, nonce) = client_encrypted_blob(b"intruder update");

    assert_status(
        app.get_bearer(&format!("/vault/items/{item_id}"), &token_b)
            .await,
        StatusCode::NOT_FOUND,
    );
    assert_status(
        app.put_json_bearer(
            &format!("/vault/items/{item_id}"),
            &json!({
                "encrypted_data": encrypted_data,
                "nonce": nonce
            })
            .to_string(),
            &token_b,
        )
        .await,
        StatusCode::NOT_FOUND,
    );
    assert_status(
        app.delete_bearer(&format!("/vault/items/{item_id}"), &token_b)
            .await,
        StatusCode::NOT_FOUND,
    );

    assert_status(
        app.get_bearer(&format!("/vault/items/{item_id}"), &token_a)
            .await,
        StatusCode::OK,
    );
}

#[tokio::test]
async fn vault_list_rejects_invalid_since_parameter() {
    let app = TestApp::spawn().await;
    let token = verified_access_token(
        &app,
        "invalid-since@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    assert_status(
        app.get_bearer("/vault/items?since=not-a-timestamp", &token)
            .await,
        StatusCode::BAD_REQUEST,
    );
}

#[tokio::test]
async fn vault_list_supports_incremental_sync_with_since() {
    let app = TestApp::spawn().await;
    let token = verified_access_token(
        &app,
        "vault-sync@example.com",
        &phc_hash_for_credential(&random_credential(24)),
    )
    .await;

    let (encrypted_data_a, nonce_a) = client_encrypted_blob(b"first item");
    let first_item_response = assert_status(
        app.post_json_bearer(
            "/vault/items",
            &json!({
                "encrypted_data": encrypted_data_a,
                "nonce": nonce_a,
                "item_type": "login"
            })
            .to_string(),
            &token,
        )
        .await,
        StatusCode::OK,
    );
    let created_a: serde_json::Value =
        serde_json::from_slice(&common::TestApp::response_body(first_item_response).await)
            .expect("create json");
    let item_a_id = created_a["id"].as_str().expect("item id");

    let initial_list = assert_status(app.get_bearer("/vault/items", &token).await, StatusCode::OK);
    let (initial_items, sync_token) = parse_list_response(initial_list).await;
    assert_eq!(initial_items.len(), 1);
    let sync_token = sync_token.expect("sync token");

    sqlx::query(
        "UPDATE vault_items SET updated_at = TIMESTAMP '2020-01-01 00:00:00+00' WHERE id = $1",
    )
    .bind(uuid::Uuid::parse_str(item_a_id).expect("uuid"))
    .execute(&app.pool)
    .await
    .expect("backdate item");

    let unchanged = assert_status(
        app.get_bearer(&format!("/vault/items?since={sync_token}"), &token)
            .await,
        StatusCode::OK,
    );
    let (unchanged_items, unchanged_sync_token) = parse_list_response(unchanged).await;
    assert!(unchanged_items.is_empty());
    assert_eq!(unchanged_sync_token.as_deref(), Some(sync_token.as_str()));

    let (encrypted_data_b, nonce_b) = client_encrypted_blob(b"second item");
    let second_item_response = assert_status(
        app.post_json_bearer(
            "/vault/items",
            &json!({
                "encrypted_data": encrypted_data_b,
                "nonce": nonce_b,
                "item_type": "note"
            })
            .to_string(),
            &token,
        )
        .await,
        StatusCode::OK,
    );
    let created_b: serde_json::Value =
        serde_json::from_slice(&common::TestApp::response_body(second_item_response).await)
            .expect("create json");
    let item_b_id = created_b["id"].as_str().expect("item id");

    let incremental = assert_status(
        app.get_bearer(&format!("/vault/items?since={sync_token}"), &token)
            .await,
        StatusCode::OK,
    );
    let (incremental_items, incremental_sync_token) = parse_list_response(incremental).await;
    assert_eq!(incremental_items.len(), 1);
    assert_eq!(incremental_items[0]["id"].as_str(), Some(item_b_id));
    assert!(incremental_sync_token.is_some());
    assert_ne!(incremental_sync_token.as_deref(), Some(sync_token.as_str()));
}
