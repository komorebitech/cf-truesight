use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use truesight_common::error::AppError;

// ── Constants ────────────────────────────────────────────────────────

/// `anonymous_id` — the canonical expression for resolving a unique user
/// identifier across all ClickHouse analytics queries.
pub const USER_UID_EXPR: &str = "anonymous_id";

/// Merged superset of top-level columns from properties.rs and flows.rs.
pub const TOP_LEVEL_COLUMNS: &[&str] = &[
    "anonymous_id",
    "app_version",
    "device_id",
    "device_model",
    "environment",
    "event_name",
    "event_type",
    "locale",
    "network_type",
    "os_name",
    "os_version",
    "sdk_version",
    "timezone",
    "user_id",
];

// ── Shared types ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct PropertyFilter {
    pub property: String,
    pub operator: String,
    pub value: Option<serde_json::Value>,
}

// ── Helpers ──────────────────────────────────────────────────────────

/// Reject identifiers that contain characters commonly used in SQL injection.
pub fn validate_identifier(name: &str) -> Result<(), AppError> {
    if name.contains('\'') || name.contains('`') || name.contains(';') || name.contains('\\') {
        return Err(AppError::Validation(format!(
            "Invalid characters in identifier: {}",
            name
        )));
    }
    Ok(())
}

/// Escape single-quotes and backslashes for safe embedding in a
/// ClickHouse string literal.
pub fn escape_string_literal(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\'', "\\'")
}

/// Returns `true` when `col` is a first-class column on the events table
/// (as opposed to a key inside `properties_map`).
pub fn is_top_level(col: &str) -> bool {
    TOP_LEVEL_COLUMNS.contains(&col)
}

/// Returns the SQL expression to read `key` — either the bare column name
/// for top-level columns, or `properties_map['<key>']` otherwise.
pub fn column_expr(key: &str) -> String {
    if is_top_level(key) {
        key.to_string()
    } else {
        format!("properties_map['{}']", key)
    }
}

/// Extract a `Vec<String>` from a `Some(Value::Array([...]))`, or return a
/// validation error.  Used by the `in` / `not_in` filter operators.
pub fn extract_string_array(value: &Option<serde_json::Value>) -> Result<Vec<String>, AppError> {
    match value {
        Some(serde_json::Value::Array(arr)) => {
            let mut result = Vec::with_capacity(arr.len());
            for item in arr {
                match item.as_str() {
                    Some(s) => result.push(s.to_string()),
                    None => {
                        return Err(AppError::Validation(
                            "Filter 'in'/'not_in' values must be strings".to_string(),
                        ));
                    }
                }
            }
            Ok(result)
        }
        _ => Err(AppError::Validation(
            "Filter 'in'/'not_in' requires an array of strings".to_string(),
        )),
    }
}

// ── Metric & Period helpers ──────────────────────────────────────────

/// SQL expression for the selected aggregation metric.
pub fn metric_expr(metric: &str) -> Result<&'static str, AppError> {
    match metric {
        "total" => Ok("toFloat64(count())"),
        "unique_users" => Ok("toFloat64(uniqExact(anonymous_id))"),
        "avg_per_user" => Ok(
            "toFloat64(count()) / greatest(1, uniqExact(anonymous_id))",
        ),
        other => Err(AppError::Validation(format!("Unknown metric: {}", other))),
    }
}

/// SQL expression that truncates `server_timestamp` to the requested granularity.
pub fn period_expr(granularity: &str) -> Result<&'static str, AppError> {
    match granularity {
        "hour" => Ok("formatDateTime(toStartOfHour(server_timestamp), '%Y-%m-%d %H:00')"),
        "day" => Ok("formatDateTime(toDate(server_timestamp), '%Y-%m-%d')"),
        "week" => Ok("formatDateTime(toMonday(server_timestamp), '%Y-%m-%d')"),
        "month" => Ok("formatDateTime(toStartOfMonth(server_timestamp), '%Y-%m-%d')"),
        other => Err(AppError::Validation(format!(
            "Unknown granularity: {}",
            other
        ))),
    }
}

/// Build a group key JSON value from up to 3 group-by fields.
pub fn build_group_key(group_by: &[String], g0: &str, g1: &str, g2: &str) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for (i, key) in group_by.iter().enumerate() {
        let val = match i {
            0 => g0,
            1 => g1,
            2 => g2,
            _ => "",
        };
        map.insert(key.clone(), serde_json::Value::String(val.to_string()));
    }
    serde_json::Value::Object(map)
}

