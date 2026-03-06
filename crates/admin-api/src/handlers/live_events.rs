use std::convert::Infallible;
use std::time::Duration;

use axum::{
    extract::{Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::error::AppError;
use truesight_common::team::TeamRole;

use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

// ── Query parameters ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LiveEventsQuery {
    pub token: String,
    pub environment: Option<String>,
    pub event_type: Option<String>,
    pub event_name: Option<String>,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub mobile_number: Option<String>,
}

// ── ClickHouse row ──────────────────────────────────────────────────

#[derive(Debug, Serialize, clickhouse::Row, Deserialize)]
pub struct LiveEventRow {
    pub event_id: String,
    pub project_id: String,
    pub event_name: String,
    pub event_type: String,
    pub user_id: String,
    pub anonymous_id: String,
    pub email: String,
    pub mobile_number: String,
    #[serde(rename = "client_timestamp")]
    pub client_ts: String,
    #[serde(rename = "server_timestamp")]
    pub server_ts: String,
    pub server_ts_raw: f64,
    pub properties: String,
    pub os_name: String,
    pub device_model: String,
    pub sdk_version: String,
}

// ── Token validation (EventSource can't set headers) ────────────────

fn validate_token(state: &AppState, token: &str) -> Result<AuthUser, AppError> {
    if token == state.config.admin_api_token {
        return Ok(AuthUser {
            user_id: None,
            email: None,
            name: None,
            is_static_token: true,
        });
    }

    if let Some(ref jwt_secret) = state.config.jwt_secret {
        match truesight_common::jwt::verify_jwt(jwt_secret, token) {
            Ok(claims) => {
                let user_id = claims.sub.parse::<Uuid>().ok();
                return Ok(AuthUser {
                    user_id,
                    email: Some(claims.email),
                    name: Some(claims.name),
                    is_static_token: false,
                });
            }
            Err(_) => {
                return Err(AppError::Unauthorized(
                    "Invalid or expired token".to_string(),
                ));
            }
        }
    }

    Err(AppError::Unauthorized("Invalid token".to_string()))
}

// ── SSE handler ─────────────────────────────────────────────────────

pub async fn live_events_stream(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(params): Query<LiveEventsQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError> {
    let auth = validate_token(&state, &params.token)?;
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;

    // Start cursor 30s in the past to show recent events on connect.
    let initial_cursor = chrono::Utc::now().timestamp_millis() as f64 / 1000.0 - 30.0;

    let stream = futures::stream::unfold(
        (initial_cursor, state, project_id, params),
        |(cursor, state, project_id, params)| async move {
            tokio::time::sleep(Duration::from_secs(2)).await;

            let db = &state.config.clickhouse_database;

            // Dynamic WHERE clause
            let mut conditions = vec![
                "project_id = ?".to_string(),
                "server_timestamp > fromUnixTimestamp64Milli(toInt64(? * 1000))".to_string(),
            ];

            if params.environment.is_some() {
                conditions.push("environment = ?".to_string());
            }
            if params.event_type.is_some() {
                conditions.push("event_type = ?".to_string());
            }
            if params.event_name.is_some() {
                conditions.push("positionCaseInsensitive(event_name, ?) > 0".to_string());
            }
            if params.user_id.is_some() {
                conditions
                    .push("positionCaseInsensitive(COALESCE(user_id, ''), ?) > 0".to_string());
            }
            if params.email.is_some() {
                conditions.push("positionCaseInsensitive(COALESCE(email, ''), ?) > 0".to_string());
            }
            if params.mobile_number.is_some() {
                conditions.push(
                    "positionCaseInsensitive(COALESCE(mobile_number, ''), ?) > 0".to_string(),
                );
            }

            let where_clause = conditions.join(" AND ");

            let query_str = format!(
                "SELECT toString(event_id) AS event_id, toString(project_id) AS project_id, \
                 event_name, event_type, \
                 COALESCE(user_id, '') AS user_id, anonymous_id, \
                 COALESCE(email, '') AS email, COALESCE(mobile_number, '') AS mobile_number, \
                 formatDateTime(client_timestamp, '%Y-%m-%dT%H:%i:%S', 'UTC') AS client_ts, \
                 formatDateTime(server_timestamp, '%Y-%m-%dT%H:%i:%S', 'UTC') AS server_ts, \
                 toFloat64(toUnixTimestamp64Milli(server_timestamp)) / 1000.0 AS server_ts_raw, \
                 properties, os_name, device_model, sdk_version \
                 FROM {db}.events WHERE {where_clause} \
                 ORDER BY server_timestamp ASC \
                 LIMIT 100"
            );

            let mut q = state
                .clickhouse_client
                .query(&query_str)
                .bind(project_id)
                .bind(cursor);

            if let Some(ref env) = params.environment {
                q = q.bind(env.as_str());
            }
            if let Some(ref et) = params.event_type {
                q = q.bind(et.as_str());
            }
            if let Some(ref en) = params.event_name {
                q = q.bind(en.as_str());
            }
            if let Some(ref uid) = params.user_id {
                q = q.bind(uid.as_str());
            }
            if let Some(ref em) = params.email {
                q = q.bind(em.as_str());
            }
            if let Some(ref mn) = params.mobile_number {
                q = q.bind(mn.as_str());
            }

            match q.fetch_all::<LiveEventRow>().await {
                Ok(rows) => {
                    let new_cursor = rows.last().map(|r| r.server_ts_raw).unwrap_or(cursor);

                    let event = if rows.is_empty() {
                        Event::default().event("heartbeat").data("")
                    } else {
                        Event::default()
                            .event("events")
                            .data(serde_json::to_string(&rows).unwrap_or_default())
                    };

                    Some((Ok(event), (new_cursor, state, project_id, params)))
                }
                Err(e) => {
                    tracing::error!("Live events ClickHouse error: {}", e);
                    let event = Event::default()
                        .event("error")
                        .data(format!("Query error: {e}"));
                    Some((Ok(event), (cursor, state, project_id, params)))
                }
            }
        },
    );

    Ok(Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15))))
}
