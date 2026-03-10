use axum::{
    Json,
    extract::{Path, Query, State},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::error::AppError;
use truesight_common::team::TeamRole;

use crate::handlers::pagination::{PaginatedResponse, PaginationMeta, SortOrder, validate_sort_column};
use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

const CATALOG_SORT_COLUMNS: &[&str] = &["event_name", "event_count", "first_seen", "last_seen"];

// ── List Event Catalog ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EventCatalogQuery {
    pub q: Option<String>,
    pub page: Option<u64>,
    pub per_page: Option<u64>,
    pub environment: Option<String>,
    pub sort_by: Option<String>,
    #[serde(default)]
    pub sort_order: SortOrder,
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct CatalogEventRow {
    pub event_name: String,
    pub event_type: String,
    pub event_count: u64,
    pub first_seen: String,
    pub last_seen: String,
}

pub async fn event_catalog(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<EventCatalogQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(100).clamp(1, 500);
    let offset = (page - 1) * per_page;
    let fetch_limit = per_page + 1;

    let sort_col = match params.sort_by.as_deref() {
        Some(col) => validate_sort_column(col, CATALOG_SORT_COLUMNS)?,
        None => "event_count",
    };
    let sort_dir = params.sort_order.as_sql();

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
         WHERE project_id = ? AND NOT startsWith(event_name, '$'){search_filter}{env_filter} \
         GROUP BY event_name, event_type \
         ORDER BY {sort_col} {sort_dir} \
         LIMIT ? OFFSET ?"
    );

    let mut q = state.clickhouse_client.query(&query).bind(project_id);
    if let Some(search) = params.q.as_ref().filter(|s| !s.is_empty()) {
        q = q.bind(search.as_str());
    }
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let mut rows = q
        .bind(fetch_limit)
        .bind(offset)
        .fetch_all::<CatalogEventRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    let has_more = rows.len() as u64 > per_page;
    if has_more {
        rows.truncate(per_page as usize);
    }

    Ok(Json(PaginatedResponse {
        data: rows,
        meta: PaginationMeta {
            page,
            per_page,
            has_more,
            total: None,
        },
    }))
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
