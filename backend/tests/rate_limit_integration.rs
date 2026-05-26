#![allow(clippy::expect_used)]

mod common;

use axum::http::StatusCode;
use common::TestApp;
use vaultlock_backend::AuthRateLimiter;

#[tokio::test]
async fn postgres_rate_limit_is_shared_across_instances() {
    let app = TestApp::spawn().await;
    std::env::set_var("AUTH_RATE_LIMIT_MAX", "5");

    let instance_a = AuthRateLimiter::postgres(app.pool.clone());
    let instance_b = AuthRateLimiter::postgres(app.pool.clone());
    let key = "203.0.113.42";

    for _ in 0..5 {
        assert_eq!(instance_a.check(key).await, Ok(()));
    }

    assert_eq!(
        instance_b.check(key).await,
        Err(StatusCode::TOO_MANY_REQUESTS)
    );
}
