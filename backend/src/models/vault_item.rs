use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

pub mod base64_bytes {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&STANDARD.encode(bytes))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let encoded = String::deserialize(deserializer)?;
        STANDARD
            .decode(encoded)
            .map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct VaultItem {
    pub id: Uuid,
    pub user_id: Uuid,
    pub encrypted_data: Vec<u8>,
    pub nonce: Vec<u8>,
    pub item_type: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct CreateVaultItem {
    pub user_id: Uuid,
    pub encrypted_data: Vec<u8>,
    pub nonce: Vec<u8>,
    pub item_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct VaultItemResponse {
    pub id: Uuid,
    pub item_type: String,
    #[serde(with = "base64_bytes")]
    pub encrypted_data: Vec<u8>,
    #[serde(with = "base64_bytes")]
    pub nonce: Vec<u8>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl VaultItemResponse {
    pub fn from_item(item: VaultItem) -> Self {
        Self {
            id: item.id,
            item_type: item.item_type,
            encrypted_data: item.encrypted_data,
            nonce: item.nonce,
            created_at: item.created_at,
            updated_at: item.updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::expect_used)]

    use super::*;
    use serde_json::json;

    #[test]
    fn vault_item_response_serializes_ciphertext_as_base64() {
        let response = VaultItemResponse {
            id: Uuid::nil(),
            item_type: "login".to_string(),
            encrypted_data: vec![1, 2, 3],
            nonce: vec![4, 5, 6],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let value = serde_json::to_value(response).expect("json");
        assert_eq!(value["encrypted_data"], json!("AQID"));
        assert_eq!(value["nonce"], json!("BAUG"));
    }
}
