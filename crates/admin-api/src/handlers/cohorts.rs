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

use crate::db::cohorts as db;
use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

use super::query_builder::validate_identifier;

// ── Types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CohortResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<db::Cohort> for CohortResponse {
    fn from(c: db::Cohort) -> Self {
        Self {
            id: c.id,
            project_id: c.project_id,
            name: c.name,
            description: c.description,
            definition: c.definition,
            created_at: c.created_at,
            updated_at: c.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateCohortInput {
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCohortInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub definition: Option<serde_json::Value>,
}

// ── CRUD Handlers ───────────────────────────────────────────────────

pub async fn list_cohorts(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let cohorts = db::list_cohorts(&state.db_pool, project_id)?;
    let response: Vec<CohortResponse> = cohorts.into_iter().map(CohortResponse::from).collect();
    Ok(Json(response))
}

pub async fn get_cohort(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, cohort_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let cohort = db::find_cohort(&state.db_pool, project_id, cohort_id)?;
    Ok(Json(CohortResponse::from(cohort)))
}

pub async fn create_cohort(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(input): Json<CreateCohortInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    let cohort = db::insert_cohort(
        &state.db_pool,
        db::NewCohort {
            project_id,
            name: input.name,
            description: input.description,
            definition: input.definition,
            segment_type: "manual".to_string(),
        },
    )?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(CohortResponse::from(cohort)),
    ))
}

pub async fn update_cohort(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, cohort_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<UpdateCohortInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    let cohort = db::update_cohort(
        &state.db_pool,
        project_id,
        cohort_id,
        db::UpdateCohort {
            name: input.name,
            description: input.description,
            definition: input.definition,
            updated_at: Utc::now(),
        },
    )?;
    Ok(Json(CohortResponse::from(cohort)))
}

