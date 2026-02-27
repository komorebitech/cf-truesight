//! Writer-specific configuration constants and re-exports.
//!
//! The primary `WriterConfig` struct lives in `truesight_common::config` and is
//! loaded from environment variables. This module provides writer-specific
//! defaults and tuning constants that govern batching and concurrency behaviour.

pub use truesight_common::config::WriterConfig;

/// Default maximum number of events accumulated before a batch flush is triggered.
pub const DEFAULT_BATCH_SIZE: usize = 5000;

/// Default timeout in milliseconds before a partial batch is flushed regardless of size.
pub const DEFAULT_BATCH_TIMEOUT_MS: u64 = 2000;

/// Maximum number of concurrent in-flight insert batches. When this limit is
/// reached the batcher will back-pressure, waiting for an outstanding insert to
/// complete before sending the next batch to ClickHouse.
pub const MAX_IN_FLIGHT: usize = 3;
