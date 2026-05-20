use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::vault_item::{CreateVaultItem, UpdateVaultItem, VaultItem, VaultItemResponse};

pub struct VaultItemRepository {
    pool: PgPool,
}

impl VaultItemRepository {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, create: CreateVaultItem) -> Result<VaultItemResponse, sqlx::Error> {
        let item = sqlx::query_as::<_, VaultItem>(
            r"
            INSERT INTO vault_items (user_id, encrypted_data, nonce, item_type)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, encrypted_data, nonce, item_type, created_at, updated_at
            ",
        )
        .bind(create.user_id)
        .bind(create.encrypted_data)
        .bind(create.nonce)
        .bind(create.item_type)
        .fetch_one(&self.pool)
        .await?;

        Ok(VaultItemResponse::from_item(item))
    }

    pub async fn find_by_user(
        &self,
        user_id: Uuid,
        since: Option<DateTime<Utc>>,
    ) -> Result<Vec<VaultItemResponse>, sqlx::Error> {
        let items = match since {
            Some(since) => {
                sqlx::query_as::<_, VaultItem>(
                    r"
                    SELECT id, user_id, encrypted_data, nonce, item_type, created_at, updated_at
                    FROM vault_items
                    WHERE user_id = $1 AND updated_at > $2
                    ORDER BY updated_at ASC, id ASC
                    ",
                )
                .bind(user_id)
                .bind(since)
                .fetch_all(&self.pool)
                .await?
            }
            None => {
                sqlx::query_as::<_, VaultItem>(
                    r"
                    SELECT id, user_id, encrypted_data, nonce, item_type, created_at, updated_at
                    FROM vault_items
                    WHERE user_id = $1
                    ORDER BY updated_at ASC, id ASC
                    ",
                )
                .bind(user_id)
                .fetch_all(&self.pool)
                .await?
            }
        };

        Ok(items
            .into_iter()
            .map(VaultItemResponse::from_item)
            .collect())
    }

    pub async fn find_by_id_for_user(
        &self,
        item_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<VaultItemResponse>, sqlx::Error> {
        let item = sqlx::query_as::<_, VaultItem>(
            "SELECT id, user_id, encrypted_data, nonce, item_type, created_at, updated_at FROM vault_items WHERE id = $1 AND user_id = $2",
        )
        .bind(item_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(item.map(VaultItemResponse::from_item))
    }

    pub async fn update_for_user(
        &self,
        item_id: Uuid,
        user_id: Uuid,
        update: UpdateVaultItem,
    ) -> Result<Option<VaultItemResponse>, sqlx::Error> {
        let item = sqlx::query_as::<_, VaultItem>(
            r"
            UPDATE vault_items
            SET
                encrypted_data = $1,
                nonce = $2,
                item_type = COALESCE($3, item_type),
                updated_at = NOW()
            WHERE id = $4 AND user_id = $5
            RETURNING id, user_id, encrypted_data, nonce, item_type, created_at, updated_at
            ",
        )
        .bind(update.encrypted_data)
        .bind(update.nonce)
        .bind(update.item_type)
        .bind(item_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(item.map(VaultItemResponse::from_item))
    }

    pub async fn delete_for_user(&self, item_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM vault_items WHERE id = $1 AND user_id = $2")
            .bind(item_id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }
}
