mod auth;
mod crypto;
mod middleware;

use crate::auth::{login, register};
use crate::middleware::rate_limit::login_rate_limiter;
use axum::{
    routing::{get, post},
    Router,
};

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/register", post(register))
        .route("/login", post(login).layer(login_rate_limiter()))
        .layer(tower_http::cors::CorsLayer::permissive())
}

async fn health_check() -> &'static str {
    "ok"
}