/// Shared row types for ClickHouse results with group-by columns.
#[derive(Debug, clickhouse::Row, Deserialize)]
pub struct GroupedSeriesRow {
    pub period: String,
    #[serde(default)]
    pub g0: String,
    #[serde(default)]
    pub g1: String,
    #[serde(default)]
    pub g2: String,
    pub value: f64,
}

#[derive(Debug, clickhouse::Row, Deserialize)]
pub struct GroupedTotalsRow {
    #[serde(default)]
    pub g0: String,
    #[serde(default)]
    pub g1: String,
    #[serde(default)]
    pub g2: String,
    pub value: f64,
}

/// Data point in a time series.
#[derive(Debug, Serialize, Clone)]
pub struct DataPoint {
    pub period: String,
    pub value: f64,
}

/// Post-process series rows into grouped series using insertion-order.
pub fn group_series_rows(
    rows: &[GroupedSeriesRow],
    group_by: &[String],
) -> Vec<(serde_json::Value, Vec<DataPoint>)> {
    let mut map: HashMap<String, Vec<DataPoint>> = HashMap::new();
    let mut order: Vec<String> = Vec::new();

    for row in rows {
        let group_key = build_group_key(group_by, &row.g0, &row.g1, &row.g2).to_string();
        if !map.contains_key(&group_key) {
            order.push(group_key.clone());
        }
        map.entry(group_key).or_default().push(DataPoint {
            period: row.period.clone(),
            value: row.value,
        });
    }

    order
        .into_iter()
        .map(|key| {
            let data = map.remove(&key).unwrap_or_default();
            let group: serde_json::Value =
                serde_json::from_str(&key).unwrap_or(serde_json::Value::Object(Default::default()));
            (group, data)
        })
        .collect()
}

// ── Filter helpers ──────────────────────────────────────────────────

pub fn build_property_filter_clauses(
    filters: &[PropertyFilter],
) -> Result<(Vec<String>, Vec<String>), AppError> {
    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    for f in filters {
        let col = column_expr(&f.property);
        match f.operator.as_str() {
            "eq" => {
                conditions.push(format!("{} = ?", col));
                let val = f
                    .value
                    .as_ref()
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                bind_values.push(val);
            }
            "neq" => {
                conditions.push(format!("{} != ?", col));
                let val = f
                    .value
                    .as_ref()
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                bind_values.push(val);
            }
            "contains" => {
                conditions.push(format!("positionCaseInsensitive({}, ?) > 0", col));
                let val = f
                    .value
                    .as_ref()
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                bind_values.push(val);
            }
            "in" => {
                let values = extract_string_array(&f.value)?;
                let escaped: Vec<String> = values
                    .iter()
                    .map(|v| format!("'{}'", escape_string_literal(v)))
                    .collect();
                conditions.push(format!("{} IN ({})", col, escaped.join(", ")));
            }
            "not_in" => {
                let values = extract_string_array(&f.value)?;
                let escaped: Vec<String> = values
                    .iter()
                    .map(|v| format!("'{}'", escape_string_literal(v)))
                    .collect();
                conditions.push(format!("{} NOT IN ({})", col, escaped.join(", ")));
            }
            "gt" => {
                conditions.push(format!("{} > ?", col));
                let val = f
                    .value
                    .as_ref()
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                bind_values.push(val);
            }
            "gte" => {
                conditions.push(format!("{} >= ?", col));
                let val = f
                    .value
                    .as_ref()
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                bind_values.push(val);
            }
            "lt" => {
                conditions.push(format!("{} < ?", col));
                let val = f
                    .value
                    .as_ref()
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                bind_values.push(val);
            }
            "lte" => {
                conditions.push(format!("{} <= ?", col));
                let val = f
                    .value
                    .as_ref()
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                bind_values.push(val);
            }
            "exists" => {
                validate_identifier(&f.property)?;
                conditions.push(format!(
                    "mapContains(properties_map, '{}')",
                    escape_string_literal(&f.property)
                ));
            }
            "not_exists" => {
                validate_identifier(&f.property)?;
                conditions.push(format!(
                    "NOT mapContains(properties_map, '{}')",
                    escape_string_literal(&f.property)
                ));
            }
            other => {
                return Err(AppError::Validation(format!(
                    "Unknown filter operator: {}",
                    other
                )));
            }
        }
    }

    Ok((conditions, bind_values))
}
