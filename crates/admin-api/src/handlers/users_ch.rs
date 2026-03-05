use axum::{
    Json,
    extract::{Path, Query, State},
    response::IntoResponse,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::error::AppError;
use truesight_common::team::TeamRole;

use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

// ── Shared Defaults ─────────────────────────────────────────────────

fn default_page() -> u64 {
    1
}

fn default_per_page() -> u64 {
    50
}

// ── List Users ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    pub search: Option<String>,
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: u64,
    pub environment: Option<String>,
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct UserProfileRow {
    pub user_uid: String,
    pub email: String,
    pub name: String,
    pub mobile_number: String,
    pub first_seen: String,
    pub last_seen: String,
    pub event_count: u64,
}

#[derive(Debug, Serialize)]
pub struct ListUsersMetadata {
    pub page: u64,
    pub per_page: u64,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct ListUsersResponse {
    pub data: Vec<UserProfileRow>,
    pub meta: ListUsersMetadata,
}

pub async fn list_users(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<ListUsersQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 200);
    let offset = (page - 1) * per_page;
    let fetch_limit = per_page + 1;

    let mut conditions = vec!["project_id = ?".to_string()];

    if params.search.is_some() {
        conditions.push(
            "(positionCaseInsensitive(user_uid, ?) > 0 \
             OR positionCaseInsensitive(email, ?) > 0 \
             OR positionCaseInsensitive(name, ?) > 0)"
                .to_string(),
        );
    }
    if params.environment.is_some() {
        conditions.push("environment = ?".to_string());
    }

    let where_clause = conditions.join(" AND ");

    let query_str = format!(
        "SELECT user_uid, \
         COALESCE(email, '') AS email, \
         COALESCE(name, '') AS name, \
         COALESCE(mobile_number, '') AS mobile_number, \
         formatDateTime(first_seen, '%Y-%m-%d %H:%M:%S', 'UTC') AS first_seen, \
         formatDateTime(last_seen, '%Y-%m-%d %H:%M:%S', 'UTC') AS last_seen, \
         event_count \
         FROM {db}.user_profiles FINAL \
         WHERE {where_clause} \
         ORDER BY last_seen DESC \
         LIMIT ? OFFSET ?"
    );

    let mut q = state.clickhouse_client.query(&query_str).bind(project_id);

    if let Some(ref search) = params.search {
        q = q.bind(search.as_str());
        q = q.bind(search.as_str());
        q = q.bind(search.as_str());
    }
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }

    let mut rows = q
        .bind(fetch_limit)
        .bind(offset)
        .fetch_all::<UserProfileRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    let has_more = rows.len() as u64 > per_page;
    if has_more {
        rows.truncate(per_page as usize);
    }

    Ok(Json(ListUsersResponse {
        data: rows,
        meta: ListUsersMetadata {
            page,
            per_page,
            has_more,
        },
    }))
}

// ── Get User ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct GetUserQuery {
    pub environment: Option<String>,
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct UserDetailRow {
    pub user_uid: String,
    pub email: String,
    pub name: String,
    pub mobile_number: String,
    pub properties: String,
    pub first_seen: String,
    pub last_seen: String,
    pub event_count: u64,
}

pub async fn get_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, user_uid)): Path<(Uuid, String)>,
    Query(params): Query<GetUserQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;

    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let query_str = format!(
        "SELECT user_uid, \
         COALESCE(email, '') AS email, \
         COALESCE(name, '') AS name, \
         COALESCE(mobile_number, '') AS mobile_number, \
         toString(properties) AS properties, \
         formatDateTime(first_seen, '%Y-%m-%d %H:%M:%S', 'UTC') AS first_seen, \
         formatDateTime(last_seen, '%Y-%m-%d %H:%M:%S', 'UTC') AS last_seen, \
         event_count \
         FROM {db}.user_profiles FINAL \
         WHERE project_id = ? AND user_uid = ?{env_filter} \
         LIMIT 1"
    );

    let mut q = state
        .clickhouse_client
        .query(&query_str)
        .bind(project_id)
        .bind(user_uid.as_str());
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }

    let row = q
        .fetch_optional::<UserDetailRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    match row {
        Some(user) => Ok(Json(user)),
        None => Err(AppError::NotFound(format!("User '{}' not found", user_uid))),
    }
}

// ── User Events ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UserEventsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: u64,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub environment: Option<String>,
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct UserEventRow {
    pub event_id: String,
    pub project_id: String,
    pub event_name: String,
    pub event_type: String,
    pub user_id: String,
    pub anonymous_id: String,
    #[serde(rename = "client_timestamp")]
    pub client_ts: String,
    #[serde(rename = "server_timestamp")]
    pub server_ts: String,
    pub properties: String,
}

#[derive(Debug, Serialize)]
pub struct UserEventsMetadata {
    pub page: u64,
    pub per_page: u64,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct UserEventsResponse {
    pub data: Vec<UserEventRow>,
    pub meta: UserEventsMetadata,
}

pub async fn user_events(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, user_uid)): Path<(Uuid, String)>,
    Query(params): Query<UserEventsQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 200);
    let offset = (page - 1) * per_page;
    let fetch_limit = per_page + 1;

    let mut conditions = vec![
        "project_id = ?".to_string(),
        "COALESCE(NULLIF(user_id, ''), anonymous_id) = ?".to_string(),
    ];

    if params.from.is_some() {
        conditions.push("server_timestamp >= ?".to_string());
    }
    if params.to.is_some() {
        conditions.push("server_timestamp <= ?".to_string());
    }
    if params.environment.is_some() {
        conditions.push("environment = ?".to_string());
    }

    let where_clause = conditions.join(" AND ");

    let query_str = format!(
        "SELECT toString(event_id) AS event_id, toString(project_id) AS project_id, \
         event_name, event_type, \
         COALESCE(user_id, '') AS user_id, anonymous_id, \
         formatDateTime(client_timestamp, '%Y-%m-%d %H:%M:%S', 'UTC') AS client_ts, \
         formatDateTime(server_timestamp, '%Y-%m-%d %H:%M:%S', 'UTC') AS server_ts, \
         properties \
         FROM {db}.events \
         WHERE {where_clause} \
         ORDER BY server_timestamp DESC \
         LIMIT ? OFFSET ?"
    );

    let mut q = state
        .clickhouse_client
        .query(&query_str)
        .bind(project_id)
        .bind(user_uid.as_str());

    if let Some(ref from) = params.from {
        q = q.bind(from.timestamp_millis() as f64 / 1000.0);
    }
    if let Some(ref to) = params.to {
        q = q.bind(to.timestamp_millis() as f64 / 1000.0);
    }
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }

    let mut rows = q
        .bind(fetch_limit)
        .bind(offset)
        .fetch_all::<UserEventRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    let has_more = rows.len() as u64 > per_page;
    if has_more {
        rows.truncate(per_page as usize);
    }

    Ok(Json(UserEventsResponse {
        data: rows,
        meta: UserEventsMetadata {
            page,
            per_page,
            has_more,
        },
    }))
}
