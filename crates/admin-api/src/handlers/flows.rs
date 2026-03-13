use std::collections::{HashMap, HashSet};

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
    PropertyFilter, USER_UID_EXPR, build_property_filter_clauses, identity_join,
    validate_identifier,
};

// ── Types ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct FlowsRequest {
    pub anchor_event: String,
    #[serde(default = "default_direction")]
    pub direction: String,
    #[serde(default = "default_steps")]
    pub steps: u32,
    #[serde(default)]
    pub filters: Vec<PropertyFilter>,
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    pub environment: Option<String>,
    #[serde(default = "default_top_paths")]
    pub top_paths: u32,
    #[allow(dead_code)]
    pub segment_id: Option<Uuid>,
}

fn default_direction() -> String {
    "forward".to_string()
}

fn default_steps() -> u32 {
    5
}

fn default_top_paths() -> u32 {
    10
}

// ── Response ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct FlowsResponse {
    pub nodes: Vec<FlowNode>,
    pub links: Vec<FlowLink>,
}

#[derive(Debug, Serialize)]
pub struct FlowNode {
    pub id: String,
    pub name: String,
    pub step: u32,
}

#[derive(Debug, Serialize)]
pub struct FlowLink {
    pub source: String,
    pub target: String,
    pub value: u64,
}

// ── ClickHouse row types ────────────────────────────────────────────

#[derive(Debug, clickhouse::Row, Deserialize)]
struct FlowTransitionRow {
    from_step: i32,
    from_event: String,
    to_step: i32,
    to_event: String,
    users: u64,
}

#[derive(Debug, clickhouse::Row, Deserialize)]
struct AnchorCountRow {
    users: u64,
}

// ── Handler ─────────────────────────────────────────────────────────

