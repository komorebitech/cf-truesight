use axum::{
    Json,
    extract::{Path, Query, State},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::error::AppError;
use truesight_common::team::TeamRole;

use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

// ── List Event Catalog ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EventCatalogQuery {
    pub q: Option<String>,
    #[serde(default = "default_catalog_limit")]
    pub limit: u64,
    pub environment: Option<String>,
}

fn default_catalog_limit() -> u64 {
    100
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct CatalogEventRow {
    pub event_name: String,
    pub event_type: String,
    pub event_count: u64,
    pub first_seen: String,
    pub last_seen: String,
}

#[derive(Debug, Serialize)]
pub struct EventCatalogResponse {
    pub events: Vec<CatalogEventRow>,
}

pub async fn event_catalog(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<EventCatalogQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let limit = params.limit.clamp(1, 500);

    let search_filter = if params.q.as_ref().is_some_and(|q| !q.is_empty()) {
        " AND positionCaseInsensitive(event_name, ?) > 0"
    } else {
        ""
    };
    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let query = format!(
        "SELECT event_name, event_type, \
         sum(event_count) AS event_count, \
         formatDateTime(min(first_seen), '%Y-%m-%dT%H:%i:%SZ', 'UTC') AS first_seen, \
         formatDateTime(max(last_seen), '%Y-%m-%dT%H:%i:%SZ', 'UTC') AS last_seen \
         FROM {db}.event_catalog \
         WHERE project_id = ?{search_filter}{env_filter} \
         GROUP BY event_name, event_type \
         ORDER BY event_count DESC \
         LIMIT ?"
    );

    let mut q = state.clickhouse_client.query(&query).bind(project_id);
    if let Some(search) = params.q.as_ref().filter(|s| !s.is_empty()) {
        q = q.bind(search.as_str());
    }
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let rows = q
        .bind(limit)
        .fetch_all::<CatalogEventRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(EventCatalogResponse { events: rows }))
}

// ── Event Property Keys ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EventPropertiesQuery {
    pub environment: Option<String>,
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct PropertyKeyRow {
    pub property_key: String,
    pub first_seen: String,
}

#[derive(Debug, Serialize)]
pub struct EventPropertiesResponse {
    pub event_name: String,
    pub properties: Vec<PropertyKeyRow>,
}

pub async fn event_properties(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, event_name)): Path<(Uuid, String)>,
    Query(params): Query<EventPropertiesQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;

    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let query = format!(
        "SELECT property_key, \
         formatDateTime(min(first_seen), '%Y-%m-%dT%H:%i:%SZ', 'UTC') AS first_seen \
         FROM {db}.event_property_keys \
         WHERE project_id = ? AND event_name = ?{env_filter} \
         GROUP BY property_key \
         ORDER BY property_key"
    );

    let mut q = state
        .clickhouse_client
        .query(&query)
        .bind(project_id)
        .bind(event_name.as_str());
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let rows = q
        .fetch_all::<PropertyKeyRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(EventPropertiesResponse {
        event_name,
        properties: rows,
    }))
}
