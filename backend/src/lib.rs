use axum::{routing::get, Router};

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health_check))
        .layer(tower_http::cors::CorsLayer::permissive())
}

async fn health_check() -> &'static str {
    "ok"
}
