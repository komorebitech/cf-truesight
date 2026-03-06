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
    GroupedSeriesRow, GroupedTotalsRow, PropertyFilter, build_group_key,
    build_property_filter_clauses, column_expr, group_series_rows, metric_expr, period_expr,
    validate_identifier,
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
    #[allow(dead_code)]
    pub segment_id: Option<Uuid>,
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

// ── Helpers ──────────────────────────────────────────────────────────

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
    let (filter_conditions, filter_bind_values) = build_property_filter_clauses(&req.filters)?;
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
        .fetch_all::<GroupedSeriesRow>()
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
        .fetch_all::<GroupedTotalsRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // ── Post-processing ──────────────────────────────────────────────

    let grouped = group_series_rows(&series_rows, &req.group_by);
    let series: Vec<InsightsSeries> = grouped
        .into_iter()
        .map(|(group, data)| InsightsSeries {
            group,
            data: data
                .into_iter()
                .map(|dp| InsightsDataPoint {
                    period: dp.period,
                    value: dp.value,
                })
                .collect(),
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
