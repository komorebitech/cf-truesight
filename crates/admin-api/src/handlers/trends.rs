use axum::{
    Json,
    extract::{Path, State},
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
const MAX_EVENT_QUERIES: usize = 10;

// ── Request types ───────────────────────────────────────────────────

fn default_metric() -> String {
    "total".to_string()
}

fn default_granularity() -> String {
    "day".to_string()
}

#[derive(Debug, Deserialize)]
pub struct EventQuery {
    pub event_name: String,
    #[serde(default = "default_metric")]
    pub metric: String,
    #[serde(default)]
    pub filters: Vec<PropertyFilter>,
}

#[derive(Debug, Deserialize)]
pub struct TrendsRequest {
    pub events: Vec<EventQuery>,
    #[serde(default = "default_granularity")]
    pub granularity: String,
    #[serde(default)]
    pub group_by: Vec<String>,
    #[serde(default)]
    pub filters: Vec<PropertyFilter>,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub environment: Option<String>,
}

// ── Response types ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TrendsResponse {
    pub series: Vec<TrendSeries>,
    pub totals: Vec<TrendTotal>,
}

#[derive(Debug, Serialize)]
pub struct TrendSeries {
    pub event_name: String,
    pub group: serde_json::Value,
    pub data: Vec<TrendDataPoint>,
}

#[derive(Debug, Serialize)]
pub struct TrendDataPoint {
    pub period: String,
    pub value: f64,
}

#[derive(Debug, Serialize)]
pub struct TrendTotal {
    pub event_name: String,
    pub group: serde_json::Value,
    pub value: f64,
}

// ── Handler ─────────────────────────────────────────────────────────

pub async fn trends(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<TrendsRequest>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    if req.events.is_empty() {
        return Err(AppError::Validation(
            "At least one event query is required".to_string(),
        ));
    }
    if req.events.len() > MAX_EVENT_QUERIES {
        return Err(AppError::Validation(format!(
            "At most {} event queries are allowed",
            MAX_EVENT_QUERIES
        )));
    }
    if req.group_by.len() > MAX_GROUP_BY {
        return Err(AppError::Validation(format!(
            "group_by supports at most {} fields",
            MAX_GROUP_BY
        )));
    }
    for key in &req.group_by {
        validate_identifier(key)?;
    }
    for f in &req.filters {
        validate_identifier(&f.property)?;
    }

    let period = period_expr(&req.granularity)?;
    let db = &state.config.clickhouse_database;
    let from_ts = req.from.timestamp_millis() as f64 / 1000.0;
    let to_ts = req.to.timestamp_millis() as f64 / 1000.0;

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

    // Build global filter conditions
    let (global_filter_conditions, global_filter_values) =
        build_property_filter_clauses(&req.filters)?;

    // Execute per-event queries concurrently
    let mut futures = Vec::new();
    for eq in &req.events {
        let state_clone = state.clone();
        let db_clone = db.clone();
        let group_select_clone = group_select.clone();
        let group_by_clause_clone = group_by_clause.clone();
        let group_by_aliases_clone = group_by_aliases.clone();
        let global_filter_conditions_clone = global_filter_conditions.clone();
        let global_filter_values_clone = global_filter_values.clone();
        let environment_clone = req.environment.clone();
        let group_by_clone = req.group_by.clone();
        let event_name = eq.event_name.clone();
        let metric_str = eq.metric.clone();
        let per_event_filters = eq.filters.clone();

        futures.push(tokio::spawn(async move {
            query_single_event(
                &state_clone,
                project_id,
                from_ts,
                to_ts,
                &db_clone,
                period,
                &group_select_clone,
                &group_by_clause_clone,
                &group_by_aliases_clone,
                &global_filter_conditions_clone,
                &global_filter_values_clone,
                environment_clone.as_deref(),
                &group_by_clone,
                &event_name,
                &metric_str,
                &per_event_filters,
            )
            .await
        }));
    }

    let results = futures::future::join_all(futures).await;

    let mut all_series = Vec::new();
    let mut all_totals = Vec::new();

    for result in results {
        let (series, totals) = result
            .map_err(|e| AppError::Database(format!("Task join error: {}", e)))?
            .map_err(|e: AppError| e)?;
        all_series.extend(series);
        all_totals.extend(totals);
    }

    Ok(Json(TrendsResponse {
        series: all_series,
        totals: all_totals,
    }))
}

#[allow(clippy::too_many_arguments)]
async fn query_single_event(
    state: &AppState,
    project_id: Uuid,
    from_ts: f64,
    to_ts: f64,
    db: &str,
    period: &str,
    group_select: &str,
    group_by_clause: &str,
    group_by_aliases: &[String],
    global_filter_conditions: &[String],
    global_filter_values: &[String],
    environment: Option<&str>,
    group_by: &[String],
    event_name: &str,
    metric_str: &str,
    per_event_filters: &[PropertyFilter],
) -> Result<(Vec<TrendSeries>, Vec<TrendTotal>), AppError> {
    let metric = metric_expr(metric_str)?;

    // Validate per-event filter identifiers
    for f in per_event_filters {
        validate_identifier(&f.property)?;
    }

    let (per_event_conditions, per_event_values) =
        build_property_filter_clauses(per_event_filters)?;

    // Build WHERE conditions
    let mut conditions = Vec::new();
    conditions.push("project_id = ?".to_string());
    conditions.push("server_timestamp BETWEEN ? AND ?".to_string());
    conditions.push("event_name = ?".to_string());

    if environment.is_some() {
        conditions.push("environment = ?".to_string());
    }

    conditions.extend(global_filter_conditions.iter().cloned());
    conditions.extend(per_event_conditions);

    let where_clause = conditions.join(" AND ");

    // ── Series query ────────────────────────────────────────────────
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
        .bind(to_ts)
        .bind(event_name);
    if let Some(env) = environment {
        q = q.bind(env);
    }
    for val in global_filter_values {
        q = q.bind(val.as_str());
    }
    for val in &per_event_values {
        q = q.bind(val.as_str());
    }

    let series_rows = q
        .fetch_all::<GroupedSeriesRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // ── Totals query ────────────────────────────────────────────────
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
        .bind(to_ts)
        .bind(event_name);
    if let Some(env) = environment {
        q = q.bind(env);
    }
    for val in global_filter_values {
        q = q.bind(val.as_str());
    }
    for val in &per_event_values {
        q = q.bind(val.as_str());
    }

    let totals_rows = q
        .fetch_all::<GroupedTotalsRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // ── Post-processing ─────────────────────────────────────────────
    let grouped = group_series_rows(&series_rows, group_by);
    let series: Vec<TrendSeries> = grouped
        .into_iter()
        .map(|(group, data)| TrendSeries {
            event_name: event_name.to_string(),
            group,
            data: data
                .into_iter()
                .map(|dp| TrendDataPoint {
                    period: dp.period,
                    value: dp.value,
                })
                .collect(),
        })
        .collect();

    let totals: Vec<TrendTotal> = totals_rows
        .into_iter()
        .map(|row| TrendTotal {
            event_name: event_name.to_string(),
            group: build_group_key(group_by, &row.g0, &row.g1, &row.g2),
            value: row.value,
        })
        .collect();

    Ok((series, totals))
}
