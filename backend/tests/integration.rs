use axum::body::Body;
use axum::http::{Request, StatusCode};
use sqlx::postgres::PgPoolOptions;
use std::error::Error;
use tower::ServiceExt; // for `oneshot`
use vaultlock_backend::app;

#[tokio::test]
async fn health_check_works() -> Result<(), Box<dyn Error>> {
    let pool = PgPoolOptions::new().connect_lazy("postgres://localhost/unused")?;
    let app = app(pool);
    let request = Request::builder().uri("/health").body(Body::empty())?;

    let response = app.oneshot(request).await?;

    assert_eq!(response.status(), StatusCode::OK);

    Ok(())
}
