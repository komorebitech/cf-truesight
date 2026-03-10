use axum::{
    Json,
    extract::{Path, Query, State},
    response::IntoResponse,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::error::AppError;
use truesight_common::team::TeamRole;

use crate::handlers::pagination::{PaginatedResponse, PaginationMeta, SortOrder, validate_sort_column};
use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

const EVENTS_SORT_COLUMNS: &[&str] = &["client_timestamp", "server_timestamp", "event_name", "event_type"];

// ── Event Count ──────────────────────────────────────────────────────

fn default_from() -> DateTime<Utc> {
    Utc::now() - Duration::days(30)
}

fn default_to() -> DateTime<Utc> {
    Utc::now()
}

#[derive(Debug, Deserialize)]
pub struct TimeRangeQuery {
    #[serde(default = "default_from")]
    pub from: DateTime<Utc>,
    #[serde(default = "default_to")]
    pub to: DateTime<Utc>,
    pub environment: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EventCountResponse {
    pub project_id: Uuid,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub total_events: u64,
}

pub async fn event_count(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<TimeRangeQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };
    let query = format!(
        "SELECT count() AS cnt FROM {}.events WHERE project_id = ? AND server_timestamp BETWEEN ? AND ?{}",
        state.config.clickhouse_database, env_filter
    );

    let mut q = state
        .clickhouse_client
        .query(&query)
        .bind(project_id)
        .bind(params.from.timestamp_millis() as f64 / 1000.0)
        .bind(params.to.timestamp_millis() as f64 / 1000.0);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let count: u64 = q
        .fetch_one::<u64>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(EventCountResponse {
        project_id,
        from: params.from,
        to: params.to,
        total_events: count,
    }))
}

// ── Throughput ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ThroughputQuery {
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    #[serde(default = "default_granularity")]
    pub granularity: String,
    pub environment: Option<String>,
}

fn default_granularity() -> String {
    "hour".to_string()
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct ThroughputBucket {
    pub timestamp: f64,
    pub count: u64,
}

#[derive(Debug, Serialize)]
pub struct ThroughputResponse {
    pub project_id: Uuid,
    pub granularity: String,
    pub data: Vec<ThroughputBucket>,
}

pub async fn throughput(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<ThroughputQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let trunc_fn = match params.granularity.as_str() {
        "minute" => "toStartOfMinute",
        _ => "toStartOfHour",
    };

    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };
    let query = format!(
        "SELECT toFloat64(toUnixTimestamp({}(server_timestamp))) AS timestamp, count() AS count \
         FROM {}.events \
         WHERE project_id = ? AND server_timestamp BETWEEN ? AND ?{} \
         GROUP BY timestamp \
         ORDER BY timestamp",
        trunc_fn, state.config.clickhouse_database, env_filter
    );

    let mut q = state
        .clickhouse_client
        .query(&query)
        .bind(project_id)
        .bind(params.from.timestamp_millis() as f64 / 1000.0)
        .bind(params.to.timestamp_millis() as f64 / 1000.0);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let rows = q
        .fetch_all::<ThroughputBucket>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(ThroughputResponse {
        project_id,
        granularity: params.granularity,
        data: rows,
    }))
}

// ── Event Types ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EventTypesQuery {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    #[serde(default = "default_limit")]
    pub limit: u64,
    pub environment: Option<String>,
}

fn default_limit() -> u64 {
    10
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct TypeCount {
    pub event_type: String,
    pub count: u64,
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct TopEvent {
    pub name: String,
    pub count: u64,
}

#[derive(Debug, Serialize)]
pub struct EventTypesResponse {
    pub by_type: serde_json::Value,
    pub top_events: Vec<TopEvent>,
}

pub async fn event_types(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<EventTypesQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let now = Utc::now();
    let from = params
        .from
        .unwrap_or_else(|| now - chrono::Duration::days(90));
    let to = params.to.unwrap_or(now);
    let from_ts = from.timestamp_millis() as f64 / 1000.0;
    let to_ts = to.timestamp_millis() as f64 / 1000.0;
    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    // By type
    let by_type_query = format!(
        "SELECT event_type, count() AS count FROM {}.events \
         WHERE project_id = ? AND server_timestamp BETWEEN ? AND ?{} \
         AND NOT startsWith(event_name, '$') \
         GROUP BY event_type",
        db, env_filter
    );

    let mut q = state
        .clickhouse_client
        .query(&by_type_query)
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let type_rows = q
        .fetch_all::<TypeCount>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    let mut by_type_map = serde_json::Map::new();
    for row in &type_rows {
        by_type_map.insert(
            row.event_type.clone(),
            serde_json::Value::Number(serde_json::Number::from(row.count)),
        );
    }

    // Top events by name
    let top_query = format!(
        "SELECT event_name AS name, count() AS count FROM {}.events \
         WHERE project_id = ? AND server_timestamp BETWEEN ? AND ?{} \
         AND NOT startsWith(event_name, '$') \
         GROUP BY name ORDER BY count DESC LIMIT ?",
        db, env_filter
    );

    let mut q = state
        .clickhouse_client
        .query(&top_query)
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let top_rows = q
        .bind(params.limit)
        .fetch_all::<TopEvent>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(EventTypesResponse {
        by_type: serde_json::Value::Object(by_type_map),
        top_events: top_rows,
    }))
}

// ── Event Name Search ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EventNamesQuery {
    pub q: Option<String>,
    #[serde(default = "default_event_names_limit")]
    pub limit: u64,
    pub environment: Option<String>,
}

