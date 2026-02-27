use axum::{
    Json,
    extract::{Path, Query, State},
    response::IntoResponse,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::error::AppError;

use crate::state::AppState;

// ── Event Count ──────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TimeRangeQuery {
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
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
    Path(project_id): Path<Uuid>,
    Query(params): Query<TimeRangeQuery>,
) -> Result<impl IntoResponse, AppError> {
    let query = format!(
        "SELECT count() AS cnt FROM {}.events WHERE project_id = ? AND server_timestamp BETWEEN ? AND ?",
        state.config.clickhouse_database
    );

    let count: u64 = state
        .clickhouse_client
        .query(&query)
        .bind(project_id)
        .bind(params.from.timestamp_millis() as f64 / 1000.0)
        .bind(params.to.timestamp_millis() as f64 / 1000.0)
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
    Path(project_id): Path<Uuid>,
    Query(params): Query<ThroughputQuery>,
) -> Result<impl IntoResponse, AppError> {
    let trunc_fn = match params.granularity.as_str() {
        "minute" => "toStartOfMinute",
        _ => "toStartOfHour",
    };

    let query = format!(
        "SELECT toUnixTimestamp({}(server_timestamp)) AS timestamp, count() AS count \
         FROM {}.events \
         WHERE project_id = ? AND server_timestamp BETWEEN ? AND ? \
         GROUP BY timestamp \
         ORDER BY timestamp",
        trunc_fn, state.config.clickhouse_database
    );

    let rows = state
        .clickhouse_client
        .query(&query)
        .bind(project_id)
        .bind(params.from.timestamp_millis() as f64 / 1000.0)
        .bind(params.to.timestamp_millis() as f64 / 1000.0)
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
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    #[serde(default = "default_limit")]
    pub limit: u64,
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
    Path(project_id): Path<Uuid>,
    Query(params): Query<EventTypesQuery>,
) -> Result<impl IntoResponse, AppError> {
    let db = &state.config.clickhouse_database;
    let from_ts = params.from.timestamp_millis() as f64 / 1000.0;
    let to_ts = params.to.timestamp_millis() as f64 / 1000.0;

    // By type
    let by_type_query = format!(
        "SELECT event_type, count() AS count FROM {}.events \
         WHERE project_id = ? AND server_timestamp BETWEEN ? AND ? \
         GROUP BY event_type",
        db
    );

    let type_rows = state
        .clickhouse_client
        .query(&by_type_query)
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts)
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
         WHERE project_id = ? AND server_timestamp BETWEEN ? AND ? \
         GROUP BY name ORDER BY count DESC LIMIT ?",
        db
    );

    let top_rows = state
        .clickhouse_client
        .query(&top_query)
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts)
        .bind(params.limit)
        .fetch_all::<TopEvent>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(EventTypesResponse {
        by_type: serde_json::Value::Object(by_type_map),
        top_events: top_rows,
    }))
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
    #[serde(default = "default_events_page")]
    pub page: u64,
    #[serde(default = "default_events_per_page")]
    pub per_page: u64,
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
    pub client_timestamp: f64,
    pub server_timestamp: f64,
    pub properties: String,
}

#[derive(Debug, Serialize)]
pub struct ListEventsMetadata {
    pub page: u64,
    pub per_page: u64,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct ListEventsResponse {
    pub data: Vec<EventRow>,
    pub meta: ListEventsMetadata,
}

pub async fn list_events(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(params): Query<ListEventsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let db = &state.config.clickhouse_database;
    let from_ts = params.from.timestamp_millis() as f64 / 1000.0;
    let to_ts = params.to.timestamp_millis() as f64 / 1000.0;
    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 200);
    let offset = (page - 1) * per_page;

    // Build dynamic WHERE clauses
    let mut conditions = vec![
        "project_id = ?".to_string(),
        "server_timestamp BETWEEN ? AND ?".to_string(),
    ];

    if params.event_type.is_some() {
        conditions.push("event_type = ?".to_string());
    }
    if params.event_name.is_some() {
        conditions.push("event_name = ?".to_string());
    }
    if params.user_id.is_some() {
        conditions.push("user_id = ?".to_string());
    }
    if params.anonymous_id.is_some() {
        conditions.push("anonymous_id = ?".to_string());
    }

    let where_clause = conditions.join(" AND ");

    let query_str = format!(
        "SELECT toString(event_id) AS event_id, toString(project_id) AS project_id, \
         event_name, event_type, \
         COALESCE(user_id, '') AS user_id, anonymous_id, \
         toUnixTimestamp64Milli(client_timestamp) / 1000.0 AS client_timestamp, \
         toUnixTimestamp64Milli(server_timestamp) / 1000.0 AS server_timestamp, \
         properties \
         FROM {}.events WHERE {} \
         ORDER BY server_timestamp DESC \
         LIMIT ? OFFSET ?",
        db, where_clause
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

    Ok(Json(ListEventsResponse {
        data: rows,
        meta: ListEventsMetadata {
            page,
            per_page,
            has_more,
        },
    }))
}
