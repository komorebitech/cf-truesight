use std::sync::Arc;

use chrono::{DateTime, Utc};
use tokio::sync::RwLock;
use truesight_common::config::AdminConfig;
use truesight_common::db::DbPool;

/// Cached Google JWKS key entry.
#[derive(Clone, Debug)]
pub struct JwkEntry {
    pub kid: String,
    pub n: String,
    pub e: String,
}

/// Cached Google JWKS with fetch timestamp for TTL.
#[derive(Clone, Debug)]
pub struct CachedJwks {
    pub keys: Vec<JwkEntry>,
    pub fetched_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct AppState {
    pub db_pool: DbPool,
    pub clickhouse_client: Arc<clickhouse::Client>,
    pub config: Arc<AdminConfig>,
    pub google_jwks: Arc<RwLock<Option<CachedJwks>>>,
}