fn default_event_names_limit() -> u64 {
    25
}

#[derive(Debug, Serialize)]
pub struct EventNamesResponse {
    pub event_names: Vec<TopEvent>,
}

pub async fn event_names(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<EventNamesQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let limit = params.limit.clamp(1, 100);

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
        "SELECT event_name AS name, count() AS count FROM {db}.events \
         WHERE project_id = ? AND NOT startsWith(event_name, '$'){search_filter}{env_filter} \
         GROUP BY name ORDER BY count DESC LIMIT ?"
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
        .fetch_all::<TopEvent>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(EventNamesResponse { event_names: rows }))
}

// ── List Events ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListEventsQuery {
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub event_type: Option<String>,
    pub event_name: Option<String>,
    pub user_id: Option<String>,
    pub anonymous_id: Option<String>,
    pub environment: Option<String>,
    pub platform: Option<String>,
    #[serde(default = "default_events_page")]
    pub page: u64,
    #[serde(default = "default_events_per_page")]
    pub per_page: u64,
    pub sort_by: Option<String>,
    #[serde(default)]
    pub sort_order: SortOrder,
}

fn default_events_page() -> u64 {
    1
}

fn default_events_per_page() -> u64 {
    50
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct EventRow {
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
    pub platform: String,
}

pub async fn list_events(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<ListEventsQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let from_ts = params.from.timestamp_millis() as f64 / 1000.0;
    let to_ts = params.to.timestamp_millis() as f64 / 1000.0;
    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 200);
    let offset = (page - 1) * per_page;

    let sort_col = match params.sort_by.as_deref() {
        Some(col) => validate_sort_column(col, EVENTS_SORT_COLUMNS)?,
        None => "client_timestamp",
    };
    let sort_dir = params.sort_order.as_sql();

    // Build dynamic WHERE clauses
    let mut conditions = vec![
        "project_id = ?".to_string(),
        "server_timestamp BETWEEN ? AND ?".to_string(),
        "NOT startsWith(event_name, '$')".to_string(),
    ];

    if params.event_type.is_some() {
        conditions.push("event_type = ?".to_string());
    }
    if params.event_name.is_some() {
        conditions.push("positionCaseInsensitive(event_name, ?) > 0".to_string());
    }
    if params.user_id.is_some() {
        conditions.push("positionCaseInsensitive(user_id, ?) > 0".to_string());
    }
    if params.anonymous_id.is_some() {
        conditions.push("anonymous_id = ?".to_string());
    }
    if params.environment.is_some() {
        conditions.push("environment = ?".to_string());
    }
    if params.platform.is_some() {
        conditions.push("platform = ?".to_string());
    }

    let where_clause = conditions.join(" AND ");

    let query_str = format!(
        "SELECT toString(event_id) AS event_id, toString(project_id) AS project_id, \
         event_name, event_type, \
         COALESCE(user_id, '') AS user_id, anonymous_id, \
         formatDateTime(client_timestamp, '%Y-%m-%dT%H:%i:%SZ', 'UTC') AS client_ts, \
         formatDateTime(server_timestamp, '%Y-%m-%dT%H:%i:%SZ', 'UTC') AS server_ts, \
         properties, platform \
         FROM {db}.events WHERE {where_clause} \
         ORDER BY {sort_col} {sort_dir} \
         LIMIT ? OFFSET ?"
    );

    // We fetch per_page + 1 to detect has_more
    let fetch_limit = per_page + 1;

    let mut q = state
        .clickhouse_client
        .query(&query_str)
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts);

    if let Some(ref et) = params.event_type {
        q = q.bind(et.as_str());
    }
    if let Some(ref en) = params.event_name {
        q = q.bind(en.as_str());
    }
    if let Some(ref uid) = params.user_id {
        q = q.bind(uid.as_str());
    }
    if let Some(ref aid) = params.anonymous_id {
        q = q.bind(aid.as_str());
    }
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    if let Some(ref plat) = params.platform {
        q = q.bind(plat.as_str());
    }

    let mut rows = q
        .bind(fetch_limit)
        .bind(offset)
        .fetch_all::<EventRow>()
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

// ── Active Users (DAU/WAU/MAU) ──────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ActiveUsersQuery {
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    #[serde(default = "default_active_granularity")]
    pub granularity: String,
    pub environment: Option<String>,
}

