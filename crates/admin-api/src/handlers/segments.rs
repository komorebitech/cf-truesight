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

use crate::db::segments as db;
use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

use super::query_builder::{
    build_property_filter_clauses, column_expr, escape_string_literal, is_top_level,
    validate_identifier,
};

// ── Types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct SegmentResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
    pub segment_type: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<db::Segment> for SegmentResponse {
    fn from(s: db::Segment) -> Self {
        Self {
            id: s.id,
            project_id: s.project_id,
            name: s.name,
            description: s.description,
            definition: s.definition,
            segment_type: s.segment_type,
            created_at: s.created_at,
            updated_at: s.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateSegmentInput {
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
    #[serde(default = "default_segment_type")]
    pub segment_type: String,
}

fn default_segment_type() -> String {
    "manual".to_string()
}

#[derive(Debug, Deserialize)]
pub struct UpdateSegmentInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub definition: Option<serde_json::Value>,
}

// ── CRUD Handlers ───────────────────────────────────────────────────

pub async fn list_segments(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let segments = db::list_segments(&state.db_pool, project_id)?;
    let response: Vec<SegmentResponse> = segments.into_iter().map(SegmentResponse::from).collect();
    Ok(Json(response))
}

pub async fn get_segment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, segment_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let segment = db::find_segment(&state.db_pool, project_id, segment_id)?;
    Ok(Json(SegmentResponse::from(segment)))
}

pub async fn create_segment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(input): Json<CreateSegmentInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    let segment = db::insert_segment(
        &state.db_pool,
        db::NewSegment {
            project_id,
            name: input.name,
            description: input.description,
            definition: input.definition,
            segment_type: input.segment_type,
        },
    )?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(SegmentResponse::from(segment)),
    ))
}

pub async fn update_segment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, segment_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<UpdateSegmentInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    let segment = db::update_segment(
        &state.db_pool,
        project_id,
        segment_id,
        db::UpdateSegment {
            name: input.name,
            description: input.description,
            definition: input.definition,
            updated_at: Utc::now(),
        },
    )?;
    Ok(Json(SegmentResponse::from(segment)))
}

pub async fn delete_segment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, segment_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    db::delete_segment(&state.db_pool, project_id, segment_id)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

// ── Segment Evaluation ──────────────────────────────────────────────

fn default_page() -> u64 {
    1
}

fn default_per_page() -> u64 {
    50
}

#[derive(Debug, Deserialize)]
pub struct SegmentUsersQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: u64,
    pub environment: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SegmentSizeQuery {
    pub environment: Option<String>,
}

#[derive(Debug, clickhouse::Row, Deserialize, Serialize)]
struct SegmentUserRow {
    user_uid: String,
}

#[derive(Debug, Serialize)]
pub struct SegmentUsersResponse {
    pub data: Vec<String>,
    pub meta: SegmentUsersMeta,
}

