//! ClickHouse batch inserter with retry logic.
//!
//! Accepts slices of [`EnrichedEvent`] and inserts them into the `events` table
//! using `INSERT ... FORMAT JSONEachRow`. Failed inserts are retried up to 3
//! times with exponential back-off before the error is propagated to the caller.

use std::collections::HashMap;

use anyhow::Result;
use chrono::{DateTime, Utc};
use regex::Regex;
use serde::Serialize;
use std::sync::LazyLock;
use truesight_common::event::EnrichedEvent;
use uuid::Uuid;

/// Regex to strip Swift `AnyDecodable("...")` wrappers from KMM SDK property values.
static ANY_DECODABLE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"^AnyDecodable\("(.*)"\)$"#).unwrap());

/// Wraps a [`clickhouse::Client`] and provides batch-insert functionality.
pub struct ClickHouseInserter {
    client: clickhouse::Client,
}

/// Flat row representation that maps [`EnrichedEvent`] fields (including a
/// flattened [`DeviceContext`](truesight_common::event::DeviceContext)) to the
/// ClickHouse `events` table columns.
#[derive(Debug, Serialize, clickhouse::Row)]
struct EventRow {
    event_id: Uuid,
    event_name: String,
    event_type: String,
    user_id: String,
    anonymous_id: String,
    mobile_number: String,
    email: String,
    client_timestamp: String,
    server_timestamp: String,
    properties: String,
    properties_map: HashMap<String, String>,
    project_id: Uuid,
    environment: String,
    session_id: Option<String>,
    // Flattened DeviceContext fields
    app_version: String,
    os_name: String,
    os_version: String,
    device_model: String,
    device_id: String,
    network_type: String,
    locale: String,
    timezone: String,
    sdk_version: String,
    platform: String,
}

impl EventRow {
    fn from_enriched(event: &EnrichedEvent) -> Self {
        let event_type_str = serde_json::to_string(&event.event_type)
            .unwrap_or_default()
            .trim_matches('"')
            .to_string();

        let sanitized_props = sanitize_properties(&event.properties);

        let properties_json = sanitized_props
            .as_ref()
            .map(|v| serde_json::to_string(v).unwrap_or_default())
            .unwrap_or_default();

        let properties_map = flatten_properties(&sanitized_props);

        Self {
            event_id: event.event_id,
            event_name: event.event_name.clone(),
            event_type: event_type_str,
            user_id: event.user_id.clone().unwrap_or_default(),
            anonymous_id: event.anonymous_id.clone(),
            mobile_number: event.mobile_number.clone().unwrap_or_default(),
            email: event.email.clone().unwrap_or_default(),
            client_timestamp: format_datetime(&event.client_timestamp),
            server_timestamp: format_datetime(&event.server_timestamp),
            properties: properties_json,
            properties_map,
            project_id: event.project_id,
            environment: event.environment.clone(),
            session_id: event.session_id.clone(),
            app_version: event.context.app_version.clone().unwrap_or_default(),
            os_name: event.context.os_name.clone(),
            os_version: event.context.os_version.clone(),
            device_model: event.context.device_model.clone(),
            device_id: event.context.device_id.clone(),
            network_type: event.context.network_type.clone().unwrap_or_default(),
            locale: event.context.locale.clone(),
            timezone: event.context.timezone.clone(),
            sdk_version: event.context.sdk_version.clone(),
            platform: event
                .context
                .platform
                .clone()
                .filter(|p| !p.is_empty())
                .unwrap_or_else(|| infer_platform(&event.context.os_name)),
        }
    }
}

fn infer_platform(os_name: &str) -> String {
    match os_name.to_lowercase().as_str() {
        "web" => "web",
        "android" => "android",
        "ios" => "ios",
        "macos" | "mac os" | "mac os x" => "macos",
        "windows" => "windows",
        "linux" => "linux",
        _ => "unknown",
    }
    .to_string()
}

/// Strip `AnyDecodable("...")` wrappers from property values.
///
/// The KMM/Swift SDK sometimes serialises values wrapped in `AnyDecodable(...)`.
/// This function recursively walks the JSON and unwraps them to clean strings.
fn sanitize_properties(props: &Option<serde_json::Value>) -> Option<serde_json::Value> {
    props.as_ref().map(sanitize_value)
}

