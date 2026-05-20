use axum::{extract::State, Extension, Json};
use serde::Deserialize;

use crate::{
    middleware::jwt_auth::AuthenticatedUser,
    models::vault_item::{base64_bytes, CreateVaultItem, VaultItemResponse},
    repositories::vault_item_repository::VaultItemRepository,
    AppState,
};

#[derive(Deserialize)]
pub struct CreateVaultItemRequest {
    pub item_type: String,
    #[serde(with = "base64_bytes")]
    pub encrypted_data: Vec<u8>,
    #[serde(with = "base64_bytes")]
    pub nonce: Vec<u8>,
}

pub async fn create_vault_item(
    State(state): State<AppState>,
    Extension(AuthenticatedUser(user_id)): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateVaultItemRequest>,
) -> Json<VaultItemResponse> {
    let repo = VaultItemRepository::new(state.db.clone());

    let create = CreateVaultItem {
        user_id,
        encrypted_data: payload.encrypted_data,
        nonce: payload.nonce,
        item_type: payload.item_type,
    };

    match repo.create(create).await {
        Ok(item) => Json(item),
        Err(e) => {
            tracing::error!(?e, "failed to create vault item");
            Json(VaultItemResponse {
                id: uuid::Uuid::nil(),
                item_type: String::new(),
                encrypted_data: Vec::new(),
                nonce: Vec::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
        }
    }
}

pub async fn list_vault_items(
    State(state): State<AppState>,
    Extension(AuthenticatedUser(user_id)): Extension<AuthenticatedUser>,
) -> Json<Vec<VaultItemResponse>> {
    let repo = VaultItemRepository::new(state.db.clone());

    match repo.find_by_user(user_id).await {
        Ok(items) => Json(items),
        Err(e) => {
            tracing::error!(?e, "failed to list vault items");
            Json(vec![])
        }
    }
}