#[derive(Debug, Serialize)]
pub struct SegmentUsersMeta {
    pub page: u64,
    pub per_page: u64,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct SegmentSizeResponse {
    pub segment_id: Uuid,
    pub size: u64,
}

// ── Preview ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PreviewInput {
    pub definition: serde_json::Value,
    pub environment: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PreviewResponse {
    pub size: u64,
}

// ── Segment Definition Parsing ──────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SegmentDefinition {
    operator: String,
    rules: Vec<SegmentRule>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum SegmentRule {
    #[serde(rename = "event")]
    Event {
        event_name: String,
        #[serde(default = "default_action")]
        action: String,
        op: String,
        count: u64,
        #[serde(default)]
        time_window: Option<serde_json::Value>,
        #[serde(default)]
        property_filters: Vec<SegmentPropertyFilter>,
    },
    #[serde(rename = "property")]
    Property {
        #[serde(default)]
        property: String,
        #[serde(default)]
        op: String,
        #[serde(default)]
        value: String,
        #[serde(default = "default_property_source")]
        source: String,
    },
}

fn default_action() -> String {
    "did".to_string()
}

fn default_property_source() -> String {
    "user".to_string()
}

#[derive(Debug, Deserialize)]
struct SegmentPropertyFilter {
    #[serde(alias = "key")]
    property: String,
    #[serde(alias = "op")]
    operator: String,
    value: Option<serde_json::Value>,
}

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

fn parse_time_constraint(tw: &Option<serde_json::Value>) -> Result<Option<String>, AppError> {
    let tw = match tw {
        Some(v) => v,
        None => return Ok(None),
    };

    // Backward compat: plain string like "30d"
    if let Some(s) = tw.as_str() {
        let interval = parse_relative_window(s)?;
        return Ok(Some(format!(
            "server_timestamp >= now() - INTERVAL {}",
            interval
        )));
    }

    let tw_type = tw
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("relative");

    match tw_type {
        "ever" => Ok(None),
        "relative" => {
            let val = tw.get("value").and_then(|v| v.as_str()).ok_or_else(|| {
                AppError::Validation("Relative time_window requires 'value'".into())
            })?;
            let interval = parse_relative_window(val)?;
            Ok(Some(format!(
                "server_timestamp >= now() - INTERVAL {}",
                interval
            )))
        }
        "absolute" => {
            let from = tw.get("from").and_then(|v| v.as_str()).ok_or_else(|| {
                AppError::Validation("Absolute time_window requires 'from'".into())
            })?;
            let to = tw
                .get("to")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Validation("Absolute time_window requires 'to'".into()))?;
            validate_identifier(from)?;
            validate_identifier(to)?;
            Ok(Some(format!(
                "server_timestamp BETWEEN '{}' AND '{}'",
                escape_string_literal(from),
                escape_string_literal(to)
            )))
        }
        other => Err(AppError::Validation(format!(
            "Unknown time_window type: '{}'",
            other
        ))),
    }
}

