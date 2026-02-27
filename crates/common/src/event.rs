use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EventType {
    Track,
    Identify,
    Screen,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceContext {
    pub app_version: Option<String>,
    pub os_name: String,
    pub os_version: String,
    pub device_model: String,
    pub device_id: String,
    pub network_type: Option<String>,
    pub locale: String,
    pub timezone: String,
    pub sdk_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestEvent {
    pub event_id: Uuid,
    pub event_name: String,
    pub event_type: EventType,
    pub user_id: Option<String>,
    pub anonymous_id: String,
    pub mobile_number: Option<String>,
    pub email: Option<String>,
    pub client_timestamp: DateTime<Utc>,
    pub properties: Option<serde_json::Value>,
    pub context: DeviceContext,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedEvent {
    pub event_id: Uuid,
    pub event_name: String,
    pub event_type: EventType,
    pub user_id: Option<String>,
    pub anonymous_id: String,
    pub mobile_number: Option<String>,
    pub email: Option<String>,
    pub client_timestamp: DateTime<Utc>,
    pub properties: Option<serde_json::Value>,
    pub context: DeviceContext,
    pub project_id: Uuid,
    pub server_timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchRequest {
    pub batch: Vec<IngestEvent>,
    pub sent_at: DateTime<Utc>,
}

/// Validates an `IngestEvent` and returns a list of validation error messages.
/// Returns `Ok(())` if valid, or `Err(Vec<String>)` with all validation failures.
pub fn validate_ingest_event(event: &IngestEvent) -> Result<(), Vec<String>> {
    let mut errors: Vec<String> = Vec::new();

    // event_name max 256 chars
    if event.event_name.len() > 256 {
        errors.push("event_name must be at most 256 characters".to_string());
    }

    // event_name allowed chars: alphanumeric + spaces + _ + . + - + $ (for system events like $screen)
    if !event
        .event_name
        .chars()
        .all(|c| c.is_alphanumeric() || c == ' ' || c == '_' || c == '.' || c == '-' || c == '$')
    {
        errors.push(
            "event_name contains invalid characters; only alphanumeric, spaces, _, ., -, and $ are allowed"
                .to_string(),
        );
    }

    // event_type check (already guaranteed by deserialization, but be explicit)
    match event.event_type {
        EventType::Track | EventType::Identify | EventType::Screen => {}
    }

    // If Identify then user_id is required
    if event.event_type == EventType::Identify && event.user_id.is_none() {
        errors.push("user_id is required for identify events".to_string());
    }

    // mobile_number must be exactly 10 digits when present
    if let Some(ref mobile) = event.mobile_number
        && (mobile.len() != 10 || !mobile.chars().all(|c| c.is_ascii_digit()))
    {
        errors.push("mobile_number must be exactly 10 digits".to_string());
    }

    // email basic validation when present
    if let Some(ref email) = event.email
        && (!email.contains('@') || !email.contains('.') || email.len() < 5)
    {
        errors.push("email is not valid".to_string());
    }

    // client_timestamp not >24h in the future
    let now = Utc::now();
    if event.client_timestamp > now + Duration::hours(24) {
        errors.push("client_timestamp must not be more than 24 hours in the future".to_string());
    }

    // client_timestamp not >30d in the past
    if event.client_timestamp < now - Duration::days(30) {
        errors.push("client_timestamp must not be more than 30 days in the past".to_string());
    }

    // anonymous_id non-empty
    if event.anonymous_id.is_empty() {
        errors.push("anonymous_id must not be empty".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}
