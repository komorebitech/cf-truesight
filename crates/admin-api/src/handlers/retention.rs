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
    PropertyFilter, USER_UID_EXPR, build_property_filter_clauses, validate_identifier,
};

// ── Defaults ────────────────────────────────────────────────────────

fn default_retention_type() -> String {
    "day".to_string()
}

fn default_num_periods() -> u32 {
    8
}

// ── Request / Response Types ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RetentionRequest {
    pub start_event: String,
    pub return_event: Option<String>,
    #[serde(default = "default_retention_type")]
    pub retention_type: String,
    #[serde(default = "default_num_periods")]
    pub num_periods: u32,
    #[serde(default)]
    pub filters: Vec<PropertyFilter>,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub environment: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RetentionResponse {
    pub cohorts: Vec<RetentionCohort>,
}

#[derive(Debug, Serialize)]
pub struct RetentionCohort {
    pub cohort_date: String,
    pub cohort_size: u64,
    pub retention: Vec<f64>,
}

#[derive(Debug, clickhouse::Row, Deserialize)]
struct RetentionRawRow {
    cohort_date: String,
    cohort_size: u64,
    period_offset: i32,
    retained_users: u64,
}

// ── Helpers ─────────────────────────────────────────────────────────

fn period_fn(retention_type: &str) -> Result<&'static str, AppError> {
    match retention_type {
        "day" => Ok("toDate(server_timestamp)"),
        "week" => Ok("toMonday(server_timestamp)"),
        "month" => Ok("toStartOfMonth(server_timestamp)"),
        other => Err(AppError::Validation(format!(
            "Unknown retention_type: {}",
            other
        ))),
    }
}

fn date_diff_unit(retention_type: &str) -> Result<&'static str, AppError> {
    match retention_type {
        "day" => Ok("day"),
        "week" => Ok("week"),
        "month" => Ok("month"),
        other => Err(AppError::Validation(format!(
            "Unknown retention_type: {}",
            other
        ))),
    }
}

// ── Handler ─────────────────────────────────────────────────────────

pub async fn retention(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<RetentionRequest>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    // Validate inputs
    validate_identifier(&req.start_event)?;
    if let Some(ref re) = req.return_event {
        validate_identifier(re)?;
    }
    for f in &req.filters {
        validate_identifier(&f.property)?;
    }

    let num_periods = req.num_periods.min(12);
    let pfn = period_fn(&req.retention_type)?;
    let diff_unit = date_diff_unit(&req.retention_type)?;
    let db = &state.config.clickhouse_database;
    let from_ts = req.from.timestamp_millis() as f64 / 1000.0;
    let to_ts = req.to.timestamp_millis() as f64 / 1000.0;

    // Build filter conditions for the cohort (start_event) subquery
    let (cohort_filter_clauses, cohort_filter_bind_values) =
        build_property_filter_clauses(&req.filters)?;

    let cohort_filter_sql = if cohort_filter_clauses.is_empty() {
        String::new()
    } else {
        format!(" AND {}", cohort_filter_clauses.join(" AND "))
    };

    let cohort_env_filter = if req.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let activity_env_filter = if req.environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let return_event_filter = if req.return_event.is_some() {
        " AND event_name = ?"
    } else {
        ""
    };

    let user_uid = USER_UID_EXPR;
    let query = format!(
        "WITH \
          cohort_users AS ( \
            SELECT user_uid, {pfn_alias} AS cohort_period \
            FROM ( \
              SELECT {user_uid} AS user_uid, server_timestamp \
              FROM {db}.events \
              WHERE project_id = ? AND server_timestamp BETWEEN ? AND ? \
                AND event_name = ?{cohort_env_filter}{cohort_filter_sql} \
            ) \
            GROUP BY user_uid, cohort_period \
            HAVING cohort_period = min(cohort_period) \
          ), \
          user_activity AS ( \
            SELECT \
              {user_uid} AS user_uid, \
              {pfn_alias} AS activity_period \
            FROM {db}.events \
            WHERE project_id = ? AND server_timestamp BETWEEN ? AND ?{return_event_filter}{activity_env_filter} \
            GROUP BY user_uid, activity_period \
          ) \
        SELECT \
          toString(c.cohort_period) AS cohort_date, \
          count(DISTINCT c.user_uid) AS cohort_size, \
          dateDiff('{diff_unit}', c.cohort_period, a.activity_period) AS period_offset, \
          count(DISTINCT a.user_uid) AS retained_users \
        FROM cohort_users c \
        LEFT JOIN user_activity a ON c.user_uid = a.user_uid \
        WHERE dateDiff('{diff_unit}', c.cohort_period, a.activity_period) BETWEEN 0 AND ? \
        GROUP BY cohort_date, period_offset \
        ORDER BY cohort_date, period_offset",
        pfn_alias = pfn,
    );

    // Bind parameters in order
    let mut q = state
        .clickhouse_client
        .query(&query)
        // cohort_users subquery
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts)
        .bind(req.start_event.as_str());
    if let Some(ref env) = req.environment {
        q = q.bind(env.as_str());
    }
    for val in &cohort_filter_bind_values {
        q = q.bind(val.as_str());
    }
    // user_activity subquery
    q = q.bind(project_id).bind(from_ts).bind(to_ts);
    if let Some(ref re) = req.return_event {
        q = q.bind(re.as_str());
    }
    if let Some(ref env) = req.environment {
        q = q.bind(env.as_str());
    }
    // WHERE clause on period_offset
    q = q.bind(num_periods as i32);

    let rows = q
        .fetch_all::<RetentionRawRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // Post-process: group by cohort_date, build retention percentages
    let mut cohort_map: HashMap<String, (u64, HashMap<i32, u64>)> = HashMap::new();
    let mut cohort_order: Vec<String> = Vec::new();

    for row in &rows {
        let entry = cohort_map
            .entry(row.cohort_date.clone())
            .or_insert_with(|| {
                cohort_order.push(row.cohort_date.clone());
                (0, HashMap::new())
            });
        // cohort_size is the same for all offsets of the same cohort_date;
        // use the value from offset 0 if available, otherwise take the max
        if row.period_offset == 0 || entry.0 == 0 {
            entry.0 = row.cohort_size;
        }
        entry.1.insert(row.period_offset, row.retained_users);
    }

    let cohorts: Vec<RetentionCohort> = cohort_order
        .into_iter()
        .map(|date| {
            let (cohort_size, offsets) = cohort_map.remove(&date).unwrap();
            let retention: Vec<f64> = (0..=num_periods as i32)
                .map(|offset| {
                    if cohort_size == 0 {
                        0.0
                    } else {
                        let retained = offsets.get(&offset).copied().unwrap_or(0);
                        let pct = retained as f64 / cohort_size as f64 * 100.0;
                        (pct * 100.0).round() / 100.0
                    }
                })
                .collect();
            RetentionCohort {
                cohort_date: date,
                cohort_size,
                retention,
            }
        })
        .collect();

    Ok(Json(RetentionResponse { cohorts }))
}
