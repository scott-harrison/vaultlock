use sqlx::PgPool;
use uuid::Uuid;

use crate::crypto::aes_gcm::encrypt;
use crate::models::vault_item::{CreateVaultItem, VaultItem, VaultItemResponse};

pub struct VaultItemRepository {
    pool: PgPool,
}

impl VaultItemRepository {
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, create: CreateVaultItem) -> Result<VaultItemResponse, sqlx::Error> {
        // Encrypt the plaintext using the DEK
        let (nonce, encrypted_data) = encrypt(&create.plaintext, &create.dek)
            .map_err(|_| sqlx::Error::Protocol("encryption failed".into()))?;

        let item = sqlx::query_as::<_, VaultItem>(
            r"
            INSERT INTO vault_items (user_id, encrypted_data, nonce, item_type)
            VALUES ($1, $2, $3, $4)
            RETURNING id, user_id, encrypted_data, nonce, item_type, created_at, updated_at
            ",
        )
        .bind(create.user_id)
        .bind(encrypted_data)
        .bind(nonce)
        .bind(create.item_type)
        .fetch_one(&self.pool)
        .await?;

        Ok(VaultItemResponse {
            id: item.id,
            item_type: item.item_type,
            created_at: item.created_at,
            updated_at: item.updated_at,
        })
    }

    pub async fn find_by_user(&self, user_id: Uuid) -> Result<Vec<VaultItemResponse>, sqlx::Error> {
        let items = sqlx::query_as::<_, VaultItem>(
            "SELECT id, user_id, encrypted_data, nonce, item_type, created_at, updated_at FROM vault_items WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(items
            .into_iter()
            .map(|item| VaultItemResponse {
                id: item.id,
                item_type: item.item_type,
                created_at: item.created_at,
                updated_at: item.updated_at,
            })
            .collect())
    }
}
