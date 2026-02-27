//! ClickHouse batch inserter with retry logic.
//!
//! Accepts slices of [`EnrichedEvent`] and inserts them into the `events` table
//! using `INSERT ... FORMAT JSONEachRow`. Failed inserts are retried up to 3
//! times with exponential back-off before the error is propagated to the caller.

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::Serialize;
use truesight_common::event::EnrichedEvent;
use uuid::Uuid;

/// Wraps a [`clickhouse::Client`] and provides batch-insert functionality.
pub struct ClickHouseInserter {
    client: clickhouse::Client,
}

/// Flat row representation that maps [`EnrichedEvent`] fields (including a
/// flattened [`DeviceContext`](truesight_common::event::DeviceContext)) to the
/// ClickHouse `events` table columns.
#[derive(Debug, Serialize)]
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
    project_id: Uuid,
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
}

impl EventRow {
    fn from_enriched(event: &EnrichedEvent) -> Self {
        let event_type_str = serde_json::to_string(&event.event_type)
            .unwrap_or_default()
            .trim_matches('"')
            .to_string();

        let properties_json = event
            .properties
            .as_ref()
            .map(|v| serde_json::to_string(v).unwrap_or_default())
            .unwrap_or_default();

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
            project_id: event.project_id,
            app_version: event.context.app_version.clone().unwrap_or_default(),
            os_name: event.context.os_name.clone(),
            os_version: event.context.os_version.clone(),
            device_model: event.context.device_model.clone(),
            device_id: event.context.device_id.clone(),
            network_type: event.context.network_type.clone().unwrap_or_default(),
            locale: event.context.locale.clone(),
            timezone: event.context.timezone.clone(),
            sdk_version: event.context.sdk_version.clone(),
        }
    }
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

    /// Inserts a batch of enriched events into the `events` table.
    ///
    /// The method serialises each event as a JSON line and uses ClickHouse's
    /// `INSERT ... FORMAT JSONEachRow` protocol. On failure it retries up to
    /// [`MAX_RETRIES`] times with exponential back-off (500 ms, 1 s, 2 s).
    ///
    /// Returns `Ok(())` on success, or the last encountered error after all
    /// retries are exhausted.
    pub async fn insert_batch(&self, events: &[EnrichedEvent]) -> Result<()> {
        if events.is_empty() {
            return Ok(());
        }

        let rows: Vec<EventRow> = events.iter().map(EventRow::from_enriched).collect();

        let json_lines: Vec<String> = rows
            .iter()
            .map(|r| serde_json::to_string(r).expect("EventRow serialisation must not fail"))
            .collect();

        let body = json_lines.join("\n");

        let mut last_err: Option<anyhow::Error> = None;

        for attempt in 0..MAX_RETRIES {
            let query = format!("INSERT INTO events FORMAT JSONEachRow\n{}", body);

            match self.client.query(&query).execute().await {
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
                    last_err = Some(
                        anyhow::Error::new(e)
                            .context(format!("insert attempt {} failed", attempt + 1)),
                    );
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                }
            }
        }

        Err(last_err
            .unwrap_or_else(|| anyhow::anyhow!("insert_batch failed with no error captured")))
    }
}
