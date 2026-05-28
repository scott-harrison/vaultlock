#![allow(clippy::duration_suboptimal_units)]

mod memory;
mod postgres;
mod redis;

use axum::{
    body::Body,
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use memory::MemoryStore;
use postgres::PostgresStore;
use redis::RedisStore;
use sqlx::PgPool;
use std::{net::SocketAddr, time::Duration};

pub fn max_requests() -> usize {
    std::env::var("AUTH_RATE_LIMIT_MAX")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(5)
}

pub fn window_secs() -> u64 {
    std::env::var("AUTH_RATE_LIMIT_WINDOW_SECS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(60)
}

pub fn window() -> Duration {
    Duration::from_secs(window_secs())
}

#[derive(Clone)]
enum RateLimitStore {
    Memory(MemoryStore),
    Postgres(PostgresStore),
    Redis(Box<RedisStore>),
}

impl RateLimitStore {
    async fn check(&self, key: &str) -> Result<(), StatusCode> {
        match self {
            Self::Memory(store) => store.check(key).await,
            Self::Postgres(store) => store.check(key).await,
            Self::Redis(store) => store.check(key).await,
        }
    }
}

#[derive(Clone)]
pub struct AuthRateLimiter {
    store: RateLimitStore,
}

impl AuthRateLimiter {
    #[must_use]
    pub fn in_memory() -> Self {
        Self {
            store: RateLimitStore::Memory(MemoryStore::new()),
        }
    }

    #[must_use]
    pub const fn postgres(pool: PgPool) -> Self {
        Self {
            store: RateLimitStore::Postgres(PostgresStore::new(pool)),
        }
    }

    /// Builds a rate limiter from `RATE_LIMIT_STORE` and related env vars.
    ///
    /// # Errors
    ///
    /// Returns an error when `RATE_LIMIT_STORE` is invalid, when `REDIS_URL` is
    /// missing for the Redis store, or when connecting to Redis fails.
    pub async fn from_env(pool: &PgPool) -> Result<Self, String> {
        let store_kind = std::env::var("RATE_LIMIT_STORE").unwrap_or_else(|_| "memory".to_string());

        let store = match store_kind.as_str() {
            "memory" => RateLimitStore::Memory(MemoryStore::new()),
            "postgres" => RateLimitStore::Postgres(PostgresStore::new(pool.clone())),
            "redis" => {
                let redis_url = std::env::var("REDIS_URL")
                    .map_err(|_| "REDIS_URL is required when RATE_LIMIT_STORE=redis".to_string())?;
                let redis_store = RedisStore::connect(&redis_url)
                    .await
                    .map_err(|error| format!("failed to connect to Redis: {error}"))?;
                RateLimitStore::Redis(Box::new(redis_store))
            }
            other => {
                return Err(format!(
                    "invalid RATE_LIMIT_STORE={other:?}; expected memory, postgres, or redis"
                ));
            }
        };

        Ok(Self { store })
    }

    /// Records a request for `key` and returns `Err` when the rate limit is exceeded.
    ///
    /// # Errors
    ///
    /// Returns `StatusCode::TOO_MANY_REQUESTS` when the limit is exceeded.
    pub async fn check(&self, key: &str) -> Result<(), StatusCode> {
        self.store.check(key).await
    }
}

pub async fn auth_rate_limit_middleware(
    State(limiter): State<AuthRateLimiter>,
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
    async fn memory_rate_limiter_allows_requests_under_limit() {
        let limiter = AuthRateLimiter::in_memory();
        let key = "127.0.0.1";

        for _ in 0..4 {
            assert_eq!(limiter.check(key).await, Ok(()));
        }
    }

    #[tokio::test]
    async fn memory_rate_limiter_blocks_after_limit_exceeded() {
        let limiter = AuthRateLimiter::in_memory();
        let key = "127.0.0.1";

        for _ in 0..5 {
            assert_eq!(limiter.check(key).await, Ok(()));
        }

        assert_eq!(limiter.check(key).await, Err(StatusCode::TOO_MANY_REQUESTS));
    }
}
