//! Deduplication strategy for the events table.
//!
//! TrueSight relies on ClickHouse's `ReplacingMergeTree(server_timestamp)` engine
//! for deduplication. This means:
//!
//! 1. The `events` table uses `ReplacingMergeTree(server_timestamp)` with
//!    `ORDER BY (project_id, event_id)`.
//! 2. When multiple rows share the same sorting key, ClickHouse keeps only the
//!    row with the highest `server_timestamp` value after background merges run.
//! 3. Until a merge occurs, duplicate rows may be visible. Queries that need
//!    exact deduplication should use `SELECT ... FINAL` or apply `argMax` /
//!    `GROUP BY` on the sorting key.
//!
//! Because the merge-time deduplication is sufficient for our analytics use-case,
//! **no runtime deduplication logic is required in the writer**. The writer simply
//! inserts every event it receives; duplicates (e.g. from SQS at-least-once
//! delivery) are naturally collapsed by ClickHouse.

/// Returns a human-readable explanation of the deduplication strategy.
///
/// Useful for logging at startup or exposing via a debug endpoint.
pub fn dedup_note() -> &'static str {
    "Deduplication is handled by ClickHouse using ReplacingMergeTree(server_timestamp). \
     Rows with the same (project_id, event_id) are collapsed during background merges, \
     keeping only the row with the latest server_timestamp. No runtime dedup is performed \
     by the writer."
}
