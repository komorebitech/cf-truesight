use axum::{Extension, Json, extract::State, http::StatusCode, response::IntoResponse};
use chrono::Utc;
use serde_json::json;

use truesight_common::error::AppError;
use truesight_common::event::{BatchRequest, EnrichedEvent};

use crate::middleware::api_key_auth::ProjectId;
use crate::middleware::request_id::RequestId;
use crate::state::AppState;
use crate::validation::{validate_batch, validate_event};

/// POST /v1/events/batch
///
/// Accepts a batch of analytics events, validates them, enriches each event
/// with the authenticated project ID and a server-side timestamp, then
/// forwards the batch to SQS for asynchronous processing.
///
/// Returns 202 Accepted on success with the count of accepted events and
/// the request ID for tracing.
pub async fn ingest_batch(
    State(state): State<AppState>,
    project_id: ProjectId,
    Extension(request_id): Extension<RequestId>,
    Json(batch_request): Json<BatchRequest>,
) -> Result<impl IntoResponse, AppError> {
    // Validate batch-level constraints (1..=100 events).
    validate_batch(&batch_request)?;

    // Validate each individual event.
    for event in &batch_request.batch {
        validate_event(event)?;
    }

    // Enrich events with project_id and server_timestamp.
    let now = Utc::now();
    let enriched_events: Vec<EnrichedEvent> = batch_request
        .batch
        .into_iter()
        .map(|event| EnrichedEvent {
            event_id: event.event_id,
            event_name: event.event_name,
            event_type: event.event_type,
            user_id: event.user_id,
            anonymous_id: event.anonymous_id,
            mobile_number: event.mobile_number,
            email: event.email,
            client_timestamp: event.client_timestamp,
            properties: event.properties,
            context: event.context,
            project_id: project_id.0,
            server_timestamp: now,
        })
        .collect();

    let accepted_count = enriched_events.len();

    // Send to SQS.
    state
        .sqs_producer
        .send_batch(&enriched_events, &state.config.sqs_queue_url)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to send events to SQS");
            AppError::Sqs(format!("Failed to enqueue events: {e}"))
        })?;

    tracing::info!(
        request_id = %request_id.0,
        project_id = %project_id.0,
        accepted = accepted_count,
        "Batch ingested successfully"
    );

    Ok((
        StatusCode::ACCEPTED,
        Json(json!({
            "accepted": accepted_count,
            "request_id": request_id.0,
        })),
    ))
}
