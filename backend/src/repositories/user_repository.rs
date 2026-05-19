use anyhow::Result;
use sqlx::PgPool;

use crate::models::user::{CreateUser, User};

pub struct UserRepository {
    pool: PgPool,
}

impl UserRepository {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, user: CreateUser) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r"
            INSERT INTO users (email, login_hash, verification_token)
            VALUES ($1, $2, $3)
            RETURNING id, email, login_hash, email_verified, created_at, updated_at
            ",
        )
        .bind(&user.email)
        .bind(&user.login_hash)
        .bind(&user.verification_token)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn verify_email(&self, token: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r"
            UPDATE users
            SET email_verified = true,
                verification_token = NULL,
                updated_at = NOW()
            WHERE verification_token = $1
              AND email_verified = false
            RETURNING id, email, login_hash, email_verified, created_at, updated_at
            ",
        )
        .bind(token)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn find_by_email(&self, email: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r"
            SELECT id, email, login_hash, email_verified, created_at, updated_at
            FROM users
            WHERE email = $1
            ",
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn email_exists(&self, email: &str) -> Result<bool> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE email = $1")
            .bind(email)
            .fetch_one(&self.pool)
            .await?;

        Ok(count.0 > 0)
    }
}
