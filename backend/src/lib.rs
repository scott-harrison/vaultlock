mod auth;
mod crypto;
mod middleware;
mod models;
mod repositories;
mod vault;

use crate::auth::{login, register};
use crate::middleware::{
    progressive_delay::ProgressiveDelay,
    rate_limit::{login_rate_limit_middleware, LoginRateLimiter},
};
use crate::vault::{create_vault_item, list_vault_items};
use axum::{
    middleware::from_fn_with_state,
    routing::{get, post},
    Router,
};
use sqlx::PgPool;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub login_delay: ProgressiveDelay,
}

pub fn app(db: PgPool) -> Router {
    let state = AppState {
        db,
        login_delay: ProgressiveDelay::new(),
    };
    let login_rate_limiter = LoginRateLimiter::new();

    Router::new()
        .route("/health", get(health_check))
        .route("/register", post(register))
        .route(
            "/login",
            post(login).route_layer(from_fn_with_state(
                login_rate_limiter,
                login_rate_limit_middleware,
            )),
        )
        .route("/vault", post(create_vault_item))
        .route("/vault", get(list_vault_items))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn health_check() -> &'static str {
    "ok"
}
