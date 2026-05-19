use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct VaultItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub encrypted_data: Vec<u8>,
    pub nonce: Vec<u8>,
    pub item_type: String, // "password", "note", etc.
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateVaultItem {
    pub user_id: Uuid,
    pub plaintext: Vec<u8>,
    pub item_type: String,
    pub dek: [u8; 32], // Data Encryption Key (unwrapped)
}

#[derive(Debug, Clone, Serialize)]
pub struct VaultItemResponse {
    pub id: Uuid,
    pub item_type: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}