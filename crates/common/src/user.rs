use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::users;

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub picture_url: Option<String>,
    pub google_sub: String,
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub onboarding_completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = users)]
pub struct NewUser {
    pub email: String,
    pub name: String,
    pub picture_url: Option<String>,
    pub google_sub: String,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = users)]
pub struct UpdateUser {
    pub name: Option<String>,
    pub picture_url: Option<Option<String>>,
    pub active: Option<bool>,
    pub updated_at: Option<DateTime<Utc>>,
}
