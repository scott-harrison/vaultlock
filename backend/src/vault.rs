use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    models::vault_item::{CreateVaultItem, VaultItemResponse},
    repositories::vault_item_repository::VaultItemRepository,
    AppState,
};

#[derive(Deserialize)]
pub struct CreateVaultItemRequest {
    pub user_id: Uuid, // TODO: derive from auth middleware
    pub plaintext: Vec<u8>,
    pub item_type: String,
    pub dek: [u8; 32], // In real app, this would come from client after unwrapping
}

#[derive(Deserialize)]
pub struct ListVaultItemsQuery {
    pub user_id: Uuid, // TODO: derive from auth middleware
}

pub async fn create_vault_item(
    State(state): State<AppState>,
    Json(payload): Json<CreateVaultItemRequest>,
) -> Json<VaultItemResponse> {
    let repo = VaultItemRepository::new(state.db.clone());

    let create = CreateVaultItem {
        user_id: payload.user_id,
        plaintext: payload.plaintext,
        item_type: payload.item_type,
        dek: payload.dek,
    };

    match repo.create(create).await {
        Ok(item) => Json(item),
        Err(e) => {
            tracing::error!(?e, "failed to create vault item");
            // Return empty response for now - in production, return proper error
            Json(VaultItemResponse {
                id: Uuid::nil(),
                item_type: String::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
        }
    }
}

pub async fn list_vault_items(
    State(state): State<AppState>,
    Query(query): Query<ListVaultItemsQuery>,
) -> Json<Vec<VaultItemResponse>> {
    let repo = VaultItemRepository::new(state.db.clone());

    match repo.find_by_user(query.user_id).await {
        Ok(items) => Json(items),
        Err(e) => {
            tracing::error!(?e, "failed to list vault items");
            Json(vec![])
        }
    }
}
