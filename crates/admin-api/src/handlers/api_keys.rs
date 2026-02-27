use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::api_key::{ApiKeyResponse, NewApiKey};
use truesight_common::auth::hash_api_key;
use truesight_common::error::AppError;

use crate::state::AppState;

pub async fn list_api_keys(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let keys = crate::db::api_keys::list_api_keys_for_project(&state.db_pool, project_id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    let responses: Vec<ApiKeyResponse> = keys.into_iter().map(ApiKeyResponse::from).collect();
    Ok(Json(responses))
}

#[derive(Debug, Deserialize)]
pub struct GenerateApiKeyRequest {
    pub label: String,
    pub environment: String,
}

#[derive(Debug, Serialize)]
pub struct GenerateApiKeyResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub prefix: String,
    pub label: String,
    pub environment: String,
    pub active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// The plaintext key, only returned once at creation time.
    pub key: String,
}

pub async fn generate_api_key_handler(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<GenerateApiKeyRequest>,
) -> Result<impl IntoResponse, AppError> {
    // Validate environment
    if body.environment != "live" && body.environment != "test" {
        return Err(AppError::Validation(
            "environment must be 'live' or 'test'".to_string(),
        ));
    }

    // Verify project exists
    crate::db::projects::find_project(&state.db_pool, project_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound(format!("Project {} not found", project_id)))?;

    // Generate the key
    let (full_key, prefix) = truesight_common::api_key::generate_api_key(&body.environment);

    // Hash the key
    let key_hash = hash_api_key(&full_key)
        .map_err(|e| AppError::Internal(format!("Failed to hash API key: {}", e)))?;

    let new_key = NewApiKey {
        project_id,
        prefix,
        key_hash,
        label: body.label,
        environment: body.environment,
    };

    let api_key = crate::db::api_keys::insert_api_key(&state.db_pool, new_key)
        .map_err(|e| AppError::Database(e.to_string()))?;

    let response = GenerateApiKeyResponse {
        id: api_key.id,
        project_id: api_key.project_id,
        prefix: api_key.prefix,
        label: api_key.label,
        environment: api_key.environment,
        active: api_key.active,
        created_at: api_key.created_at,
        key: full_key,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn revoke_api_key(
    State(state): State<AppState>,
    Path((project_id, key_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    let revoked = crate::db::api_keys::revoke_api_key(&state.db_pool, project_id, key_id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    if !revoked {
        return Err(AppError::NotFound(format!(
            "API key {} not found for project {}",
            key_id, project_id
        )));
    }

    Ok(StatusCode::NO_CONTENT)
}
