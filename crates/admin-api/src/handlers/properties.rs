use std::collections::HashMap;

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

use super::query_builder::{
    PropertyFilter, build_property_filter_clauses, column_expr, validate_identifier,
};

// ── Constants ────────────────────────────────────────────────────────

const MAX_GROUP_BY: usize = 3;

// ── Property Keys ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PropertyKeysQuery {
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub environment: Option<String>,
}

#[derive(Debug, clickhouse::Row, Deserialize)]
struct PropertyKeyRow {
    key: String,
}

#[derive(Debug, Serialize)]
pub struct PropertyKeysResponse {
    pub keys: Vec<String>,
}

pub async fn property_keys(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<PropertyKeysQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let query = format!(
        "SELECT DISTINCT arrayJoin(mapKeys(properties_map)) AS key \
         FROM {db}.events \
         WHERE project_id = ? AND server_timestamp BETWEEN ? AND ?{env_filter} \
         ORDER BY key LIMIT 500"
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
        .fetch_all::<PropertyKeyRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    let keys: Vec<String> = rows.into_iter().map(|r| r.key).collect();

    Ok(Json(PropertyKeysResponse { keys }))
}

// ── Property Values ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PropertyValuesQuery {
    pub key: String,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub environment: Option<String>,
}

#[derive(Debug, clickhouse::Row, Deserialize)]
struct PropertyValueRow {
    value: String,
}

#[derive(Debug, Serialize)]
pub struct PropertyValuesResponse {
    pub key: String,
    pub values: Vec<String>,
}

pub async fn property_values(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<PropertyValuesQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let db = &state.config.clickhouse_database;
    let env_filter = if params.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let query = format!(
        "SELECT DISTINCT properties_map[?] AS value \
         FROM {db}.events \
         WHERE project_id = ? AND server_timestamp BETWEEN ? AND ? \
         AND mapContains(properties_map, ?){env_filter} \
         ORDER BY value LIMIT 500"
    );

    let mut q = state
        .clickhouse_client
        .query(&query)
        .bind(params.key.as_str())
        .bind(project_id)
        .bind(params.from.timestamp_millis() as f64 / 1000.0)
        .bind(params.to.timestamp_millis() as f64 / 1000.0)
        .bind(params.key.as_str());
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    let rows = q
        .fetch_all::<PropertyValueRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    let values: Vec<String> = rows.into_iter().map(|r| r.value).collect();

    Ok(Json(PropertyValuesResponse {
        key: params.key,
        values,
    }))
}

// ── Insights ─────────────────────────────────────────────────────────

fn default_metric() -> String {
    "total".to_string()
}

fn default_insights_granularity() -> String {
    "day".to_string()
}

#[derive(Debug, Deserialize)]
pub struct InsightsRequest {
    pub event_name: Option<String>,
    #[serde(default = "default_metric")]
    pub metric: String,
    #[serde(default)]
    pub group_by: Vec<String>,
    #[serde(default)]
    pub filters: Vec<PropertyFilter>,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    #[serde(default = "default_insights_granularity")]
    pub granularity: String,
    pub environment: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InsightsResponse {
    pub series: Vec<InsightsSeries>,
    pub totals: Vec<InsightsTotal>,
}

#[derive(Debug, Serialize)]
pub struct InsightsSeries {
    pub group: serde_json::Value,
    pub data: Vec<InsightsDataPoint>,
}

#[derive(Debug, Serialize)]
pub struct InsightsDataPoint {
    pub period: String,
    pub value: f64,
}

#[derive(Debug, Serialize)]
pub struct InsightsTotal {
    pub group: serde_json::Value,
    pub value: f64,
}

#[derive(Debug, clickhouse::Row, Deserialize)]
struct InsightsRawRow {
    period: String,
    value: f64,
    #[serde(default)]
    g0: String,
    #[serde(default)]
    g1: String,
    #[serde(default)]
    g2: String,
}

#[derive(Debug, clickhouse::Row, Deserialize)]
struct TotalsRawRow {
    value: f64,
    #[serde(default)]
    g0: String,
    #[serde(default)]
    g1: String,
    #[serde(default)]
    g2: String,
}

// ── Helpers ──────────────────────────────────────────────────────────

fn metric_expr(metric: &str) -> Result<&'static str, AppError> {
    match metric {
        "total" => Ok("toFloat64(count())"),
        "unique_users" => Ok("toFloat64(uniqExact(COALESCE(NULLIF(user_id, ''), anonymous_id)))"),
        "avg_per_user" => {
            Ok("toFloat64(count()) / max(1, uniqExact(COALESCE(NULLIF(user_id, ''), anonymous_id)))")
        }
        other => Err(AppError::Validation(format!("Unknown metric: {}", other))),
    }
}

fn period_expr(granularity: &str) -> Result<&'static str, AppError> {
    match granularity {
        "day" => Ok("formatDateTime(toDate(server_timestamp), '%Y-%m-%d')"),
        "week" => Ok("formatDateTime(toMonday(server_timestamp), '%Y-%m-%d')"),
        "month" => Ok("formatDateTime(toStartOfMonth(server_timestamp), '%Y-%m-%d')"),
        other => Err(AppError::Validation(format!(
            "Unknown granularity: {}",
            other
        ))),
    }
}

