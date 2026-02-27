use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use diesel::prelude::*;
use std::collections::HashMap;
use std::time::Instant;

use truesight_common::db::get_conn;
use truesight_common::health::HealthStatus;

use crate::state::AppState;

/// Lazy-initialized application start time used to compute uptime.
static START: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

fn uptime_seconds() -> u64 {
    START.get_or_init(Instant::now).elapsed().as_secs()
}

/// GET /health
///
/// Checks the health of downstream dependencies (Postgres, SQS) and returns
/// an aggregated status.  Returns 200 if all dependencies are healthy, 503
/// otherwise.
pub async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    let mut dependencies = HashMap::new();

    // --- Postgres health check ---
    let pg_status = match check_postgres(&state) {
        Ok(()) => {
            dependencies.insert("postgres".to_string(), "ok".to_string());
            true
        }
        Err(e) => {
            dependencies.insert("postgres".to_string(), format!("error: {e}"));
            false
        }
    };

    // --- SQS health check ---
    let sqs_status = match check_sqs(&state).await {
        Ok(()) => {
            dependencies.insert("sqs".to_string(), "ok".to_string());
            true
        }
        Err(e) => {
            dependencies.insert("sqs".to_string(), format!("error: {e}"));
            false
        }
    };

    let all_healthy = pg_status && sqs_status;

    let health = HealthStatus {
        status: if all_healthy {
            "healthy".to_string()
        } else {
            "degraded".to_string()
        },
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime_seconds(),
        dependencies,
    };

    let status_code = if all_healthy {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (status_code, Json(health))
}

/// Run a simple `SELECT 1` against Postgres to verify connectivity.
fn check_postgres(state: &AppState) -> Result<(), String> {
    let mut conn = get_conn(&state.db_pool).map_err(|e| e.to_string())?;
    diesel::sql_query("SELECT 1")
        .execute(&mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Attempt to get queue attributes from SQS to verify connectivity.
async fn check_sqs(state: &AppState) -> Result<(), String> {
    use aws_sdk_sqs::types::QueueAttributeName;

    state
        .sqs_producer
        .client()
        .get_queue_attributes()
        .queue_url(&state.config.sqs_queue_url)
        .attribute_names(QueueAttributeName::ApproximateNumberOfMessages)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
