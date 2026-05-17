#![allow(clippy::duration_suboptimal_units)]

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
