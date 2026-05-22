use sqlx::PgPool;
use uuid::Uuid;

use crate::models::refresh_token::{CreateRefreshToken, RefreshToken};

pub struct RefreshTokenRepository {
    pool: PgPool,
}

impl RefreshTokenRepository {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, create: CreateRefreshToken) -> Result<RefreshToken, sqlx::Error> {
        sqlx::query_as::<_, RefreshToken>(
            r"
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, token_hash, expires_at, created_at, revoked
            ",
        )
        .bind(create.user_id)
        .bind(create.token_hash)
        .bind(create.expires_at)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn find_any_by_token_hash(
        &self,
        token_hash: &str,
    ) -> Result<Option<RefreshToken>, sqlx::Error> {
        sqlx::query_as::<_, RefreshToken>(
            r"
            SELECT id, user_id, token_hash, expires_at, created_at, revoked
            FROM refresh_tokens
            WHERE token_hash = $1
            ",
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn revoke(&self, id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn revoke_all_for_user(&self, user_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn rotate(
        &self,
        previous_id: Uuid,
        next: CreateRefreshToken,
    ) -> Result<RefreshToken, sqlx::Error> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1")
            .bind(previous_id)
            .execute(&mut *tx)
            .await?;

        let created = sqlx::query_as::<_, RefreshToken>(
            r"
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, token_hash, expires_at, created_at, revoked
            ",
        )
        .bind(next.user_id)
        .bind(next.token_hash)
        .bind(next.expires_at)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(created)
    }
}
