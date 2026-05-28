use super::{max_requests, window_secs};
use axum::http::StatusCode;
use sqlx::PgPool;

#[derive(Clone)]
pub struct PostgresStore {
    pool: PgPool,
}

impl PostgresStore {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn check(&self, key: &str) -> Result<(), StatusCode> {
        let max = i64::try_from(max_requests()).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let window = i32::try_from(window_secs()).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        sqlx::query(
            "DELETE FROM rate_limit_events
             WHERE client_key = $1
               AND requested_at < NOW() - make_interval(secs => $2)",
        )
        .bind(key)
        .bind(window)
        .execute(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM rate_limit_events WHERE client_key = $1",
        )
        .bind(key)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        if count >= max {
            return Err(StatusCode::TOO_MANY_REQUESTS);
        }

        sqlx::query("INSERT INTO rate_limit_events (client_key) VALUES ($1)")
            .bind(key)
            .execute(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        tx.commit()
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        Ok(())
    }
}
