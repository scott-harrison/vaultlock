mod auth;

use crate::auth::{login, register};
use axum::{
    routing::{get, post},
    Router,
};

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/register", post(register))
        .route("/login", post(login))
        .layer(tower_http::cors::CorsLayer::permissive())
}

async fn health_check() -> &'static str {
    "ok"
}