pub async fn delete_cohort(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, cohort_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    db::delete_cohort(&state.db_pool, project_id, cohort_id)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

// ── Cohort Evaluation ───────────────────────────────────────────────

fn default_page() -> u64 {
    1
}

fn default_per_page() -> u64 {
    50
}

#[derive(Debug, Deserialize)]
pub struct CohortUsersQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: u64,
    pub environment: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CohortSizeQuery {
    pub environment: Option<String>,
}

#[derive(Debug, clickhouse::Row, Deserialize, Serialize)]
struct CohortUserRow {
    user_uid: String,
}

#[derive(Debug, Serialize)]
pub struct CohortUsersResponse {
    pub data: Vec<String>,
    pub meta: CohortUsersMeta,
}

#[derive(Debug, Serialize)]
pub struct CohortUsersMeta {
    pub page: u64,
    pub per_page: u64,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct CohortSizeResponse {
    pub cohort_id: Uuid,
    pub size: u64,
}

// ── Cohort Definition Parsing ───────────────────────────────────────

#[derive(Debug, Deserialize)]
struct CohortDefinition {
    operator: String,
    rules: Vec<CohortRule>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum CohortRule {
    #[serde(rename = "event")]
    Event {
        event_name: String,
        op: String,
        count: u64,
        time_window: String,
    },
    #[serde(rename = "property")]
    Property {
        property: String,
        op: String,
        value: String,
    },
}

/// Map a comparison operator string to a SQL operator.
fn sql_op(op: &str) -> Result<&'static str, AppError> {
    match op {
        "eq" => Ok("="),
        "neq" => Ok("!="),
        "gt" => Ok(">"),
        "gte" => Ok(">="),
        "lt" => Ok("<"),
        "lte" => Ok("<="),
        _ => Err(AppError::Validation(format!(
            "Unsupported operator: '{}'",
            op
        ))),
    }
}

/// Parse a time window string like "30d", "7d", "24h" into a ClickHouse INTERVAL expression.
fn parse_time_window(tw: &str) -> Result<String, AppError> {
    validate_identifier(tw)?;
    if let Some(days) = tw.strip_suffix('d') {
        let n: u64 = days
            .parse()
            .map_err(|_| AppError::Validation(format!("Invalid time window: '{}'", tw)))?;
        Ok(format!("{} DAY", n))
    } else if let Some(hours) = tw.strip_suffix('h') {
        let n: u64 = hours
            .parse()
            .map_err(|_| AppError::Validation(format!("Invalid time window: '{}'", tw)))?;
        Ok(format!("{} HOUR", n))
    } else {
        Err(AppError::Validation(format!(
            "Invalid time window format: '{}'. Use e.g. '30d' or '24h'.",
            tw
        )))
    }
}

/// Build the WHERE clauses from a cohort definition. Returns a list of
/// `user_uid IN (subquery)` conditions and the logical connector ("AND" / "OR").
fn build_cohort_clauses(
    def: &CohortDefinition,
    db_name: &str,
    env_filter: &str,
) -> Result<(Vec<String>, String), AppError> {
    let connector = match def.operator.as_str() {
        "and" => "AND",
        "or" => "OR",
        other => {
            return Err(AppError::Validation(format!(
                "Unsupported cohort operator: '{}'",
                other
            )));
        }
    };

    let mut clauses = Vec::new();

    for rule in &def.rules {
        match rule {
            CohortRule::Event {
                event_name,
                op,
                count,
                time_window,
            } => {
                validate_identifier(event_name)?;
                let sql_operator = sql_op(op)?;
                let interval = parse_time_window(time_window)?;
                let escaped_name = event_name.replace('\'', "\\'");

                let subquery = format!(
                    "SELECT COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid \
                     FROM {db_name}.events \
                     WHERE project_id = ? AND event_name = '{escaped_name}' \
                     AND server_timestamp >= now() - INTERVAL {interval}{env_filter} \
                     GROUP BY user_uid \
                     HAVING count() {sql_operator} {count}"
                );
                clauses.push(format!("user_uid IN ({subquery})"));
            }
            CohortRule::Property {
                property,
                op,
                value,
            } => {
                validate_identifier(property)?;
                validate_identifier(value)?;
                let sql_operator = sql_op(op)?;
                let escaped_property = property.replace('\'', "\\'");
                let escaped_value = value.replace('\'', "\\'");

                let subquery = format!(
                    "SELECT user_uid \
                     FROM {db_name}.user_profiles FINAL \
                     WHERE project_id = ? AND properties['{escaped_property}'] {sql_operator} '{escaped_value}'{env_filter}"
                );
                clauses.push(format!("user_uid IN ({subquery})"));
            }
        }
    }

    Ok((clauses, connector.to_string()))
}

pub async fn cohort_users(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, cohort_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<CohortUsersQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    let cohort = db::find_cohort(&state.db_pool, project_id, cohort_id)?;
    let def: CohortDefinition = serde_json::from_value(cohort.definition)
        .map_err(|e| AppError::Validation(format!("Invalid cohort definition: {}", e)))?;

    if def.rules.is_empty() {
        return Ok(Json(CohortUsersResponse {
            data: vec![],
            meta: CohortUsersMeta {
                page: params.page,
                per_page: params.per_page,
                has_more: false,
            },
        }));
    }

    let db_name = &state.config.clickhouse_database;
    let has_env = params.environment.is_some();
    let env_filter = if has_env { " AND environment = ?" } else { "" };

    let (clauses, connector) = build_cohort_clauses(&def, db_name, env_filter)?;
    let where_expr = clauses.join(&format!(" {} ", connector));

    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 200);
    let offset = (page - 1) * per_page;
    let fetch_limit = per_page + 1;

    let query_str = format!(
        "SELECT DISTINCT user_uid \
         FROM ( \
             SELECT COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid \
             FROM {db_name}.events \
             WHERE project_id = ?{env_filter} \
         ) \
         WHERE {where_expr} \
         ORDER BY user_uid \
         LIMIT ? OFFSET ?"
    );

    let mut q = state.clickhouse_client.query(&query_str);

    // Bind the outer query's project_id and optional environment
    q = q.bind(project_id);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }

    // Bind each subquery's project_id (and optional environment)
    for _ in 0..def.rules.len() {
        q = q.bind(project_id);
        if let Some(ref env) = params.environment {
            q = q.bind(env.as_str());
        }
    }

    q = q.bind(fetch_limit);
    q = q.bind(offset);

    let mut rows = q
        .fetch_all::<CohortUserRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    let has_more = rows.len() as u64 > per_page;
    if has_more {
        rows.truncate(per_page as usize);
    }

    let user_uids: Vec<String> = rows.into_iter().map(|r| r.user_uid).collect();

    Ok(Json(CohortUsersResponse {
        data: user_uids,
        meta: CohortUsersMeta {
            page,
            per_page,
            has_more,
        },
    }))
}

pub async fn cohort_size(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, cohort_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<CohortSizeQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    let cohort = db::find_cohort(&state.db_pool, project_id, cohort_id)?;
    let def: CohortDefinition = serde_json::from_value(cohort.definition)
        .map_err(|e| AppError::Validation(format!("Invalid cohort definition: {}", e)))?;

    if def.rules.is_empty() {
        return Ok(Json(CohortSizeResponse { cohort_id, size: 0 }));
    }

    let db_name = &state.config.clickhouse_database;
    let has_env = params.environment.is_some();
    let env_filter = if has_env { " AND environment = ?" } else { "" };

    let (clauses, connector) = build_cohort_clauses(&def, db_name, env_filter)?;
    let where_expr = clauses.join(&format!(" {} ", connector));

    let query_str = format!(
        "SELECT count(DISTINCT user_uid) AS cnt \
         FROM ( \
             SELECT COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid \
             FROM {db_name}.events \
             WHERE project_id = ?{env_filter} \
         ) \
         WHERE {where_expr}"
    );

    let mut q = state.clickhouse_client.query(&query_str);

    // Bind the outer query's project_id and optional environment
    q = q.bind(project_id);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }

    // Bind each subquery's project_id (and optional environment)
    for _ in 0..def.rules.len() {
        q = q.bind(project_id);
        if let Some(ref env) = params.environment {
            q = q.bind(env.as_str());
        }
    }

    let count: u64 = q
        .fetch_one::<u64>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(CohortSizeResponse {
        cohort_id,
        size: count,
    }))
}