fn default_active_granularity() -> String {
    "day".to_string()
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct ActiveUsersRow {
    pub period: String,
    pub active_users: u64,
}

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct NewUsersRow {
    pub period: String,
    pub new_users: u64,
}

#[derive(Debug, Serialize)]
pub struct ActiveUsersPoint {
    pub period: String,
    pub active_users: u64,
    pub new_users: u64,
}

#[derive(Debug, Serialize)]
pub struct ActiveUsersResponse {
    pub project_id: Uuid,
    pub granularity: String,
    pub data: Vec<ActiveUsersPoint>,
}

pub async fn active_users(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<ActiveUsersQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let from_date = params.from.format("%Y-%m-%d").to_string();
    let to_date = params.to.format("%Y-%m-%d").to_string();

    let period_expr = match params.granularity.as_str() {
        "week" => "toString(toMonday(event_date))".to_string(),
        "month" => "toString(toStartOfMonth(event_date))".to_string(),
        _ => "toString(event_date)".to_string(), // day
    };

    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    // Active users per period
    let active_query = format!(
        "SELECT {period_expr} AS period, uniqExact(user_uid) AS active_users \
         FROM {db}.users_daily \
         WHERE project_id = ? AND event_date BETWEEN ? AND ?{env_filter} \
         GROUP BY period ORDER BY period"
    );

    let mut q = state
        .clickhouse_client
        .query(&active_query)
        .bind(project_id)
        .bind(from_date.as_str())
        .bind(to_date.as_str());
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let active_rows = q
        .fetch_all::<ActiveUsersRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // New users per period (first_seen_date falls within each period)
    let new_period_expr = match params.granularity.as_str() {
        "week" => "toString(toMonday(first_seen_date))".to_string(),
        "month" => "toString(toStartOfMonth(first_seen_date))".to_string(),
        _ => "toString(first_seen_date)".to_string(),
    };

    let new_query = format!(
        "SELECT {new_period_expr} AS period, count() AS new_users \
         FROM {db}.user_first_seen \
         WHERE project_id = ? AND first_seen_date BETWEEN ? AND ?{env_filter} \
         GROUP BY period ORDER BY period"
    );

    let mut q = state
        .clickhouse_client
        .query(&new_query)
        .bind(project_id)
        .bind(from_date.as_str())
        .bind(to_date.as_str());
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let new_rows = q
        .fetch_all::<NewUsersRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // Merge active + new users by period
    let new_map: std::collections::HashMap<String, u64> = new_rows
        .into_iter()
        .map(|r| (r.period, r.new_users))
        .collect();

    let data: Vec<ActiveUsersPoint> = active_rows
        .into_iter()
        .map(|r| {
            let new_users = new_map.get(&r.period).copied().unwrap_or(0);
            ActiveUsersPoint {
                period: r.period,
                active_users: r.active_users,
                new_users,
            }
        })
        .collect();

    Ok(Json(ActiveUsersResponse {
        project_id,
        granularity: params.granularity,
        data,
    }))
}

// ── Live Users ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LiveUsersQuery {
    pub environment: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LiveUsersResponse {
    pub project_id: Uuid,
    pub active_users_5m: u64,
    pub active_users_30m: u64,
}

pub async fn live_users(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<LiveUsersQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let query_5m = format!(
        "SELECT uniqExact(COALESCE(NULLIF(user_id, ''), anonymous_id)) AS active \
         FROM {db}.events \
         WHERE project_id = ? AND server_timestamp >= now() - INTERVAL 5 MINUTE{env_filter}"
    );

    let mut q = state.clickhouse_client.query(&query_5m).bind(project_id);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let active_5m: u64 = q
        .fetch_one::<u64>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    let query_30m = format!(
        "SELECT uniqExact(COALESCE(NULLIF(user_id, ''), anonymous_id)) AS active \
         FROM {db}.events \
         WHERE project_id = ? AND server_timestamp >= now() - INTERVAL 30 MINUTE{env_filter}"
    );

    let mut q = state.clickhouse_client.query(&query_30m).bind(project_id);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let active_30m: u64 = q
        .fetch_one::<u64>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(LiveUsersResponse {
        project_id,
        active_users_5m: active_5m,
        active_users_30m: active_30m,
    }))
}

// ── Platform Distribution ────────────────────────────────────────────

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct PlatformRow {
    pub platform: String,
    pub users: u64,
    pub events: u64,
}

#[derive(Debug, Serialize)]
pub struct PlatformDistributionResponse {
    pub project_id: Uuid,
    pub data: Vec<PlatformRow>,
}

pub async fn platform_distribution(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<TimeRangeQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let query = format!(
        "SELECT platform, \
         uniqExact(COALESCE(NULLIF(user_id, ''), anonymous_id)) AS users, \
         count() AS events \
         FROM {db}.events \
         WHERE project_id = ? AND server_timestamp BETWEEN ? AND ?{env_filter} \
         GROUP BY platform ORDER BY events DESC"
    );

    let mut q = state
        .clickhouse_client
        .query(&query)
        .bind(project_id)
        .bind(params.from.timestamp_millis() as f64 / 1000.0)
        .bind(params.to.timestamp_millis() as f64 / 1000.0);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let rows = q
        .fetch_all::<PlatformRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(PlatformDistributionResponse {
        project_id,
        data: rows,
    }))
}
