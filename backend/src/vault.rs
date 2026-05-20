use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    middleware::jwt_auth::AuthenticatedUser,
    models::vault_item::{
        base64_bytes, validate_item_type, CreateVaultItem, UpdateVaultItem, VaultItemResponse,
    },
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

#[derive(Deserialize)]
pub struct UpdateVaultItemRequest {
    #[serde(with = "base64_bytes")]
    pub encrypted_data: Vec<u8>,
    #[serde(with = "base64_bytes")]
    pub nonce: Vec<u8>,
    #[serde(default)]
    pub item_type: Option<String>,
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

pub async fn get_vault_item(
    State(state): State<AppState>,
    Extension(AuthenticatedUser(user_id)): Extension<AuthenticatedUser>,
    Path(item_id): Path<Uuid>,
) -> Result<Json<VaultItemResponse>, (StatusCode, Json<VaultErrorResponse>)> {
    let repo = VaultItemRepository::new(state.db.clone());

    match repo.find_by_id_for_user(item_id, user_id).await {
        Ok(Some(item)) => Ok(Json(item)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(VaultErrorResponse {
                message: "vault item not found".to_string(),
            }),
        )),
        Err(e) => {
            tracing::error!(?e, "failed to get vault item");
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VaultErrorResponse {
                    message: "failed to get vault item".to_string(),
                }),
            ))
        }
    }
}

pub async fn update_vault_item(
    State(state): State<AppState>,
    Extension(AuthenticatedUser(user_id)): Extension<AuthenticatedUser>,
    Path(item_id): Path<Uuid>,
    Json(payload): Json<UpdateVaultItemRequest>,
) -> Result<Json<VaultItemResponse>, (StatusCode, Json<VaultErrorResponse>)> {
    if let Some(item_type) = &payload.item_type {
        if validate_item_type(item_type).is_err() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(VaultErrorResponse {
                    message: "item_type must be one of: login, note, card".to_string(),
                }),
            ));
        }
    }

    let repo = VaultItemRepository::new(state.db.clone());
    let update = UpdateVaultItem {
        encrypted_data: payload.encrypted_data,
        nonce: payload.nonce,
        item_type: payload.item_type,
    };

    match repo.update_for_user(item_id, user_id, update).await {
        Ok(Some(item)) => Ok(Json(item)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(VaultErrorResponse {
                message: "vault item not found".to_string(),
            }),
        )),
        Err(e) => {
            tracing::error!(?e, "failed to update vault item");
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VaultErrorResponse {
                    message: "failed to update vault item".to_string(),
                }),
            ))
        }
    }
}

pub async fn delete_vault_item(
    State(state): State<AppState>,
    Extension(AuthenticatedUser(user_id)): Extension<AuthenticatedUser>,
    Path(item_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<VaultErrorResponse>)> {
    let repo = VaultItemRepository::new(state.db.clone());

    match repo.delete_for_user(item_id, user_id).await {
        Ok(true) => Ok(StatusCode::NO_CONTENT),
        Ok(false) => Err((
            StatusCode::NOT_FOUND,
            Json(VaultErrorResponse {
                message: "vault item not found".to_string(),
            }),
        )),
        Err(e) => {
            tracing::error!(?e, "failed to delete vault item");
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(VaultErrorResponse {
                    message: "failed to delete vault item".to_string(),
                }),
            ))
        }
    }
}
