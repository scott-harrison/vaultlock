#![allow(clippy::duration_suboptimal_units)]

// In-memory implementation for MVP.
// In production, replace with Redis or database-backed store (e.g. using redis crate or sqlx).
// This is acceptable for single-instance deployments and early testing.

use axum::{
    body::Body,
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

const MAX_REQUESTS: usize = 5;
const WINDOW: Duration = Duration::from_secs(60);

#[derive(Clone)]
pub struct LoginRateLimiter {
    requests: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
}

impl LoginRateLimiter {
    pub fn new() -> Self {
        Self {
            requests: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Records a request for `key` and returns `Err` when the rate limit is exceeded.
    #[allow(clippy::significant_drop_tightening)]
    pub async fn check(&self, key: &str) -> Result<(), StatusCode> {
        let now = Instant::now();
        let mut requests = self.requests.lock().await;
        let timestamps = requests.entry(key.to_string()).or_default();
        timestamps.retain(|t| now.duration_since(*t) < WINDOW);

        if timestamps.len() >= MAX_REQUESTS {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }

        timestamps.push(now);
        Ok(())
    }
}

pub async fn login_rate_limit_middleware(
    State(limiter): State<LoginRateLimiter>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request<Body>,
    next: Next,
) -> Response {
    if limiter.check(&addr.ip().to_string()).await.is_err() {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }

    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rate_limiter_allows_requests_under_limit() {
        let limiter = LoginRateLimiter::new();
        let key = "127.0.0.1";

        for _ in 0..4 {
            assert_eq!(limiter.check(key).await, Ok(()));
        }
    }

    #[tokio::test]
    async fn rate_limiter_blocks_after_limit_exceeded() {
        let limiter = LoginRateLimiter::new();
        let key = "127.0.0.1";

        for _ in 0..5 {
            assert_eq!(limiter.check(key).await, Ok(()));
        }

        assert_eq!(limiter.check(key).await, Err(StatusCode::TOO_MANY_REQUESTS));
    }
}
