use std::sync::Arc;

use truesight_common::config::AdminConfig;
use truesight_common::db::DbPool;

#[derive(Clone)]
pub struct AppState {
    pub db_pool: DbPool,
    pub clickhouse_client: Arc<clickhouse::Client>,
    pub config: Arc<AdminConfig>,
}
