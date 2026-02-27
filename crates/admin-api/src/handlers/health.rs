use std::collections::HashMap;
use std::time::Instant;

use axum::{Json, extract::State, response::IntoResponse};

use truesight_common::error::AppError;
use truesight_common::health::HealthStatus;

use crate::state::AppState;

static START_TIME: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

/// Call once at startup to record the boot time.
pub fn record_start_time() {
    START_TIME.get_or_init(Instant::now);
}

pub async fn health(State(state): State<AppState>) -> Result<impl IntoResponse, AppError> {
    let mut deps = HashMap::new();

    // Check Postgres
    let pg_status = {
        let pool = state.db_pool.clone();
        match pool.get() {
            Ok(mut conn) => {
                use diesel::prelude::*;
                use diesel::sql_query;
                match sql_query("SELECT 1").execute(&mut conn) {
                    Ok(_) => "ok".to_string(),
                    Err(e) => format!("error: {}", e),
                }
            }
            Err(e) => format!("error: {}", e),
        }
    };
    deps.insert("postgres".to_string(), pg_status);

    // Check ClickHouse
    let ch_status = match state
        .clickhouse_client
        .query("SELECT 1")
        .fetch_one::<u8>()
        .await
    {
        Ok(_) => "ok".to_string(),
        Err(e) => format!("error: {}", e),
    };
    deps.insert("clickhouse".to_string(), ch_status);

    let all_ok = deps.values().all(|v| v == "ok");

    let uptime = START_TIME.get().map(|t| t.elapsed().as_secs()).unwrap_or(0);

    let status = HealthStatus {
        status: if all_ok {
            "healthy".to_string()
        } else {
            "degraded".to_string()
        },
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
        dependencies: deps,
    };

    Ok(Json(status))
}
