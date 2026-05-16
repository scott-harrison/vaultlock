mod auth;
mod crypto;
mod models;
mod repositories;

use crate::auth::{login, register};
use axum::{
    routing::{get, post},
    Router,
};
use sqlx::PgPool;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}

pub fn app(db: PgPool) -> Router {
    let state = AppState { db };

    Router::new()
        .route("/health", get(health_check))
        .route("/register", post(register))
        .route("/login", post(login))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn health_check() -> &'static str {
    "ok"
}
