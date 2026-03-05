use serde::Deserialize;
use truesight_common::error::AppError;

// ── Constants ────────────────────────────────────────────────────────

/// `COALESCE(NULLIF(user_id, ''), anonymous_id)` — the canonical expression
/// for resolving a unique user identifier across all ClickHouse queries.
pub const USER_UID_EXPR: &str = "COALESCE(NULLIF(user_id, ''), anonymous_id)";

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

#[derive(Debug, Deserialize)]
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

/// Translate an array of [`PropertyFilter`]s into SQL `WHERE` fragments and
/// their associated bind values.
///
/// Returns `(sql_conditions, bind_values)`.  Conditions that use bind
/// parameters (`eq`, `neq`, `contains`) append their value to
/// `bind_values`; conditions that inline literals (`in`, `not_in`,
/// `exists`, `not_exists`) do not.
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
