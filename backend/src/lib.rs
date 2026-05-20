pub mod auth;
pub mod crypto;
mod middleware;
mod models;
mod repositories;
mod vault;

use crate::auth::jwt::JwtConfig;
use crate::auth::{login, register, verify_email};
use crate::middleware::{
    jwt_auth::jwt_auth_middleware,
    progressive_delay::ProgressiveDelay,
    rate_limit::{auth_rate_limit_middleware, AuthRateLimiter},
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
    pub jwt: JwtConfig,
}

pub fn app(db: PgPool, jwt: JwtConfig) -> Router {
    let state = AppState {
        db,
        login_delay: ProgressiveDelay::new(),
        jwt,
    };
    let auth_rate_limit = from_fn_with_state(AuthRateLimiter::new(), auth_rate_limit_middleware);
    let jwt_auth = from_fn_with_state(state.clone(), jwt_auth_middleware);

    let vault_routes = Router::new()
        .route("/vault", post(create_vault_item))
        .route("/vault", get(list_vault_items))
        .route_layer(jwt_auth);

    Router::new()
        .route("/health", get(health_check))
        .route(
            "/register",
            post(register).route_layer(auth_rate_limit.clone()),
        )
        .route(
            "/verify-email",
            post(verify_email).route_layer(auth_rate_limit.clone()),
        )
        .route("/login", post(login).route_layer(auth_rate_limit))
        .merge(vault_routes)
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn health_check() -> &'static str {
    "ok"
}
