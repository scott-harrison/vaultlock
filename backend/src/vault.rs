use axum::{extract::State, Json};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    crypto::aes_gcm::decrypt,
    models::vault_item::{CreateVaultItem, VaultItemResponse},
    repositories::vault_item_repository::VaultItemRepository,
    AppState,
};

#[derive(Deserialize)]
pub struct CreateVaultItemRequest {
    pub plaintext: Vec<u8>,
    pub item_type: String,
    pub dek: [u8; 32], // In real app, this would come from session/JWT
}

pub async fn create_vault_item(
    State(state): State<AppState>,
    Json(payload): Json<CreateVaultItemRequest>,
) -> Json<VaultItemResponse> {
    let repo = VaultItemRepository::new(state.db.clone());

    // TODO: Get user_id from authenticated session
    let user_id = Uuid::new_v4(); // Placeholder

    let create = CreateVaultItem {
        user_id,
        plaintext: payload.plaintext,
        item_type: payload.item_type,
        dek: payload.dek,
    };

    match repo.create(create).await {
        Ok(item) => Json(item),
        Err(e) => {
            tracing::error!(?e, "failed to create vault item");
            // In production, return proper error response
            panic!("Failed to create vault item");
        }
    }
}

pub async fn list_vault_items(
    State(state): State<AppState>,
) -> Json<Vec<VaultItemResponse>> {
    let repo = VaultItemRepository::new(state.db.clone());

    // TODO: Get user_id from authenticated session
    let user_id = Uuid::new_v4(); // Placeholder

    match repo.find_by_user(user_id).await {
        Ok(items) => Json(items),
        Err(e) => {
            tracing::error!(?e, "failed to list vault items");
            Json(vec![])
        }
    }
}