fn parse_relative_window(tw: &str) -> Result<String, AppError> {
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

fn build_event_property_filters(
    filters: &[SegmentPropertyFilter],
) -> Result<(Vec<String>, Vec<String>), AppError> {
    let query_builder_filters: Vec<super::query_builder::PropertyFilter> = filters
        .iter()
        .map(|f| super::query_builder::PropertyFilter {
            property: f.property.clone(),
            operator: f.operator.clone(),
            value: f.value.clone(),
        })
        .collect();
    build_property_filter_clauses(&query_builder_filters)
}

fn build_segment_clauses(
    def: &SegmentDefinition,
    db_name: &str,
    env_filter: &str,
) -> Result<(Vec<String>, String, Vec<usize>), AppError> {
    let connector = match def.operator.as_str() {
        "and" => "AND",
        "or" => "OR",
        other => {
            return Err(AppError::Validation(format!(
                "Unsupported segment operator: '{}'",
                other
            )));
        }
    };

    let mut clauses = Vec::new();
    let mut bind_counts = Vec::new();

    for rule in &def.rules {
        match rule {
            SegmentRule::Event {
                event_name,
                action,
                op,
                count,
                time_window,
                property_filters,
            } => {
                validate_identifier(event_name)?;
                let sql_operator = sql_op(op)?;
                let escaped_name = event_name.replace('\'', "\\'");

                let time_constraint = parse_time_constraint(time_window)?;
                let time_clause = time_constraint
                    .map(|tc| format!(" AND {}", tc))
                    .unwrap_or_default();

                let (prop_conditions, prop_binds) = build_event_property_filters(property_filters)?;
                let prop_clause = if prop_conditions.is_empty() {
                    String::new()
                } else {
                    format!(" AND {}", prop_conditions.join(" AND "))
                };

                let in_op = if action == "did_not" { "NOT IN" } else { "IN" };

                let subquery = format!(
                    "SELECT COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid \
                     FROM {db_name}.events \
                     WHERE project_id = ? AND event_name = '{escaped_name}'\
                     {time_clause}{env_filter}{prop_clause} \
                     GROUP BY user_uid \
                     HAVING count() {sql_operator} {count}"
                );
                clauses.push(format!("user_uid {in_op} ({subquery})"));

                let mut bc = 1;
                if !env_filter.is_empty() {
                    bc += 1;
                }
                bc += prop_binds.len();
                bind_counts.push(bc);
            }
            SegmentRule::Property {
                property,
                op,
                value,
                source,
            } => {
                // Skip incomplete property rules (e.g. partially saved segments)
                if property.is_empty() || op.is_empty() {
                    continue;
                }
                validate_identifier(property)?;
                let escaped_property = property.replace('\'', "\\'");

                // Build the WHERE condition based on operator
                let condition = match op.as_str() {
                    "exists" => {
                        if source == "event" {
                            if is_top_level(property) {
                                format!("{} != ''", property)
                            } else {
                                format!("mapContains(properties_map, '{escaped_property}')")
                            }
                        } else {
                            format!("mapContains(properties, '{escaped_property}')")
                        }
                    }
                    "not_exists" => {
                        if source == "event" {
                            if is_top_level(property) {
                                format!("{} = ''", property)
                            } else {
                                format!("NOT mapContains(properties_map, '{escaped_property}')")
                            }
                        } else {
                            format!("NOT mapContains(properties, '{escaped_property}')")
                        }
                    }
                    "contains" => {
                        validate_identifier(value)?;
                        let escaped_value = value.replace('\'', "\\'");
                        let col = if source == "event" {
                            column_expr(property)
                        } else {
                            format!("properties['{escaped_property}']")
                        };
                        format!("positionCaseInsensitive({col}, '{escaped_value}') > 0")
                    }
                    "in" | "not_in" => {
                        validate_identifier(value)?;
                        let escaped_value = value.replace('\'', "\\'");
                        let col = if source == "event" {
                            column_expr(property)
                        } else {
                            format!("properties['{escaped_property}']")
                        };
                        let sql_in = if op == "in" { "IN" } else { "NOT IN" };
                        // value is a comma-separated list
                        let items: Vec<String> = escaped_value
                            .split(',')
                            .map(|s| format!("'{}'", s.trim()))
                            .collect();
                        format!("{col} {sql_in} ({})", items.join(", "))
                    }
                    _ => {
                        validate_identifier(value)?;
                        let sql_operator = sql_op(op)?;
                        let escaped_value = value.replace('\'', "\\'");
                        let col = if source == "event" {
                            column_expr(property)
                        } else {
                            format!("properties['{escaped_property}']")
                        };
                        format!("{col} {sql_operator} '{escaped_value}'")
                    }
                };

                let subquery = if source == "event" {
                    format!(
                        "SELECT COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid \
                         FROM {db_name}.events \
                         WHERE project_id = ? AND {condition}{env_filter}"
                    )
                } else {
                    format!(
                        "SELECT user_uid \
                         FROM {db_name}.user_profiles FINAL \
                         WHERE project_id = ? AND {condition}{env_filter}"
                    )
                };
                clauses.push(format!("user_uid IN ({subquery})"));

                let mut bc = 1;
                if !env_filter.is_empty() {
                    bc += 1;
                }
                bind_counts.push(bc);
            }
        }
    }

    Ok((clauses, connector.to_string(), bind_counts))
}

// ── Public segment filter for reuse by other handlers ───────────────

/// Opaque segment filter that can be embedded into other ClickHouse queries.
/// Build with `SegmentFilter::build`, embed `sql` as a WHERE clause,
/// then call `bind_params` after binding the host query's own params.
pub struct SegmentFilter {
    /// SQL fragment: `user_uid IN (SELECT DISTINCT user_uid FROM ...)`
    pub sql: String,
    ctx: EvalContext,
}

impl SegmentFilter {
    /// Build a segment filter from a segment definition.
    /// Returns `Ok(None)` when the definition has zero rules (matches everyone).
    pub fn build(
        state: &AppState,
        definition: &serde_json::Value,
        environment: &Option<String>,
    ) -> Result<Option<Self>, AppError> {
        let ctx = prepare_eval(state, definition, environment)?;
        if ctx.rules.is_empty() {
            return Ok(None);
        }
        let sql = format!(
            "user_uid IN (\
                SELECT DISTINCT user_uid FROM (\
                    SELECT COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid \
                    FROM {db}.events WHERE project_id = ?{env}\
                ) WHERE {where_expr}\
            )",
            db = ctx.db_name,
            env = ctx.env_filter,
            where_expr = ctx.where_expr,
        );
        Ok(Some(Self { sql, ctx }))
    }

    /// Bind all `?` placeholders introduced by this filter's SQL.
    pub fn bind_params(
        &self,
        q: clickhouse::query::Query,
        project_id: Uuid,
        environment: &Option<String>,
    ) -> clickhouse::query::Query {
        // Outer subquery: project_id, [environment]
        let mut q = q.bind(project_id);
        if let Some(env) = environment {
            q = q.bind(env.as_str());
        }
        // Per-rule binds
        bind_rule_params(q, project_id, environment, &self.ctx.rules, &self.ctx.bind_counts)
    }
}

// ── Evaluation helpers ──────────────────────────────────────────────

struct EvalContext {
    db_name: String,
    env_filter: String,
    where_expr: String,
    rules: Vec<SegmentRule>,
    bind_counts: Vec<usize>,
}

fn prepare_eval(
    state: &AppState,
    definition: &serde_json::Value,
    environment: &Option<String>,
) -> Result<EvalContext, AppError> {
    let def: SegmentDefinition = serde_json::from_value(definition.clone())
        .map_err(|e| AppError::Validation(format!("Invalid segment definition: {}", e)))?;

    let db_name = state.config.clickhouse_database.clone();
    let env_filter = if environment.is_some() {
        " AND environment = ?".to_string()
    } else {
        String::new()
    };

    let (clauses, connector, bind_counts) = build_segment_clauses(&def, &db_name, &env_filter)?;
    let where_expr = if clauses.is_empty() {
        String::new()
    } else {
        clauses.join(&format!(" {} ", connector))
    };

    Ok(EvalContext {
        db_name,
        env_filter,
        where_expr,
        rules: def.rules,
        bind_counts,
    })
}

fn bind_rule_params(
    mut q: clickhouse::query::Query,
    project_id: Uuid,
    environment: &Option<String>,
    rules: &[SegmentRule],
    _bind_counts: &[usize],
) -> clickhouse::query::Query {
    for rule in rules {
        // Skip incomplete property rules (must match build_segment_clauses logic)
        if let SegmentRule::Property { property, op, .. } = rule
            && (property.is_empty() || op.is_empty())
        {
            continue;
        }
        q = q.bind(project_id);
        if let Some(env) = environment {
            q = q.bind(env.as_str());
        }
        if let SegmentRule::Event {
            property_filters, ..
        } = rule
        {
            let qb_filters: Vec<super::query_builder::PropertyFilter> = property_filters
                .iter()
                .map(|f| super::query_builder::PropertyFilter {
                    property: f.property.clone(),
                    operator: f.operator.clone(),
                    value: f.value.clone(),
                })
                .collect();
            if let Ok((_, bind_values)) = build_property_filter_clauses(&qb_filters) {
                for val in &bind_values {
                    q = q.bind(val.as_str());
                }
            }
        }
    }
    q
}

// ── Segment Size ────────────────────────────────────────────────────

pub async fn segment_size(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, segment_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<SegmentSizeQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    let segment = db::find_segment(&state.db_pool, project_id, segment_id)?;
    let ctx = prepare_eval(&state, &segment.definition, &params.environment)?;

    if ctx.rules.is_empty() {
        return Ok(Json(SegmentSizeResponse {
            segment_id,
            size: 0,
        }));
    }

    let query_str = format!(
        "SELECT count(DISTINCT user_uid) AS cnt \
         FROM ( \
             SELECT COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid \
             FROM {db}.events \
             WHERE project_id = ?{env} \
         ) \
         WHERE {where_expr}",
        db = ctx.db_name,
        env = ctx.env_filter,
        where_expr = ctx.where_expr,
    );

    let mut q = state.clickhouse_client.query(&query_str);
    q = q.bind(project_id);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    q = bind_rule_params(
        q,
        project_id,
        &params.environment,
        &ctx.rules,
        &ctx.bind_counts,
    );

    let count: u64 = q
        .fetch_one::<u64>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(SegmentSizeResponse {
        segment_id,
        size: count,
    }))
}

