use axum::{extract::State, http::StatusCode, Extension, Json};
use serde::{Deserialize, Serialize};

use crate::{
    middleware::jwt_auth::AuthenticatedUser,
    models::vault_item::{base64_bytes, validate_item_type, CreateVaultItem, VaultItemResponse},
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

#[derive(Serialize)]
pub struct VaultErrorResponse {
    pub message: String,
}

pub async fn create_vault_item(
    State(state): State<AppState>,
    Extension(AuthenticatedUser(user_id)): Extension<AuthenticatedUser>,
    Json(payload): Json<CreateVaultItemRequest>,
) -> Result<Json<VaultItemResponse>, (StatusCode, Json<VaultErrorResponse>)> {
    if validate_item_type(&payload.item_type).is_err() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(VaultErrorResponse {
                message: "item_type must be one of: login, note, card".to_string(),
            }),
        ));
    }

    let repo = VaultItemRepository::new(state.db.clone());

    let create = CreateVaultItem {
        user_id,
        encrypted_data: payload.encrypted_data,
        nonce: payload.nonce,
        item_type: payload.item_type,
    };

    match repo.create(create).await {
        Ok(item) => Ok(Json(item)),
        Err(e) => {
            tracing::error!(?e, "failed to create vault item");
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VaultErrorResponse {
                    message: "failed to create vault item".to_string(),
                }),
            ))
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
