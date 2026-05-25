#![allow(clippy::duration_suboptimal_units)]

//! Pluggable authentication rate limiting.
//!
//! Supports in-memory (for development / single-instance) and Redis (recommended for
//! production / horizontal scaling).
//!
//! Configuration via environment:
//! - `AUTH_RATE_LIMIT_MAX` (default 5)
//! - `AUTH_RATE_LIMIT_STORE` = "memory" (default) | "redis"
//! - `REDIS_URL` (required when store=redis)

use axum::{
    body::Body,
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::{
    net::SocketAddr,
    sync::Arc,
    time::Duration,
};
use tokio::sync::Mutex;

fn max_requests() -> usize {
    std::env::var("AUTH_RATE_LIMIT_MAX")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(5)
}

const WINDOW: Duration = Duration::from_secs(60);

/// In-memory implementation (suitable for dev and single-instance deployments).
#[derive(Clone)]
pub struct InMemoryRateLimitStore {
    requests: Arc<Mutex<std::collections::HashMap<String, Vec<std::time::Instant>>>>,
}

impl InMemoryRateLimitStore {
    pub fn new() -> Self {
        Self {
            requests: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub async fn check(&self, key: &str) -> Result<(), StatusCode> {
        let now = std::time::Instant::now();
        let mut requests = self.requests.lock().await;
        let timestamps = requests.entry(key.to_string()).or_default();
        timestamps.retain(|t| now.duration_since(*t) < WINDOW);

        if timestamps.len() >= max_requests() {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }

        timestamps.push(now);
        Ok(())
    }
}

/// Redis-backed distributed rate limiter (recommended for production).
#[derive(Clone)]
pub struct RedisRateLimitStore {
    client: redis::Client,
}

impl RedisRateLimitStore {
    pub fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        Ok(Self { client })
    }

    pub async fn check(&self, key: &str) -> Result<(), StatusCode> {
        // Use multiplexed connection for better performance
        let mut conn = self
            .client
            .get_multiplexed_async_connection()
            .await
            .map_err(|_| StatusCode::TOO_MANY_REQUESTS)?;

        let rate_key = format!("rate_limit:auth:{key}");
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as f64;
        let window_start = now - WINDOW.as_secs() as f64;

        let script = redis::Script::new(
            r#"
            local key = KEYS[1]
            local now = tonumber(ARGV[1])
            local window_start = tonumber(ARGV[2])
            local max_requests = tonumber(ARGV[3])
            local window = tonumber(ARGV[4])

            redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
            local current = redis.call('ZCARD', key)

            if current >= max_requests then
                return 0
            end

            redis.call('ZADD', key, now, now)
            redis.call('EXPIRE', key, window)
            return 1
            "#,
        );

        let allowed: i32 = script
            .key(&rate_key)
            .arg(now)
            .arg(window_start)
            .arg(max_requests() as i32)
            .arg(WINDOW.as_secs() as i32)
            .invoke_async(&mut conn)
            .await
            .unwrap_or(0);

        if allowed == 1 {
            Ok(())
        } else {
            Err(StatusCode::TOO_MANY_REQUESTS)
        }
    }
}

/// Pluggable rate limit backend.
#[derive(Clone)]
pub enum RateLimitBackend {
    Memory(InMemoryRateLimitStore),
    Redis(RedisRateLimitStore),
}

impl RateLimitBackend {
    pub async fn check(&self, key: &str) -> Result<(), StatusCode> {
        match self {
            RateLimitBackend::Memory(s) => s.check(key).await,
            RateLimitBackend::Redis(s) => s.check(key).await,
        }
    }
}

/// Main rate limiter facade.
#[derive(Clone)]
pub struct AuthRateLimiter {
    backend: RateLimitBackend,
}

impl AuthRateLimiter {
    /// Creates a rate limiter based on environment configuration.
    pub fn from_env() -> Self {
        let store_type = std::env::var("AUTH_RATE_LIMIT_STORE")
            .unwrap_or_else(|_| "memory".to_string())
            .to_lowercase();

        let backend = match store_type.as_str() {
            "redis" => {
                let url = std::env::var("REDIS_URL")
                    .expect("REDIS_URL must be set when AUTH_RATE_LIMIT_STORE=redis");
                let redis_store = RedisRateLimitStore::new(&url)
                    .expect("Failed to create Redis rate limit store");
                RateLimitBackend::Redis(redis_store)
            }
            _ => RateLimitBackend::Memory(InMemoryRateLimitStore::new()),
        };

        Self { backend }
    }

    pub async fn check(&self, key: &str) -> Result<(), StatusCode> {
        self.backend.check(key).await
    }
}

/// Helper to extract a reasonable client identifier.
/// For production behind a reverse proxy, consider a proper `ClientIp` extractor
/// that respects `X-Forwarded-For` / `X-Real-IP` from trusted proxies only.
fn client_ip(addr: SocketAddr, _headers: &HeaderMap) -> String {
    // TODO: Improve with trusted proxy configuration (see issue #152)
    addr.ip().to_string()
}

pub async fn auth_rate_limit_middleware(
    State(limiter): State<AuthRateLimiter>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let ip = client_ip(addr, request.headers());
    if limiter.check(&ip).await.is_err() {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }

    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rate_limiter_allows_requests_under_limit() {
        let limiter = AuthRateLimiter {
            backend: RateLimitBackend::Memory(InMemoryRateLimitStore::new()),
        };
        let key = "127.0.0.1";

        for _ in 0..4 {
            assert_eq!(limiter.check(key).await, Ok(()));
        }
    }

    #[tokio::test]
    async fn rate_limiter_blocks_after_limit_exceeded() {
        let limiter = AuthRateLimiter {
            backend: RateLimitBackend::Memory(InMemoryRateLimitStore::new()),
        };
        let key = "127.0.0.1";

        for _ in 0..5 {
            assert_eq!(limiter.check(key).await, Ok(()));
        }

        assert_eq!(limiter.check(key).await, Err(StatusCode::TOO_MANY_REQUESTS));
    }
}
