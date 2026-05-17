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
}

pub async fn login_rate_limit_middleware(
    State(limiter): State<LoginRateLimiter>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let key = addr.ip().to_string();
    let now = Instant::now();

    let mut requests = limiter.requests.lock().await;
    let timestamps = requests.entry(key).or_default();
    timestamps.retain(|t| now.duration_since(*t) < WINDOW);

    if timestamps.len() >= MAX_REQUESTS {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }

    timestamps.push(now);
    drop(requests);

    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use std::net::SocketAddr;

    #[tokio::test]
    async fn rate_limiter_allows_requests_under_limit() {
        let limiter = LoginRateLimiter::new();
        let addr: SocketAddr = "127.0.0.1:8080".parse().unwrap();

        for _ in 0..4 {
            let response = login_rate_limit_middleware(
                State(limiter.clone()),
                ConnectInfo(addr),
                Request::builder().uri("/login").body(Body::empty()).unwrap(),
                Next::new(|_| async { StatusCode::OK.into_response() }),
            ).await;

            assert_eq!(response.status(), StatusCode::OK);
        }
    }

    #[tokio::test]
    async fn rate_limiter_blocks_after_limit_exceeded() {
        let limiter = LoginRateLimiter::new();
        let addr: SocketAddr = "127.0.0.1:8080".parse().unwrap();

        // Exhaust limit
        for _ in 0..5 {
            let _ = login_rate_limit_middleware(
                State(limiter.clone()),
                ConnectInfo(addr),
                Request::builder().uri("/login").body(Body::empty()).unwrap(),
                Next::new(|_| async { StatusCode::OK.into_response() }),
            ).await;
        }

        // Next request should be blocked
        let response = login_rate_limit_middleware(
            State(limiter.clone()),
            ConnectInfo(addr),
            Request::builder().uri("/login").body(Body::empty()).unwrap(),
            Next::new(|_| async { StatusCode::OK.into_response() }),
        ).await;

        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    }
}