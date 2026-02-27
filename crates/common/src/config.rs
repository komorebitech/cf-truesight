use serde::Deserialize;

fn default_aws_region() -> String {
    "us-east-1".to_string()
}

fn default_empty_string() -> String {
    String::new()
}

// ---------------------------------------------------------------------------
// Ingestion API
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct IngestionConfig {
    #[serde(default = "default_ingestion_port")]
    pub ingestion_api_port: u16,

    pub sqs_queue_url: String,

    pub database_url: String,

    #[serde(default)]
    pub sentry_dsn: Option<String>,

    #[serde(default = "default_aws_region")]
    pub aws_region: String,

    #[serde(default)]
    pub sqs_endpoint_url: Option<String>,
}

fn default_ingestion_port() -> u16 {
    8080
}

impl IngestionConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();
        Ok(envy::from_env::<Self>()?)
    }

    pub fn port(&self) -> u16 {
        self.ingestion_api_port
    }
}

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct AdminConfig {
    #[serde(default = "default_admin_port")]
    pub admin_api_port: u16,

    pub database_url: String,

    pub clickhouse_url: String,

    pub clickhouse_database: String,

    #[serde(default = "default_empty_string")]
    pub clickhouse_user: String,

    #[serde(default = "default_empty_string")]
    pub clickhouse_password: String,

    pub admin_api_token: String,

    #[serde(default = "default_cors_origins")]
    pub cors_allowed_origins: String,

    #[serde(default)]
    pub sentry_dsn: Option<String>,
}

fn default_admin_port() -> u16 {
    8081
}

fn default_cors_origins() -> String {
    "*".to_string()
}

impl AdminConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();
        Ok(envy::from_env::<Self>()?)
    }

    pub fn port(&self) -> u16 {
        self.admin_api_port
    }
}

// ---------------------------------------------------------------------------
// CH Writer
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct WriterConfig {
    pub sqs_queue_url: String,

    pub clickhouse_url: String,

    pub clickhouse_database: String,

    #[serde(default = "default_empty_string")]
    pub clickhouse_user: String,

    #[serde(default = "default_empty_string")]
    pub clickhouse_password: String,

    #[serde(default = "default_batch_size")]
    pub ch_batch_size: usize,

    #[serde(default = "default_flush_interval_secs")]
    pub ch_flush_interval_secs: u64,

    #[serde(default = "default_sqs_receive_batch_size")]
    pub sqs_receive_batch_size: i32,

    #[serde(default = "default_aws_region")]
    pub aws_region: String,

    #[serde(default)]
    pub sqs_endpoint_url: Option<String>,

    #[serde(default)]
    pub sentry_dsn: Option<String>,
}

fn default_batch_size() -> usize {
    1000
}

fn default_flush_interval_secs() -> u64 {
    5
}

fn default_sqs_receive_batch_size() -> i32 {
    10
}

impl WriterConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();
        Ok(envy::from_env::<Self>()?)
    }

    pub fn batch_size(&self) -> usize {
        self.ch_batch_size
    }

    pub fn flush_interval_secs(&self) -> u64 {
        self.ch_flush_interval_secs
    }
}
