use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::api_key::{ApiKeyResponse, NewApiKey};
use truesight_common::auth::hash_api_key;
use truesight_common::error::AppError;
use truesight_common::team::TeamRole;

use crate::handlers::pagination::{PaginatedResponse, PaginationMeta, SortOrder, validate_sort_column};
use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

const ALLOWED_SORT_COLUMNS: &[&str] = &["label", "environment", "created_at"];

#[derive(Debug, Deserialize)]
pub struct ListApiKeysQuery {
    pub page: Option<u64>,
    pub per_page: Option<u64>,
    pub sort_by: Option<String>,
    #[serde(default)]
    pub sort_order: SortOrder,
}

pub async fn list_api_keys(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<ListApiKeysQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * per_page;

    let sort_col = match params.sort_by.as_deref() {
        Some(col) => validate_sort_column(col, ALLOWED_SORT_COLUMNS)?,
        None => "created_at",
    };

    let (keys, total) = crate::db::api_keys::list_api_keys_for_project(
        &state.db_pool,
        project_id,
        per_page as i64,
        offset as i64,
        sort_col,
        &params.sort_order,
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    let responses: Vec<ApiKeyResponse> = keys.into_iter().map(ApiKeyResponse::from).collect();
    let has_more = (offset + per_page) < total as u64;

    Ok(Json(PaginatedResponse {
        data: responses,
        meta: PaginationMeta {
            page,
            per_page,
            has_more,
            total: Some(total),
        },
    }))
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
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(body): Json<GenerateApiKeyRequest>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;

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
    auth: AuthUser,
    Path((project_id, key_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;

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
