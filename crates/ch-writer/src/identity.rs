//! Identity resolution: upserting anonymous-to-known user mappings.
//!
//! When an `Identify` event arrives the writer records (or updates) the mapping
//! between `anonymous_id` and `user_id` in the ClickHouse `user_identity_map`
//! table. This allows downstream queries to stitch sessions across identified
//! and anonymous activity.

use anyhow::{Context, Result};
use truesight_common::event::{EnrichedEvent, EventType};

/// If the given event is an `Identify` event with a `user_id`, upsert a row
/// into the `user_identity_map` table.
///
/// The table is expected to exist with the following schema (or compatible):
///
/// ```sql
/// CREATE TABLE IF NOT EXISTS user_identity_map (
///     project_id   UUID,
///     anonymous_id String,
///     user_id      String,
///     first_seen   DateTime64(3, 'UTC'),
///     last_seen    DateTime64(3, 'UTC')
/// ) ENGINE = ReplacingMergeTree(last_seen)
/// ORDER BY (project_id, anonymous_id, user_id);
/// ```
///
/// Because we use `ReplacingMergeTree(last_seen)`, repeated inserts for the
/// same `(project_id, anonymous_id, user_id)` triple naturally resolve to the
/// row with the latest `last_seen` after a merge.
pub async fn process_identify_event(
    client: &clickhouse::Client,
    event: &EnrichedEvent,
) -> Result<()> {
    if event.event_type != EventType::Identify {
        return Ok(());
    }

    let user_id = match &event.user_id {
        Some(uid) if !uid.is_empty() => uid,
        _ => return Ok(()),
    };

    let project_id = event.project_id.to_string();
    let anonymous_id = &event.anonymous_id;
    let timestamp = event
        .server_timestamp
        .format("%Y-%m-%d %H:%M:%S%.3f")
        .to_string();

    let query = format!(
        "INSERT INTO user_identity_map (project_id, anonymous_id, user_id, first_seen, last_seen) VALUES ('{}', '{}', '{}', '{}', '{}')",
        project_id,
        escape_ch_string(anonymous_id),
        escape_ch_string(user_id),
        timestamp,
        timestamp,
    );

    client
        .query(&query)
        .execute()
        .await
        .context("failed to upsert user_identity_map")?;

    tracing::debug!(
        project_id = %event.project_id,
        anonymous_id = %event.anonymous_id,
        user_id = %user_id,
        "upserted identity mapping"
    );

    Ok(())
}

/// Escapes single quotes in a string value for safe inclusion in a ClickHouse
/// SQL literal. This is a minimal escape suitable for string values only.
fn escape_ch_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\'', "\\'")
}
