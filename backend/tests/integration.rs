use axum::body::Body;
use axum::http::{Request, StatusCode};
use std::error::Error;
use tower::ServiceExt; // for `oneshot`
use vaultlock_backend::app;

#[tokio::test]
async fn health_check_works() -> Result<(), Box<dyn Error>> {
    let app = app();
    let request = Request::builder().uri("/health").body(Body::empty())?;

    let response = app.oneshot(request).await?;

    assert_eq!(response.status(), StatusCode::OK);

    Ok(())
}
