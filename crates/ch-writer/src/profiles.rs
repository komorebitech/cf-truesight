//! User profile upserts into ClickHouse.
//!
//! On every event batch, upserts `user_profiles` rows to track last_seen and
//! event counts. On `Identify` events, merges traits into profile properties
//! and promotes `email`, `name`, and `mobile_number` to top-level columns.

use anyhow::{Context, Result};
use truesight_common::event::{EnrichedEvent, EventType};

/// Upserts user profiles for a batch of enriched events.
///
/// For each event, inserts a row with `last_seen` updated. Because the table
/// uses `ReplacingMergeTree(last_seen)`, the most recent row wins after merge.
pub async fn upsert_profiles(
    client: &clickhouse::Client,
    events: &[EnrichedEvent],
) -> Result<()> {
    if events.is_empty() {
        return Ok(());
    }

    let mut rows = Vec::with_capacity(events.len());

    for event in events {
        let user_uid = match &event.user_id {
            Some(uid) if !uid.is_empty() => uid.clone(),
            _ => event.anonymous_id.clone(),
        };

        let timestamp = event
            .server_timestamp
            .format("%Y-%m-%d %H:%M:%S%.3f")
            .to_string();

        let (email, name, mobile_number, props_map) = if event.event_type == EventType::Identify {
            extract_identify_fields(event)
        } else {
            (None, None, None, String::new())
        };

        let email_val = nullable_str(&email);
        let name_val = nullable_str(&name);
        let mobile_val = nullable_str(&mobile_number);

        rows.push(format!(
            "('{}', '{}', {}, {}, {}, {}, '{}', '{}', 1, '{}')",
            event.project_id,
            escape(user_uid.as_str()),
            if props_map.is_empty() {
                "map()".to_string()
            } else {
                props_map
            },
            email_val,
            name_val,
            mobile_val,
            timestamp,
            timestamp,
            escape(&event.environment),
        ));
    }

    let query = format!(
        "INSERT INTO user_profiles \
         (project_id, user_uid, properties, email, name, mobile_number, first_seen, last_seen, event_count, environment) \
         VALUES {}",
        rows.join(", ")
    );

    client
        .query(&query)
        .execute()
        .await
        .context("failed to upsert user_profiles")?;

    tracing::debug!(count = events.len(), "upserted user profiles");
    Ok(())
}

/// Extract identify traits: email, name, mobile_number, and remaining as Map.
fn extract_identify_fields(
    event: &EnrichedEvent,
) -> (Option<String>, Option<String>, Option<String>, String) {
    let Some(serde_json::Value::Object(props)) = &event.properties else {
        let email = event.email.clone();
        let name = None;
        let mobile = event.mobile_number.clone();
        return (email, name, mobile, String::new());
    };

    let email = props
        .get("email")
        .or(props.get("$email"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .or_else(|| event.email.clone());

    let name = props
        .get("name")
        .or(props.get("$name"))
        .and_then(|v| v.as_str())
        .map(String::from);

    let mobile = props
        .get("mobile_number")
        .or(props.get("$phone"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .or_else(|| event.mobile_number.clone());

    // Build remaining properties as a ClickHouse map() expression
    let skip_keys = [
        "email",
        "$email",
        "name",
        "$name",
        "mobile_number",
        "$phone",
    ];
    let map_entries: Vec<String> = props
        .iter()
        .filter(|(k, _)| !skip_keys.contains(&k.as_str()))
        .filter_map(|(k, v)| {
            let val = match v {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Null => return None,
                other => serde_json::to_string(other).unwrap_or_default(),
            };
            Some(format!("'{}', '{}'", escape(k), escape(&val)))
        })
        .collect();

    let props_map = if map_entries.is_empty() {
        String::new()
    } else {
        format!("map({})", map_entries.join(", "))
    };

    (email, name, mobile, props_map)
}

fn nullable_str(opt: &Option<String>) -> String {
    match opt {
        Some(s) => format!("'{}'", escape(s)),
        None => "NULL".to_string(),
    }
}

fn escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\'', "\\'")
}