fn build_group_key(group_by: &[String], g0: &str, g1: &str, g2: &str) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for (i, key) in group_by.iter().enumerate() {
        let val = match i {
            0 => g0,
            1 => g1,
            2 => g2,
            _ => "",
        };
        map.insert(key.clone(), serde_json::Value::String(val.to_string()));
    }
    serde_json::Value::Object(map)
}

pub async fn insights(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<InsightsRequest>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    let db = &state.config.clickhouse_database;
    let from_ts = req.from.timestamp_millis() as f64 / 1000.0;
    let to_ts = req.to.timestamp_millis() as f64 / 1000.0;

    // Validate group_by
    if req.group_by.len() > MAX_GROUP_BY {
        return Err(AppError::Validation(format!(
            "group_by supports at most {} fields",
            MAX_GROUP_BY
        )));
    }
    for key in &req.group_by {
        validate_identifier(key)?;
    }

    // Validate filter property names
    for f in &req.filters {
        validate_identifier(&f.property)?;
    }

    let metric = metric_expr(&req.metric)?;
    let period = period_expr(&req.granularity)?;

    // Build group-by SELECT and GROUP BY fragments
    let mut group_select_parts = Vec::new();
    let mut group_by_aliases = Vec::new();
    for i in 0..MAX_GROUP_BY {
        if i < req.group_by.len() {
            let expr = column_expr(&req.group_by[i]);
            group_select_parts.push(format!("{} AS g{}", expr, i));
            group_by_aliases.push(format!("g{}", i));
        } else {
            group_select_parts.push(format!("'' AS g{}", i));
        }
    }
    let group_select = group_select_parts.join(", ");

    let group_by_clause = if !group_by_aliases.is_empty() {
        format!(", {}", group_by_aliases.join(", "))
    } else {
        String::new()
    };

    // Build WHERE conditions
    let mut conditions = Vec::new();
    conditions.push("project_id = ?".to_string());
    conditions.push("server_timestamp BETWEEN ? AND ?".to_string());

    if req.event_name.is_some() {
        conditions.push("event_name = ?".to_string());
    }
    if req.environment.is_some() {
        conditions.push("environment = ?".to_string());
    }

    // Build filter conditions using shared helper
    let (filter_conditions, filter_bind_values) =
        build_property_filter_clauses(&req.filters)?;
    conditions.extend(filter_conditions);

    let where_clause = conditions.join(" AND ");

    // ── Series query ─────────────────────────────────────────────────

    let series_query = format!(
        "SELECT {period} AS period, {group_select}, {metric} AS value \
         FROM {db}.events \
         WHERE {where_clause} \
         GROUP BY period{group_by_clause} \
         ORDER BY period"
    );

    let mut q = state
        .clickhouse_client
        .query(&series_query)
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts);
    if let Some(ref en) = req.event_name {
        q = q.bind(en.as_str());
    }
    if let Some(ref env) = req.environment {
        q = q.bind(env.as_str());
    }
    for val in &filter_bind_values {
        q = q.bind(val.as_str());
    }
    let series_rows = q
        .fetch_all::<InsightsRawRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // ── Totals query ─────────────────────────────────────────────────

    let totals_group_by = if !group_by_aliases.is_empty() {
        format!("GROUP BY {} ", group_by_aliases.join(", "))
    } else {
        String::new()
    };

    let totals_query = format!(
        "SELECT {group_select}, {metric} AS value \
         FROM {db}.events \
         WHERE {where_clause} \
         {totals_group_by}\
         ORDER BY value DESC \
         LIMIT 100"
    );

    let mut q = state
        .clickhouse_client
        .query(&totals_query)
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts);
    if let Some(ref en) = req.event_name {
        q = q.bind(en.as_str());
    }
    if let Some(ref env) = req.environment {
        q = q.bind(env.as_str());
    }
    for val in &filter_bind_values {
        q = q.bind(val.as_str());
    }
    let totals_rows = q
        .fetch_all::<TotalsRawRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // ── Post-processing ──────────────────────────────────────────────

    // Group series rows by their group key
    let mut series_map: HashMap<String, Vec<InsightsDataPoint>> = HashMap::new();
    let mut series_order: Vec<String> = Vec::new();

    for row in &series_rows {
        let group_key = build_group_key(&req.group_by, &row.g0, &row.g1, &row.g2).to_string();
        if !series_map.contains_key(&group_key) {
            series_order.push(group_key.clone());
        }
        series_map
            .entry(group_key)
            .or_default()
            .push(InsightsDataPoint {
                period: row.period.clone(),
                value: row.value,
            });
    }

    let series: Vec<InsightsSeries> = series_order
        .into_iter()
        .map(|key| {
            let data = series_map.remove(&key).unwrap_or_default();
            let group: serde_json::Value =
                serde_json::from_str(&key).unwrap_or(serde_json::Value::Object(Default::default()));
            InsightsSeries { group, data }
        })
        .collect();

    let totals: Vec<InsightsTotal> = totals_rows
        .into_iter()
        .map(|row| InsightsTotal {
            group: build_group_key(&req.group_by, &row.g0, &row.g1, &row.g2),
            value: row.value,
        })
        .collect();

    Ok(Json(InsightsResponse { series, totals }))
}
