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
pub async fn upsert_profiles(client: &clickhouse::Client, events: &[EnrichedEvent]) -> Result<()> {
    if events.is_empty() {
        return Ok(());
    }

    // Only upsert profiles for identify events (or events that carry profile fields).
    // Non-identify events with no profile data would overwrite existing name/email
    // with NULL via ReplacingMergeTree(last_seen), so we skip them.
    // Event counts and timestamps are handled by the user_stats materialized view.
    let mut rows = Vec::new();

    for event in events {
        let user_uid = match &event.user_id {
            Some(uid) if !uid.is_empty() => uid.clone(),
            _ => event.anonymous_id.clone(),
        };

        let (email, name, mobile_number, props_map) = extract_profile_fields(event);

        // Skip events that carry no profile information
        if email.is_none() && name.is_none() && mobile_number.is_none() && props_map.is_empty() {
            continue;
        }

        let timestamp = event
            .server_timestamp
            .format("%Y-%m-%d %H:%M:%S%.3f")
            .to_string();

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

    if rows.is_empty() {
        return Ok(());
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

    tracing::debug!(count = rows.len(), "upserted user profiles");
    Ok(())
}

/// Case-insensitive lookup: find the first value whose key matches any of
/// the given candidates (compared lowercased).
fn get_ci<'a>(
    props: &'a serde_json::Map<String, serde_json::Value>,
    candidates: &[&str],
) -> Option<&'a str> {
    for (k, v) in props {
        let lower = k.to_lowercase();
        if candidates.iter().any(|c| *c == lower) {
            return v.as_str();
        }
    }
    None
}

/// Returns true if `key` (lowercased) matches any candidate.
fn is_profile_key(key: &str, candidates: &[&str]) -> bool {
    let lower = key.to_lowercase();
    candidates.iter().any(|c| *c == lower)
}

/// Extract profile fields (email, name, mobile_number) from any event type.
/// For identify events, also builds a properties Map for the profile.
fn extract_profile_fields(
    event: &EnrichedEvent,
) -> (Option<String>, Option<String>, Option<String>, String) {
    let is_identify = event.event_type == EventType::Identify;

    let Some(serde_json::Value::Object(props)) = &event.properties else {
        return (
            event.email.clone(),
            None,
            event.mobile_number.clone(),
            String::new(),
        );
    };

    let email_keys = ["email", "$email"];
    let name_keys = [
        "name",
        "$name",
        "first name",
        "first_name",
        "full_name",
        "fullname",
    ];
    let mobile_keys = ["mobile_number", "$phone", "phone", "mobile", "phone_number"];

    let email = get_ci(props, &email_keys)
        .map(String::from)
        .or_else(|| event.email.clone());

    let name = get_ci(props, &name_keys).map(String::from);

    let mobile = get_ci(props, &mobile_keys)
        .map(String::from)
        .or_else(|| event.mobile_number.clone());

    // Only build the properties map for identify events
    let all_skip_keys: Vec<&str> = email_keys
        .iter()
        .chain(name_keys.iter())
        .chain(mobile_keys.iter())
        .copied()
        .collect();

    let props_map = if is_identify {
        let map_entries: Vec<String> = props
            .iter()
            .filter(|(k, _)| !is_profile_key(k, &all_skip_keys))
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

        if map_entries.is_empty() {
            String::new()
        } else {
            format!("map({})", map_entries.join(", "))
        }
    } else {
        String::new()
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
    s.replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace('?', "??")
}