fn sanitize_value(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::String(s) => {
            if let Some(caps) = ANY_DECODABLE_RE.captures(s) {
                serde_json::Value::String(caps[1].to_string())
            } else {
                value.clone()
            }
        }
        serde_json::Value::Object(map) => {
            let cleaned: serde_json::Map<String, serde_json::Value> = map
                .iter()
                .map(|(k, v)| (k.clone(), sanitize_value(v)))
                .collect();
            serde_json::Value::Object(cleaned)
        }
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.iter().map(sanitize_value).collect())
        }
        other => other.clone(),
    }
}

/// Flatten a JSON Value (expected to be an object) into a `Map<String, String>`.
///
/// Primitives are converted with `to_string()`, nested objects/arrays are
/// serialised as JSON strings so nothing is lost.
fn flatten_properties(props: &Option<serde_json::Value>) -> HashMap<String, String> {
    let Some(serde_json::Value::Object(map)) = props else {
        return HashMap::new();
    };
    let mut out = HashMap::with_capacity(map.len());
    for (k, v) in map {
        let s = match v {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Null => continue,
            // Nested objects / arrays — keep as JSON
            other => serde_json::to_string(other).unwrap_or_default(),
        };
        out.insert(k.clone(), s);
    }
    out
}

fn format_datetime(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d %H:%M:%S%.3f").to_string()
}

/// Maximum number of retry attempts for a failed insert.
const MAX_RETRIES: u32 = 3;

/// Base delay in milliseconds for exponential back-off (500ms, 1s, 2s).
const BASE_DELAY_MS: u64 = 500;

impl ClickHouseInserter {
    /// Creates a new inserter connected to the given ClickHouse instance.
    pub fn new(url: &str, database: &str, user: &str, password: &str) -> Self {
        let client = clickhouse::Client::default()
            .with_url(url)
            .with_database(database)
            .with_user(user)
            .with_password(password);

        Self { client }
    }

    /// Returns a reference to the underlying [`clickhouse::Client`].
    ///
    /// This is useful when other modules (e.g. `identity`) need to run ad-hoc
    /// queries against the same connection.
    pub fn client(&self) -> &clickhouse::Client {
        &self.client
    }

    /// Writes rows using the native `INSERT` API (avoids SQL string formatting
    /// which can misinterpret `?` in data as bind parameters).
    async fn try_insert_rows(&self, rows: &[EventRow]) -> Result<()> {
        let mut insert = self.client.insert("events")?;
        for row in rows {
            insert.write(row).await?;
        }
        insert.end().await?;
        Ok(())
    }

    /// Inserts a batch of enriched events into the `events` table.
    ///
    /// The method uses the `clickhouse` crate's native row insertion API.
    /// On failure it retries up to
    /// [`MAX_RETRIES`] times with exponential back-off (500 ms, 1 s, 2 s).
    ///
    /// Returns `Ok(())` on success, or the last encountered error after all
    /// retries are exhausted.
    #[tracing::instrument(name = "ch.insert_batch", skip(self, events), fields(event_count = events.len()))]
    pub async fn insert_batch(&self, events: &[EnrichedEvent]) -> Result<()> {
        if events.is_empty() {
            return Ok(());
        }

        let rows: Vec<EventRow> = events.iter().map(EventRow::from_enriched).collect();

        let mut last_err: Option<anyhow::Error> = None;

        for attempt in 0..MAX_RETRIES {
            match self.try_insert_rows(&rows).await {
                Ok(()) => {
                    tracing::debug!(count = events.len(), attempt, "batch inserted successfully");
                    return Ok(());
                }
                Err(e) => {
                    let delay_ms = BASE_DELAY_MS * 2u64.pow(attempt);
                    tracing::warn!(
                        attempt,
                        delay_ms,
                        error = %e,
                        "insert batch failed, retrying"
                    );
                    last_err = Some(e.context(format!("insert attempt {} failed", attempt + 1)));
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                }
            }
        }

        Err(last_err
            .unwrap_or_else(|| anyhow::anyhow!("insert_batch failed with no error captured")))
    }
}
