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

use crate::db::funnels as db;
use crate::db::segments as segments_db;
use crate::handlers::query_builder::{self, build_property_filter_clauses, identity_join, USER_UID_EXPR};
use crate::handlers::rbac;
use crate::handlers::segments::SegmentFilter;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

// ── Types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct FunnelResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub steps: serde_json::Value,
    pub window_seconds: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<db::Funnel> for FunnelResponse {
    fn from(f: db::Funnel) -> Self {
        Self {
            id: f.id,
            project_id: f.project_id,
            name: f.name,
            steps: f.steps,
            window_seconds: f.window_seconds,
            created_at: f.created_at,
            updated_at: f.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateFunnelInput {
    pub name: String,
    pub steps: serde_json::Value,
    #[serde(default = "default_window")]
    pub window_seconds: i32,
}

fn default_window() -> i32 {
    86400
}

#[derive(Debug, Deserialize)]
pub struct UpdateFunnelInput {
    pub name: Option<String>,
    pub steps: Option<serde_json::Value>,
    pub window_seconds: Option<i32>,
}

// ── CRUD Handlers ───────────────────────────────────────────────────

pub async fn list_funnels(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let funnels = db::list_funnels(&state.db_pool, project_id)?;
    let response: Vec<FunnelResponse> = funnels.into_iter().map(FunnelResponse::from).collect();
    Ok(Json(response))
}

pub async fn get_funnel(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, funnel_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let funnel = db::find_funnel(&state.db_pool, project_id, funnel_id)?;
    Ok(Json(FunnelResponse::from(funnel)))
}

pub async fn create_funnel(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(input): Json<CreateFunnelInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    let funnel = db::insert_funnel(
        &state.db_pool,
        db::NewFunnel {
            project_id,
            name: input.name,
            steps: input.steps,
            window_seconds: input.window_seconds,
        },
    )?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(FunnelResponse::from(funnel)),
    ))
}

pub async fn update_funnel(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, funnel_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<UpdateFunnelInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    let funnel = db::update_funnel(
        &state.db_pool,
        project_id,
        funnel_id,
        db::UpdateFunnel {
            name: input.name,
            steps: input.steps,
            window_seconds: input.window_seconds,
            updated_at: Utc::now(),
        },
    )?;
    Ok(Json(FunnelResponse::from(funnel)))
}

pub async fn delete_funnel(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, funnel_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    db::delete_funnel(&state.db_pool, project_id, funnel_id)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

// ── Funnel Results ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct FunnelResultsQuery {
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub environment: Option<String>,
    pub segment_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct FunnelStepResult {
    pub step: usize,
    pub event_name: String,
    pub users: u64,
    pub conversion_rate: f64,
}

#[derive(Debug, Serialize)]
pub struct FunnelResultsResponse {
    pub funnel_id: Uuid,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub steps: Vec<FunnelStepResult>,
    pub overall_conversion: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FunnelStep {
    pub event_name: String,
    /// Accepts both `property_filters` (used by dashboard) and `filters` (legacy).
    #[serde(default, alias = "filters")]
    pub property_filters: Vec<FunnelPropertyFilter>,
}

/// Accepts both `property/operator` (canonical) and `key/op` (legacy) field names.
#[derive(Debug, Serialize, Deserialize)]
pub struct FunnelPropertyFilter {
    #[serde(alias = "key")]
    pub property: String,
    #[serde(alias = "op")]
    pub operator: String,
    pub value: Option<serde_json::Value>,
}

#[derive(Debug, clickhouse::Row, Deserialize)]
pub struct WindowFunnelRow {
    pub level: u8,
    pub users: u64,
}

/// Core computation for funnel results, shared by the handler and compare endpoints.
async fn compute_funnel_results(
    state: &AppState,
    project_id: Uuid,
    funnel_id: Uuid,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    environment: Option<String>,
    segment_id: Option<Uuid>,
) -> Result<FunnelResultsResponse, AppError> {
    let funnel = db::find_funnel(&state.db_pool, project_id, funnel_id)?;

    let steps: Vec<FunnelStep> = serde_json::from_value(funnel.steps)
        .map_err(|e| AppError::Validation(format!("Invalid funnel steps: {}", e)))?;

    if steps.len() < 2 {
        return Err(AppError::Validation(
            "Funnel must have at least 2 steps".into(),
        ));
    }

    // Build optional segment filter
    let segment_filter = if let Some(sid) = segment_id {
        let segment = segments_db::find_segment(&state.db_pool, project_id, sid)?;
        SegmentFilter::build(state, &segment.definition, &environment)?
    } else {
        None
    };

    let db_name = &state.config.clickhouse_database;
    let from_ts = from.timestamp_millis() as f64 / 1000.0;
    let to_ts = to.timestamp_millis() as f64 / 1000.0;

    // Build per-step windowFunnel conditions and collect bind values
    let mut wf_conditions: Vec<String> = Vec::new();
    let mut filter_bind_values: Vec<String> = Vec::new();

    for step in &steps {
        let event_cond = format!("event_name = '{}'", step.event_name.replace('\'', "\\'"));

        if step.property_filters.is_empty() {
            wf_conditions.push(event_cond);
        } else {
            let qb_filters: Vec<query_builder::PropertyFilter> = step
                .property_filters
                .iter()
                .map(|f| query_builder::PropertyFilter {
                    property: f.property.clone(),
                    operator: f.operator.clone(),
                    value: f.value.clone(),
                })
                .collect();
            let (prop_conds, prop_binds) = build_property_filter_clauses(&qb_filters)?;
            let mut all_conds = vec![event_cond];
            all_conds.extend(prop_conds);
            wf_conditions.push(all_conds.join(" AND "));
            filter_bind_values.extend(prop_binds);
        }
    }

    let event_names: Vec<String> = steps
        .iter()
        .map(|s| format!("'{}'", s.event_name.replace('\'', "\\'")))
        .collect();

    let env_filter = if environment.is_some() {
        " AND environment = ?"
    } else {
        ""
    };

    let segment_clause = segment_filter
        .as_ref()
        .map(|f| format!(" WHERE {}", f.sql))
        .unwrap_or_default();

    // Include properties_map in inner SELECT when any step has filters
    let has_filters = steps.iter().any(|s| !s.property_filters.is_empty());
    let extra_cols = if has_filters { ", properties_map" } else { "" };
    let user_uid = USER_UID_EXPR;
    let ij = identity_join(db_name);

    let query = format!(
        "SELECT level, count() AS users FROM ( \
            SELECT user_uid, windowFunnel({window})(toDateTime(server_timestamp), {conditions}) AS level \
            FROM ( \
                SELECT {user_uid} AS user_uid, server_timestamp, event_name{extra_cols} \
                FROM {db_name}.events AS e{ij} \
                WHERE e.project_id = ? AND server_timestamp BETWEEN ? AND ? \
                AND event_name IN ({event_names}){env_filter} \
            ){segment_clause} GROUP BY user_uid \
        ) GROUP BY level ORDER BY level",
        window = funnel.window_seconds,
        conditions = wf_conditions.join(", "),
        event_names = event_names.join(", "),
    );

    // Bind order must match ? placeholder order in the SQL:
    // 1. windowFunnel step filter params (in the SELECT clause)
    // 2. project_id, from_ts, to_ts (inner WHERE)
    // 3. environment (inner WHERE, optional)
    // 4. segment params (outer WHERE, optional)
    let mut q = state.clickhouse_client.query(&query);
    for val in &filter_bind_values {
        q = q.bind(val.as_str());
    }
    q = q.bind(project_id).bind(from_ts).bind(to_ts);
    if let Some(ref env) = environment {
        q = q.bind(env.as_str());
    }
    if let Some(ref sf) = segment_filter {
        q = sf.bind_params(q, project_id, &environment);
    }
    let rows = q
        .fetch_all::<WindowFunnelRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // windowFunnel returns the max step reached per user
    // level 0 = didn't complete step 1, level 1 = completed step 1, etc.
    let total_steps = steps.len();

    // Build cumulative counts: users who reached at least step N
    let mut level_counts = vec![0u64; total_steps + 1];
    for row in &rows {
        if (row.level as usize) <= total_steps {
            level_counts[row.level as usize] = row.users;
        }
    }

    // Cumulative: users reaching step N = sum of users with level >= N
    let mut cumulative = vec![0u64; total_steps + 1];
    let mut running = 0u64;
    for i in (0..=total_steps).rev() {
        running += level_counts[i];
        cumulative[i] = running;
    }

    // Total users who entered the funnel (reached at least step 1)
    let total_entered = cumulative.get(1).copied().unwrap_or(0);

    let step_results: Vec<FunnelStepResult> = steps
        .iter()
        .enumerate()
        .map(|(i, s)| {
            let users = cumulative.get(i + 1).copied().unwrap_or(0);
            let conversion_rate = if total_entered > 0 {
                (users as f64 / total_entered as f64) * 100.0
            } else {
                0.0
            };
            FunnelStepResult {
                step: i + 1,
                event_name: s.event_name.clone(),
                users,
                conversion_rate: (conversion_rate * 100.0).round() / 100.0,
            }
        })
        .collect();

    let overall = step_results
        .last()
        .map(|s| s.conversion_rate)
        .unwrap_or(0.0);

    Ok(FunnelResultsResponse {
        funnel_id,
        from,
        to,
        steps: step_results,
        overall_conversion: overall,
    })
}

pub async fn funnel_results(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, funnel_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<FunnelResultsQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let result = compute_funnel_results(
        &state,
        project_id,
        funnel_id,
        params.from,
        params.to,
        params.environment,
        params.segment_id,
    )
    .await?;
    Ok(Json(result))
}

// ── Funnel Comparison ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CompareFunnelsQuery {
    pub funnel_ids: String, // comma-separated UUIDs
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub environment: Option<String>,
    pub segment_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct CompareFunnelsResponse {
    pub funnels: Vec<FunnelResultsResponse>,
}

pub async fn compare_funnels(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Query(params): Query<CompareFunnelsQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let funnel_ids: Vec<Uuid> = params
        .funnel_ids
        .split(',')
        .map(|s| s.trim().parse::<Uuid>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Validation(format!("Invalid funnel IDs: {}", e)))?;

    let mut results = Vec::new();
    for fid in funnel_ids {
        let result = compute_funnel_results(
            &state,
            project_id,
            fid,
            params.from,
            params.to,
            params.environment.clone(),
            params.segment_id,
        )
        .await?;
        results.push(result);
    }

    Ok(Json(CompareFunnelsResponse { funnels: results }))
}

#[derive(Debug, Deserialize)]
pub struct CompareTimeRangesQuery {
    pub from_a: DateTime<Utc>,
    pub to_a: DateTime<Utc>,
    pub from_b: DateTime<Utc>,
    pub to_b: DateTime<Utc>,
    pub environment: Option<String>,
    pub segment_id: Option<Uuid>,
}

pub async fn compare_time_ranges(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, funnel_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<CompareTimeRangesQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let result_a = compute_funnel_results(
        &state,
        project_id,
        funnel_id,
        params.from_a,
        params.to_a,
        params.environment.clone(),
        params.segment_id,
    )
    .await?;
    let result_b = compute_funnel_results(
        &state,
        project_id,
        funnel_id,
        params.from_b,
        params.to_b,
        params.environment,
        params.segment_id,
    )
    .await?;

    Ok(Json(CompareFunnelsResponse {
        funnels: vec![result_a, result_b],
    }))
}
