use super::{max_requests, window_secs};
use axum::http::StatusCode;
use redis::aio::ConnectionManager;
use redis::{AsyncCommands, Value};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Clone)]
pub struct RedisStore {
    client: ConnectionManager,
    key_prefix: String,
}

impl RedisStore {
    pub async fn connect(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        let connection = ConnectionManager::new(client).await?;
        Ok(Self {
            client: connection,
            key_prefix: "auth_rate_limit".to_string(),
        })
    }

    fn redis_key(&self, client_key: &str) -> String {
        format!("{}:{client_key}", self.key_prefix)
    }

    pub async fn check(&self, key: &str) -> Result<(), StatusCode> {
        let redis_key = self.redis_key(key);
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .as_millis();
        let window_ms = u64::from(window_secs()) * 1000;
        let now_ms = u64::try_from(now_ms).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let window_start = now_ms.saturating_sub(window_ms);
        let member = format!("{now_ms}-{}", Uuid::new_v4());
        let max = max_requests();
        let ttl = window_secs();

        let mut conn = self.client.clone();
        let count: usize = redis::pipe()
            .atomic()
            .cmd("ZREMRANGEBYSCORE")
            .arg(&redis_key)
            .arg(0)
            .arg(window_start)
            .ignore()
            .cmd("ZADD")
            .arg(&redis_key)
            .arg(now_ms)
            .arg(&member)
            .ignore()
            .cmd("ZCARD")
            .arg(&redis_key)
            .query_async(&mut conn)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        if count > max {
            let _: Result<Value, _> = conn.zrem(&redis_key, member).await;
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }

        let _: Result<(), _> = conn.expire(&redis_key, ttl as i64).await;
        Ok(())
    }
}