pub async fn flows(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(req): Json<FlowsRequest>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    // Validate anchor_event
    validate_identifier(&req.anchor_event)?;

    // Cap steps at 7
    let steps = req.steps.min(7);
    let top_paths = req.top_paths;

    let db = &state.config.clickhouse_database;
    let from_ts = req.from.timestamp_millis() as f64 / 1000.0;
    let to_ts = req.to.timestamp_millis() as f64 / 1000.0;

    // Validate filter property names
    for f in &req.filters {
        validate_identifier(&f.property)?;
    }

    // Build filter conditions using shared helper
    let mut extra_conditions = Vec::new();
    let mut filter_bind_values: Vec<String> = Vec::new();

    if req.environment.is_some() {
        extra_conditions.push("environment = ?".to_string());
    }

    let (prop_conditions, prop_bind_values) = build_property_filter_clauses(&req.filters)?;
    extra_conditions.extend(prop_conditions);
    filter_bind_values.extend(prop_bind_values);

    let extra_where = if extra_conditions.is_empty() {
        String::new()
    } else {
        format!(" AND {}", extra_conditions.join(" AND "))
    };

    // Build the step offset logic depending on direction
    let (step_offset_expr, step_filter) = match req.direction.as_str() {
        "backward" => (
            "(a.anchor_rn - ue.rn) AS step_offset",
            "step_offset >= 0 AND step_offset < ?",
        ),
        _ => (
            "(ue.rn - a.anchor_rn) AS step_offset",
            "ue.rn >= a.anchor_rn AND ue.rn < a.anchor_rn + ?",
        ),
    };

    // For backward, the filter is on the computed step_offset so we use
    // a slightly different approach in the WHERE clause of sequenced CTE.
    let sequenced_filter = if req.direction.as_str() == "backward" {
        "ue.rn <= a.anchor_rn AND ue.rn > a.anchor_rn - ?".to_string()
    } else {
        step_filter.to_string()
    };

    // ── Transition query ────────────────────────────────────────────

    let user_uid = USER_UID_EXPR;
    let ij = identity_join(db);
    let transition_query = format!(
        "WITH user_events AS ( \
            SELECT \
                {user_uid} AS user_uid, \
                event_name, \
                server_timestamp, \
                row_number() OVER (PARTITION BY {user_uid} ORDER BY server_timestamp) AS rn \
            FROM {db}.events AS e{ij} \
            WHERE e.project_id = ? AND server_timestamp BETWEEN ? AND ? \
            AND NOT startsWith(event_name, '$'){extra_where} \
        ), \
        anchor AS ( \
            SELECT user_uid, min(rn) AS anchor_rn \
            FROM user_events \
            WHERE event_name = ? \
            GROUP BY user_uid \
        ), \
        sequenced AS ( \
            SELECT \
                ue.user_uid, \
                ue.event_name, \
                {step_offset_expr} \
            FROM user_events ue \
            INNER JOIN anchor a ON ue.user_uid = a.user_uid \
            WHERE {sequenced_filter} \
        ) \
        SELECT \
            toInt32(s1.step_offset) AS from_step, \
            s1.event_name AS from_event, \
            toInt32(s2.step_offset) AS to_step, \
            s2.event_name AS to_event, \
            toUInt64(count(DISTINCT s1.user_uid)) AS users \
        FROM sequenced s1 \
        INNER JOIN sequenced s2 ON s1.user_uid = s2.user_uid AND s2.step_offset = s1.step_offset + 1 \
        GROUP BY from_step, from_event, to_step, to_event \
        ORDER BY from_step, users DESC"
    );

    let mut q = state
        .clickhouse_client
        .query(&transition_query)
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts);
    if let Some(ref env) = req.environment {
        q = q.bind(env.as_str());
    }
    for val in &filter_bind_values {
        q = q.bind(val.as_str());
    }
    q = q.bind(req.anchor_event.as_str());
    q = q.bind(steps);
    let transition_rows = q
        .fetch_all::<FlowTransitionRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?;

    // ── Anchor count query ──────────────────────────────────────────

    let anchor_count_query = format!(
        "WITH user_events AS ( \
            SELECT \
                {user_uid} AS user_uid, \
                event_name, \
                server_timestamp, \
                row_number() OVER (PARTITION BY {user_uid} ORDER BY server_timestamp) AS rn \
            FROM {db}.events AS e{ij} \
            WHERE e.project_id = ? AND server_timestamp BETWEEN ? AND ? \
            AND NOT startsWith(event_name, '$'){extra_where} \
        ), \
        anchor AS ( \
            SELECT user_uid, min(rn) AS anchor_rn \
            FROM user_events \
            WHERE event_name = ? \
            GROUP BY user_uid \
        ) \
        SELECT count(DISTINCT user_uid) AS users FROM anchor"
    );

    let mut q = state
        .clickhouse_client
        .query(&anchor_count_query)
        .bind(project_id)
        .bind(from_ts)
        .bind(to_ts);
    if let Some(ref env) = req.environment {
        q = q.bind(env.as_str());
    }
    for val in &filter_bind_values {
        q = q.bind(val.as_str());
    }
    q = q.bind(req.anchor_event.as_str());
    let anchor_count = q
        .fetch_one::<AnchorCountRow>()
        .await
        .map_err(|e| AppError::Database(format!("ClickHouse error: {}", e)))?
        .users;

    // ── Post-processing ─────────────────────────────────────────────

    // For each step, keep only top_paths events by user count
    let mut step_events: HashMap<i32, Vec<(String, u64)>> = HashMap::new();
    for row in &transition_rows {
        step_events
            .entry(row.from_step)
            .or_default()
            .push((row.from_event.clone(), row.users));
        step_events
            .entry(row.to_step)
            .or_default()
            .push((row.to_event.clone(), row.users));
    }

    // Deduplicate and aggregate per (step, event), then keep top N
    let mut step_top: HashMap<i32, HashSet<String>> = HashMap::new();
    for (step, events) in &step_events {
        let mut aggregated: HashMap<String, u64> = HashMap::new();
        for (name, count) in events {
            *aggregated.entry(name.clone()).or_default() += count;
        }
        let mut sorted: Vec<(String, u64)> = aggregated.into_iter().collect();
        sorted.sort_by(|a, b| b.1.cmp(&a.1));
        sorted.truncate(top_paths as usize);
        let names: HashSet<String> = sorted.into_iter().map(|(name, _)| name).collect();
        step_top.insert(*step, names);
    }

    // Always include the anchor event at step 0
    step_top
        .entry(0)
        .or_default()
        .insert(req.anchor_event.clone());

    // Build nodes
    let mut nodes: Vec<FlowNode> = Vec::new();
    let mut node_ids: HashSet<String> = HashSet::new();

    // Add anchor node at step 0
    let anchor_node_id = format!("step_0:{}", req.anchor_event);
    nodes.push(FlowNode {
        id: anchor_node_id.clone(),
        name: req.anchor_event.clone(),
        step: 0,
    });
    node_ids.insert(anchor_node_id);

    // Filter transitions to only include top events per step
    let filtered_transitions: Vec<&FlowTransitionRow> = transition_rows
        .iter()
        .filter(|row| {
            let from_ok = step_top
                .get(&row.from_step)
                .is_some_and(|s| s.contains(&row.from_event));
            let to_ok = step_top
                .get(&row.to_step)
                .is_some_and(|s| s.contains(&row.to_event));
            from_ok && to_ok
        })
        .collect();

    // Build nodes from filtered transitions
    for row in &filtered_transitions {
        let from_id = format!("step_{}:{}", row.from_step, row.from_event);
        if node_ids.insert(from_id.clone()) {
            nodes.push(FlowNode {
                id: from_id,
                name: row.from_event.clone(),
                step: row.from_step as u32,
            });
        }
        let to_id = format!("step_{}:{}", row.to_step, row.to_event);
        if node_ids.insert(to_id.clone()) {
            nodes.push(FlowNode {
                id: to_id,
                name: row.to_event.clone(),
                step: row.to_step as u32,
            });
        }
    }

    // Build links
    let mut links: Vec<FlowLink> = filtered_transitions
        .iter()
        .map(|row| FlowLink {
            source: format!("step_{}:{}", row.from_step, row.from_event),
            target: format!("step_{}:{}", row.to_step, row.to_event),
            value: row.users,
        })
        .collect();

    // If there are links from step 0 but the anchor node has a higher count,
    // ensure the anchor node count is represented. The anchor count itself is
    // available as metadata through the step_0 node existence and link values.
    // We don't need a self-link; the anchor_count is implicit in the data.

    // Sort nodes by step then name for deterministic output
    nodes.sort_by(|a, b| a.step.cmp(&b.step).then_with(|| a.name.cmp(&b.name)));

    // Sort links by source step then value descending
    links.sort_by(|a, b| a.source.cmp(&b.source).then_with(|| b.value.cmp(&a.value)));

    // If no transitions were found but anchor users exist, return just the anchor node
    if links.is_empty() && anchor_count > 0 {
        nodes.retain(|n| n.step == 0);
    }

    Ok(Json(FlowsResponse { nodes, links }))
}
