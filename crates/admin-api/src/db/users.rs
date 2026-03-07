use chrono::Utc;
use diesel::prelude::*;
use truesight_common::db::{DbPool, with_conn};
use truesight_common::schema::users;
use truesight_common::user::{NewUser, UpdateUser, User};
use uuid::Uuid;

/// Upsert a user by Google `sub` claim. Creates if not exists, updates name/picture if exists.
pub fn upsert_user_by_google_sub(
    pool: &DbPool,
    google_sub: &str,
    email: &str,
    name: &str,
    picture_url: Option<&str>,
) -> Result<User, diesel::result::Error> {
    with_conn(pool, |conn| {
        // Try to find existing user
        let existing = users::table
            .filter(users::google_sub.eq(google_sub))
            .first::<User>(conn)
            .optional()?;

        if let Some(user) = existing {
            // Update name and picture
            diesel::update(users::table.find(user.id))
                .set(&UpdateUser {
                    name: Some(name.to_string()),
                    picture_url: Some(picture_url.map(|s| s.to_string())),
                    active: None,
                    updated_at: Some(Utc::now()),
                })
                .get_result::<User>(conn)
        } else {
            // Create new user
            diesel::insert_into(users::table)
                .values(&NewUser {
                    email: email.to_string(),
                    name: name.to_string(),
                    picture_url: picture_url.map(|s| s.to_string()),
                    google_sub: google_sub.to_string(),
                })
                .get_result::<User>(conn)
        }
    })
}

/// Find a user by ID.
pub fn find_user_by_id(pool: &DbPool, id: Uuid) -> Result<Option<User>, diesel::result::Error> {
    with_conn(pool, |conn| {
        users::table.find(id).first::<User>(conn).optional()
    })
}
