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
        STANDARD.decode(encoded).map_err(serde::de::Error::custom)
    }
}

const ALLOWED_ITEM_TYPES: [&str; 3] = ["login", "note", "card"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InvalidVaultItemType;

/// Returns `Ok(())` when `item_type` is one of `login`, `note`, or `card`.
pub fn validate_item_type(item_type: &str) -> Result<(), InvalidVaultItemType> {
    if ALLOWED_ITEM_TYPES.contains(&item_type) {
        Ok(())
    } else {
        Err(InvalidVaultItemType)
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

#[derive(Debug, Clone)]
pub struct UpdateVaultItem {
    pub encrypted_data: Vec<u8>,
    pub nonce: Vec<u8>,
    pub item_type: Option<String>,
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

#[derive(Debug, Clone, Serialize)]
pub struct VaultItemListResponse {
    pub items: Vec<VaultItemResponse>,
    pub sync_token: Option<DateTime<Utc>>,
}

impl VaultItemListResponse {
    pub fn from_items(items: Vec<VaultItemResponse>) -> Self {
        let sync_token = items.iter().map(|item| item.updated_at).max();
        Self { items, sync_token }
    }
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
    use chrono::TimeZone;
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

    #[test]
    fn validate_item_type_accepts_supported_values() {
        for item_type in ["login", "note", "card"] {
            assert!(validate_item_type(item_type).is_ok());
        }
    }

    #[test]
    fn vault_item_list_response_sets_sync_token_to_max_updated_at() {
        let older = Utc.with_ymd_and_hms(2026, 5, 20, 10, 0, 0).unwrap();
        let newer = Utc.with_ymd_and_hms(2026, 5, 20, 12, 0, 0).unwrap();
        let items = vec![
            VaultItemResponse {
                id: Uuid::nil(),
                item_type: "login".to_string(),
                encrypted_data: vec![1],
                nonce: vec![2],
                created_at: older,
                updated_at: older,
            },
            VaultItemResponse {
                id: Uuid::new_v4(),
                item_type: "note".to_string(),
                encrypted_data: vec![3],
                nonce: vec![4],
                created_at: newer,
                updated_at: newer,
            },
        ];

        let response = VaultItemListResponse::from_items(items);
        assert_eq!(response.sync_token, Some(newer));
        assert_eq!(response.items.len(), 2);
    }

    #[test]
    fn vault_item_list_response_has_no_sync_token_when_empty() {
        let response = VaultItemListResponse::from_items(vec![]);
        assert!(response.sync_token.is_none());
        assert!(response.items.is_empty());
    }

    #[test]
    fn validate_item_type_rejects_unknown_values() {
        assert!(validate_item_type("password").is_err());
        assert!(validate_item_type("").is_err());
        assert!(validate_item_type("LOGIN").is_err());
    }
}
