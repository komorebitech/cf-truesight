use diesel::prelude::*;
use uuid::Uuid;

use truesight_common::db::DbPool;
use truesight_common::error::AppError;
use truesight_common::schema::segments;

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = segments)]
pub struct Segment {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub segment_type: String,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = segments)]
pub struct NewSegment {
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
    pub segment_type: String,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = segments)]
pub struct UpdateSegment {
    pub name: Option<String>,
    pub description: Option<String>,
    pub definition: Option<serde_json::Value>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub fn list_segments(pool: &DbPool, pid: Uuid) -> Result<Vec<Segment>, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    segments::table
        .filter(segments::project_id.eq(pid))
        .order(segments::created_at.desc())
        .load::<Segment>(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn find_segment(pool: &DbPool, pid: Uuid, sid: Uuid) -> Result<Segment, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    segments::table
        .filter(segments::project_id.eq(pid))
        .filter(segments::id.eq(sid))
        .first::<Segment>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::NotFound("Segment not found".into()),
            _ => AppError::Database(e.to_string()),
        })
}

pub fn insert_segment(pool: &DbPool, new: NewSegment) -> Result<Segment, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    diesel::insert_into(segments::table)
        .values(&new)
        .get_result::<Segment>(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn update_segment(
    pool: &DbPool,
    pid: Uuid,
    sid: Uuid,
    changes: UpdateSegment,
) -> Result<Segment, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    diesel::update(
        segments::table
            .filter(segments::project_id.eq(pid))
            .filter(segments::id.eq(sid)),
    )
    .set(&changes)
    .get_result::<Segment>(&mut conn)
    .map_err(|e| match e {
        diesel::result::Error::NotFound => AppError::NotFound("Segment not found".into()),
        _ => AppError::Database(e.to_string()),
    })
}

pub fn delete_segment(pool: &DbPool, pid: Uuid, sid: Uuid) -> Result<(), AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    let rows = diesel::delete(
        segments::table
            .filter(segments::project_id.eq(pid))
            .filter(segments::id.eq(sid)),
    )
    .execute(&mut conn)
    .map_err(|e| AppError::Database(e.to_string()))?;

    if rows == 0 {
        return Err(AppError::NotFound("Segment not found".into()));
    }
    Ok(())
}
