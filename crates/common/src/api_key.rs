use chrono::{DateTime, Utc};
use diesel::prelude::*;
use rand::Rng;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::api_keys;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Insertable)]
#[diesel(table_name = api_keys)]
pub struct ApiKey {
    pub id: Uuid,
    pub project_id: Uuid,
    pub prefix: String,
    pub key_hash: String,
    pub label: String,
    pub environment: String,
    pub active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Insertable)]
#[diesel(table_name = api_keys)]
pub struct NewApiKey {
    pub project_id: Uuid,
    pub prefix: String,
    pub key_hash: String,
    pub label: String,
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub prefix: String,
    pub label: String,
    pub environment: String,
    pub active: bool,
    pub created_at: DateTime<Utc>,
}

impl From<ApiKey> for ApiKeyResponse {
    fn from(key: ApiKey) -> Self {
        Self {
            id: key.id,
            project_id: key.project_id,
            prefix: key.prefix,
            label: key.label,
            environment: key.environment,
            active: key.active,
            created_at: key.created_at,
        }
    }
}

/// Generates an API key for the given environment.
///
/// Returns `(full_key, prefix)` where:
/// - `full_key` is in the format `ts_live_<32 random alphanumeric>` or `ts_test_<32 random alphanumeric>`
/// - `prefix` is the first 8 characters of the full key
pub fn generate_api_key(environment: &str) -> (String, String) {
    let env_prefix = match environment {
        "live" | "production" => "ts_live_",
        _ => "ts_test_",
    };

    let mut rng = rand::thread_rng();
    let random_part: String = (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 10 {
                (b'0' + idx) as char
            } else {
                (b'a' + idx - 10) as char
            }
        })
        .collect();

    let full_key = format!("{}{}", env_prefix, random_part);
    let prefix = full_key[..8].to_string();

    (full_key, prefix)
}
