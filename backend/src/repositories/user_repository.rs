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
            INSERT INTO users (email, master_password_hash)
            VALUES ($1, $2)
            RETURNING id, email, master_password_hash, created_at, updated_at
            ",
        )
        .bind(&user.email)
        .bind(&user.master_password_hash)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn find_by_email(&self, email: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r"
            SELECT id, email, master_password_hash, created_at, updated_at
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
