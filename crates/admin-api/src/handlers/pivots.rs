use std::collections::HashMap;

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
    PropertyFilter, build_property_filter_clauses, column_expr, identity_join, metric_expr,
    validate_identifier,
};

// ── Request / Response ──────────────────────────────────────────────

fn default_metric() -> String {
    "total".to_string()
}

fn default_limit() -> usize {
    25
}

#[derive(Debug, Deserialize)]
pub struct PivotsRequest {
    pub event_name: Option<String>,
    pub row_dimension: String,
    pub column_dimension: String,
    #[serde(default = "default_metric")]
    pub metric: String,
    #[serde(default)]
    pub filters: Vec<PropertyFilter>,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub environment: Option<String>,
    #[serde(default = "default_limit")]
    pub row_limit: usize,
    #[serde(default = "default_limit")]
    pub column_limit: usize,
}

#[derive(Debug, Serialize)]
pub struct PivotsResponse {
    pub rows: Vec<String>,
    pub columns: Vec<String>,
    pub cells: Vec<Vec<f64>>,
    pub row_totals: Vec<f64>,
    pub column_totals: Vec<f64>,
    pub grand_total: f64,
}

// ── ClickHouse row ──────────────────────────────────────────────────

#[derive(Debug, clickhouse::Row, Deserialize)]
struct PivotRow {
    row_val: String,
    col_val: String,
    value: f64,
}

// ── Handler ─────────────────────────────────────────────────────────

pub async fn pivots(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<PivotsRequest>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    let db = &state.config.clickhouse_database;
    let from_ts = req.from.timestamp_millis() as f64 / 1000.0;
    let to_ts = req.to.timestamp_millis() as f64 / 1000.0;

    // Validate dimensions
    validate_identifier(&req.row_dimension)?;
    validate_identifier(&req.column_dimension)?;
    for f in &req.filters {
        validate_identifier(&f.property)?;
    }

    let row_expr = column_expr(&req.row_dimension);
    let col_expr = column_expr(&req.column_dimension);
    let metric = metric_expr(&req.metric)?;

    // Build WHERE conditions
    let ij = identity_join(db);
    let mut conditions = Vec::new();
    conditions.push("e.project_id = ?".to_string());
    conditions.push("server_timestamp BETWEEN ? AND ?".to_string());

    if req.event_name.is_some() {
        conditions.push("event_name = ?".to_string());
    }
    if req.environment.is_some() {
        conditions.push("environment = ?".to_string());
    }

    let (filter_conditions, filter_bind_values) = build_property_filter_clauses(&req.filters)?;
    conditions.extend(filter_conditions);

    let where_clause = conditions.join(" AND ");

    let query = format!(
        "SELECT {row_expr} AS row_val, {col_expr} AS col_val, {metric} AS value \
         FROM {db}.events AS e{ij} \
         WHERE {where_clause} \
         GROUP BY row_val, col_val \
         ORDER BY row_val, col_val"
    );

    let mut q = state
        .clickhouse_client
        .query(&query)
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

    let raw_rows = q
        .fetch_all::<PivotRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // Post-process into matrix
    let mut row_totals_map: HashMap<String, f64> = HashMap::new();
    let mut col_totals_map: HashMap<String, f64> = HashMap::new();
    let mut cell_map: HashMap<(String, String), f64> = HashMap::new();
    let mut row_order: Vec<String> = Vec::new();
    let mut col_order: Vec<String> = Vec::new();

    for r in &raw_rows {
        if !row_totals_map.contains_key(&r.row_val) {
            row_order.push(r.row_val.clone());
        }
        if !col_totals_map.contains_key(&r.col_val) {
            col_order.push(r.col_val.clone());
        }
        *row_totals_map.entry(r.row_val.clone()).or_default() += r.value;
        *col_totals_map.entry(r.col_val.clone()).or_default() += r.value;
        *cell_map
            .entry((r.row_val.clone(), r.col_val.clone()))
            .or_default() += r.value;
    }

    // Sort rows by total descending, apply limits
    row_order.sort_by(|a, b| {
        let ta = row_totals_map.get(b).unwrap_or(&0.0);
        let tb = row_totals_map.get(a).unwrap_or(&0.0);
        ta.partial_cmp(tb).unwrap_or(std::cmp::Ordering::Equal)
    });
    row_order.truncate(req.row_limit);

    col_order.sort_by(|a, b| {
        let ta = col_totals_map.get(b).unwrap_or(&0.0);
        let tb = col_totals_map.get(a).unwrap_or(&0.0);
        ta.partial_cmp(tb).unwrap_or(std::cmp::Ordering::Equal)
    });
    col_order.truncate(req.column_limit);

    // Build final matrix
    let mut cells = Vec::with_capacity(row_order.len());
    let mut row_totals = Vec::with_capacity(row_order.len());
    let mut column_totals = vec![0.0_f64; col_order.len()];
    let mut grand_total = 0.0_f64;

    for row_key in &row_order {
        let mut row_cells = Vec::with_capacity(col_order.len());
        let mut row_sum = 0.0_f64;
        for (ci, col_key) in col_order.iter().enumerate() {
            let val = cell_map
                .get(&(row_key.clone(), col_key.clone()))
                .copied()
                .unwrap_or(0.0);
            row_cells.push(val);
            row_sum += val;
            column_totals[ci] += val;
        }
        grand_total += row_sum;
        row_totals.push(row_sum);
        cells.push(row_cells);
    }

    Ok(Json(PivotsResponse {
        rows: row_order,
        columns: col_order,
        cells,
        row_totals,
        column_totals,
        grand_total,
    }))
}
