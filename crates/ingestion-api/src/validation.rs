use truesight_common::error::AppError;
use truesight_common::event::{BatchRequest, IngestEvent, validate_ingest_event};

/// Maximum number of events in a single batch.
const MAX_BATCH_SIZE: usize = 100;

/// Maximum serialized size of a single event (32 KB).
const MAX_EVENT_SIZE: usize = 32 * 1024;

/// Maximum total body size after decompression (4 MB).
const MAX_BODY_SIZE: usize = 4 * 1024 * 1024;

/// Validate that the batch size is between 1 and 100 events.
pub fn validate_batch(batch: &BatchRequest) -> Result<(), AppError> {
    if batch.batch.is_empty() {
        return Err(AppError::Validation(
            "Batch must contain at least 1 event".to_string(),
        ));
    }
    if batch.batch.len() > MAX_BATCH_SIZE {
        return Err(AppError::Validation(format!(
            "Batch must contain at most {} events, got {}",
            MAX_BATCH_SIZE,
            batch.batch.len()
        )));
    }
    Ok(())
}

/// Validate a single event: delegates to common validation and checks serialized size.
pub fn validate_event(event: &IngestEvent) -> Result<(), AppError> {
    // Delegate to common validation logic.
    if let Err(errors) = validate_ingest_event(event) {
        return Err(AppError::Validation(errors.join("; ")));
    }

    // Check serialized size.
    let serialized = serde_json::to_vec(event)
        .map_err(|e| AppError::Validation(format!("Failed to serialize event: {e}")))?;
    if serialized.len() > MAX_EVENT_SIZE {
        return Err(AppError::Validation(format!(
            "Event {} exceeds maximum size of {} bytes (actual: {} bytes)",
            event.event_id,
            MAX_EVENT_SIZE,
            serialized.len()
        )));
    }

    Ok(())
}

/// Validate that the decompressed body size does not exceed 4 MB.
pub fn validate_body_size(body: &[u8]) -> Result<(), AppError> {
    if body.len() > MAX_BODY_SIZE {
        return Err(AppError::PayloadTooLarge(format!(
            "Request body exceeds maximum size of {} bytes (actual: {} bytes)",
            MAX_BODY_SIZE,
            body.len()
        )));
    }
    Ok(())
}
