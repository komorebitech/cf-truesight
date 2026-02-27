use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserIdentityMap {
    pub project_id: Uuid,
    pub anonymous_id: String,
    pub user_id: String,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}
