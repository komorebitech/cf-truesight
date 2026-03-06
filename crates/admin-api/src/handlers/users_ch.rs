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

    let env_filter = if params.environment.is_some() {
        " AND s.environment = ?"
    } else {
        ""
    };

    let search_filter = if params.search.is_some() {
        " HAVING positionCaseInsensitive(user_uid, ?) > 0 \
         OR positionCaseInsensitive(any(p.email), ?) > 0 \
         OR positionCaseInsensitive(any(p.name), ?) > 0"
    } else {
        ""
    };

    let query_str = format!(
        "SELECT s.user_uid AS user_uid, \
         COALESCE(any(p.email), '') AS email, \
         COALESCE(any(p.name), '') AS name, \
         COALESCE(any(p.mobile_number), '') AS mobile_number, \
         formatDateTime(min(s.first_seen), '%Y-%m-%d %H:%i:%S', 'UTC') AS first_seen, \
         formatDateTime(max(s.last_seen), '%Y-%m-%d %H:%i:%S', 'UTC') AS last_seen, \
         sum(s.event_count) AS event_count \
         FROM {db}.user_stats AS s \
         LEFT JOIN {db}.user_profiles FINAL AS p \
           ON s.project_id = p.project_id AND s.user_uid = p.user_uid AND s.environment = p.environment \
         WHERE s.project_id = ?{env_filter} \
         GROUP BY s.user_uid{search_filter} \
         ORDER BY last_seen DESC \
         LIMIT ? OFFSET ?"
    );

    let mut q = state.clickhouse_client.query(&query_str).bind(project_id);

    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    if let Some(ref search) = params.search {
        q = q.bind(search.as_str());
        q = q.bind(search.as_str());
        q = q.bind(search.as_str());
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

    let stats_env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    // Get profile data from user_profiles
    let profile_query = format!(
        "SELECT user_uid, \
         COALESCE(email, '') AS email, \
         COALESCE(name, '') AS name, \
         COALESCE(mobile_number, '') AS mobile_number, \
         toString(properties) AS properties \
         FROM {db}.user_profiles FINAL \
         WHERE project_id = ? AND user_uid = ?{env_filter} \
         LIMIT 1"
    );

    let mut pq = state
        .clickhouse_client
        .query(&profile_query)
        .bind(project_id)
        .bind(user_uid.as_str());
    if let Some(ref env) = params.environment {
        pq = pq.bind(env.as_str());
    }

    #[derive(clickhouse::Row, Deserialize)]
    struct ProfileOnly {
        user_uid: String,
        email: String,
        name: String,
        mobile_number: String,
        properties: String,
    }

    let profile = pq
        .fetch_optional::<ProfileOnly>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // Get accurate stats from user_stats
    let stats_query = format!(
        "SELECT sum(event_count) AS event_count, \
         formatDateTime(min(first_seen), '%Y-%m-%d %H:%i:%S', 'UTC') AS first_seen, \
         formatDateTime(max(last_seen), '%Y-%m-%d %H:%i:%S', 'UTC') AS last_seen \
         FROM {db}.user_stats \
         WHERE project_id = ? AND user_uid = ?{stats_env_filter}"
    );

    #[derive(clickhouse::Row, Deserialize)]
    struct StatsOnly {
        event_count: u64,
        first_seen: String,
        last_seen: String,
    }

    let mut sq = state
        .clickhouse_client
        .query(&stats_query)
        .bind(project_id)
        .bind(user_uid.as_str());
    if let Some(ref env) = params.environment {
        sq = sq.bind(env.as_str());
    }

    let stats = sq
        .fetch_optional::<StatsOnly>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    match (profile, stats) {
        (Some(p), Some(s)) => Ok(Json(UserDetailRow {
            user_uid: p.user_uid,
            email: p.email,
            name: p.name,
            mobile_number: p.mobile_number,
            properties: p.properties,
            first_seen: s.first_seen,
            last_seen: s.last_seen,
            event_count: s.event_count,
        })),
        (Some(p), None) => Ok(Json(UserDetailRow {
            user_uid: p.user_uid,
            email: p.email,
            name: p.name,
            mobile_number: p.mobile_number,
            properties: p.properties,
            first_seen: String::new(),
            last_seen: String::new(),
            event_count: 0,
        })),
        (None, Some(s)) => Ok(Json(UserDetailRow {
            user_uid: user_uid.clone(),
            email: String::new(),
            name: String::new(),
            mobile_number: String::new(),
            properties: String::new(),
            first_seen: s.first_seen,
            last_seen: s.last_seen,
            event_count: s.event_count,
        })),
        (None, None) => Err(AppError::NotFound(format!("User '{}' not found", user_uid))),
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
         formatDateTime(client_timestamp, '%Y-%m-%d %H:%i:%S', 'UTC') AS client_ts, \
         formatDateTime(server_timestamp, '%Y-%m-%d %H:%i:%S', 'UTC') AS server_ts, \
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