// ── Segment Users ───────────────────────────────────────────────────

pub async fn segment_users(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, segment_id)): Path<(Uuid, Uuid)>,
    Query(params): Query<SegmentUsersQuery>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    let segment = db::find_segment(&state.db_pool, project_id, segment_id)?;
    let ctx = prepare_eval(&state, &segment.definition, &params.environment)?;

    if ctx.rules.is_empty() {
        return Ok(Json(SegmentUsersResponse {
            data: vec![],
            meta: SegmentUsersMeta {
                page: params.page,
                per_page: params.per_page,
                has_more: false,
            },
        }));
    }

    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 200);
    let offset = (page - 1) * per_page;
    let fetch_limit = per_page + 1;

    let query_str = format!(
        "SELECT DISTINCT user_uid \
         FROM ( \
             SELECT COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid \
             FROM {db}.events \
             WHERE project_id = ?{env} \
         ) \
         WHERE {where_expr} \
         ORDER BY user_uid \
         LIMIT ? OFFSET ?",
        db = ctx.db_name,
        env = ctx.env_filter,
        where_expr = ctx.where_expr,
    );

    let mut q = state.clickhouse_client.query(&query_str);
    q = q.bind(project_id);
    if let Some(ref env) = params.environment {
        q = q.bind(env.as_str());
    }
    q = bind_rule_params(
        q,
        project_id,
        &params.environment,
        &ctx.rules,
        &ctx.bind_counts,
    );
    q = q.bind(fetch_limit);
    q = q.bind(offset);

    let mut rows = q
        .fetch_all::<SegmentUserRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    let has_more = rows.len() as u64 > per_page;
    if has_more {
        rows.truncate(per_page as usize);
    }

    let user_uids: Vec<String> = rows.into_iter().map(|r| r.user_uid).collect();

    Ok(Json(SegmentUsersResponse {
        data: user_uids,
        meta: SegmentUsersMeta {
            page,
            per_page,
            has_more,
        },
    }))
}

// ── Segment Preview ─────────────────────────────────────────────────

pub async fn segment_preview(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(input): Json<PreviewInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    let ctx = prepare_eval(&state, &input.definition, &input.environment)?;

    if ctx.rules.is_empty() {
        return Ok(Json(PreviewResponse { size: 0 }));
    }

    let query_str = format!(
        "SELECT count(DISTINCT user_uid) AS cnt \
         FROM ( \
             SELECT COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid \
             FROM {db}.events \
             WHERE project_id = ?{env} \
         ) \
         WHERE {where_expr}",
        db = ctx.db_name,
        env = ctx.env_filter,
        where_expr = ctx.where_expr,
    );

    let mut q = state.clickhouse_client.query(&query_str);
    q = q.bind(project_id);
    if let Some(ref env) = input.environment {
        q = q.bind(env.as_str());
    }
    q = bind_rule_params(
        q,
        project_id,
        &input.environment,
        &ctx.rules,
        &ctx.bind_counts,
    );

    let count: u64 = q
        .fetch_one::<u64>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    Ok(Json(PreviewResponse { size: count }))
}
