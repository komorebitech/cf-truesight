use serde::{Deserialize, Serialize};

use truesight_common::error::AppError;

// ── Sort Order ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    #[default]
    Desc,
}

impl SortOrder {
    pub fn as_sql(&self) -> &'static str {
        match self {
            SortOrder::Asc => "ASC",
            SortOrder::Desc => "DESC",
        }
    }
}

// ── Pagination Meta ─────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct PaginationMeta {
    pub page: u64,
    pub per_page: u64,
    pub has_more: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub data: Vec<T>,
    pub meta: PaginationMeta,
}

// ── Helpers ─────────────────────────────────────────────────────────

/// Validates that `input` is one of the `allowed` column names.
/// Returns the matching static string to prevent SQL injection.
pub fn validate_sort_column<'a>(input: &str, allowed: &[&'a str]) -> Result<&'a str, AppError> {
    allowed
        .iter()
        .find(|&&c| c == input)
        .copied()
        .ok_or_else(|| AppError::Validation(format!("Invalid sort column: {}", input)))
}
