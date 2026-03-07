use diesel::prelude::*;
use truesight_common::api_key::{ApiKey, NewApiKey};
use truesight_common::db::{DbPool, with_conn};
use truesight_common::schema::api_keys;
use uuid::Uuid;

/// Lists all API keys for a given project.
pub fn list_api_keys_for_project(
    pool: &DbPool,
    project_id: Uuid,
) -> Result<Vec<ApiKey>, diesel::result::Error> {
    with_conn(pool, |conn| {
        api_keys::table
            .filter(api_keys::project_id.eq(project_id))
            .order(api_keys::created_at.desc())
            .load::<ApiKey>(conn)
    })
}

/// Inserts a new API key.
pub fn insert_api_key(pool: &DbPool, new: NewApiKey) -> Result<ApiKey, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::insert_into(api_keys::table)
            .values(&new)
            .get_result::<ApiKey>(conn)
    })
}

/// Revokes a single API key by setting active = false.
/// Only revokes if the key belongs to the specified project.
/// Returns true if a row was updated.
pub fn revoke_api_key(
    pool: &DbPool,
    project_id: Uuid,
    key_id: Uuid,
) -> Result<bool, diesel::result::Error> {
    with_conn(pool, |conn| {
        let affected = diesel::update(
            api_keys::table
                .filter(api_keys::id.eq(key_id))
                .filter(api_keys::project_id.eq(project_id)),
        )
        .set(api_keys::active.eq(false))
        .execute(conn)?;

        Ok(affected > 0)
    })
}

/// Revokes all API keys for a given project.
/// Returns the number of rows affected.
pub fn revoke_all_keys_for_project(
    pool: &DbPool,
    project_id: Uuid,
) -> Result<usize, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::update(api_keys::table.filter(api_keys::project_id.eq(project_id)))
            .set(api_keys::active.eq(false))
            .execute(conn)
    })
}
