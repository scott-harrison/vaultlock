use axum::Json;
use serde::{Deserialize, Serialize};

use crate::crypto::argon2::{hash_login_password, verify_login_password};

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
    pub token: String,
    pub message: String,
}

pub async fn register(Json(payload): Json<RegisterRequest>) -> Json<AuthResponse> {
    // TODO: Check if user exists in DB
    let _hash = hash_login_password(&payload.password).expect("Failed to hash password");

    // TODO: Store user in database with hash

    Json(AuthResponse {
        token: "fake-jwt-token".to_string(),
        message: "User registered successfully".to_string(),
    })
}

pub async fn login(Json(payload): Json<LoginRequest>) -> Json<AuthResponse> {
    // TODO: Fetch user hash from DB
    let stored_hash = "$argon2id$v=19$m=19456,t=2,p=1$..."; // placeholder

    let is_valid = verify_login_password(&payload.password, stored_hash).unwrap_or(false);

    if is_valid {
        Json(AuthResponse {
            token: "fake-jwt-token".to_string(),
            message: "Login successful".to_string(),
        })
    } else {
        Json(AuthResponse {
            token: "".to_string(),
            message: "Invalid credentials".to_string(),
        })
    }
}
