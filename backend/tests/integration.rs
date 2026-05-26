use axum::body::Body;
use axum::http::{Request, StatusCode};
use sqlx::postgres::PgPoolOptions;
use std::error::Error;
use tower::ServiceExt; // for `oneshot`
use vaultlock_backend::{app, auth::jwt::JwtConfig, AuthRateLimiter};

#[tokio::test]
async fn health_check_works() -> Result<(), Box<dyn Error>> {
    let pool = PgPoolOptions::new().connect_lazy("postgres://localhost/unused")?;
    let jwt = JwtConfig {
        secret: "integration-test-jwt-secret".to_string(),
        access_token_expiry_minutes: 15,
        refresh_token_expiry_days: 7,
    };
    let app = app(pool, jwt, AuthRateLimiter::in_memory());
    let request = Request::builder().uri("/health").body(Body::empty())?;

    let response = app.oneshot(request).await?;

    assert_eq!(response.status(), StatusCode::OK);

    Ok(())
}
