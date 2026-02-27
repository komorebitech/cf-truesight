use std::sync::Arc;

use truesight_common::auth::ApiKeyCache;
use truesight_common::config::IngestionConfig;
use truesight_common::db::DbPool;
use truesight_common::sqs::SqsProducer;

#[derive(Clone)]
pub struct AppState {
    pub sqs_producer: Arc<SqsProducer>,
    pub api_key_cache: Arc<ApiKeyCache>,
    pub db_pool: DbPool,
    pub config: Arc<IngestionConfig>,
}
