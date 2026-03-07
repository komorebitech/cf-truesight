use diesel::prelude::*;
use uuid::Uuid;

use truesight_common::db::{DbPool, with_conn_app};
use truesight_common::error::AppError;
use truesight_common::schema::segments;

// Cohort types are aliases over the segments table for backward compatibility.

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = segments)]
pub struct Cohort {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    #[allow(dead_code)]
    pub segment_type: String,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = segments)]
pub struct NewCohort {
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
    pub segment_type: String,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = segments)]
pub struct UpdateCohort {
    pub name: Option<String>,
    pub description: Option<String>,
    pub definition: Option<serde_json::Value>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub fn list_cohorts(pool: &DbPool, pid: Uuid) -> Result<Vec<Cohort>, AppError> {
    with_conn_app(pool, |conn| {
        segments::table
            .filter(segments::project_id.eq(pid))
            .order(segments::created_at.desc())
            .load::<Cohort>(conn)
            .map_err(|e| AppError::Database(e.to_string()))
    })
}

pub fn find_cohort(pool: &DbPool, pid: Uuid, cid: Uuid) -> Result<Cohort, AppError> {
    with_conn_app(pool, |conn| {
        segments::table
            .filter(segments::project_id.eq(pid))
            .filter(segments::id.eq(cid))
            .first::<Cohort>(conn)
            .map_err(|e| match e {
                diesel::result::Error::NotFound => AppError::NotFound("Cohort not found".into()),
                _ => AppError::Database(e.to_string()),
            })
    })
}

pub fn insert_cohort(pool: &DbPool, new: NewCohort) -> Result<Cohort, AppError> {
    with_conn_app(pool, |conn| {
        diesel::insert_into(segments::table)
            .values(&new)
            .get_result::<Cohort>(conn)
            .map_err(|e| AppError::Database(e.to_string()))
    })
}

pub fn update_cohort(
    pool: &DbPool,
    pid: Uuid,
    cid: Uuid,
    changes: UpdateCohort,
) -> Result<Cohort, AppError> {
    with_conn_app(pool, |conn| {
        diesel::update(
            segments::table
                .filter(segments::project_id.eq(pid))
                .filter(segments::id.eq(cid)),
        )
        .set(&changes)
        .get_result::<Cohort>(conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::NotFound("Cohort not found".into()),
            _ => AppError::Database(e.to_string()),
        })
    })
}

pub fn delete_cohort(pool: &DbPool, pid: Uuid, cid: Uuid) -> Result<(), AppError> {
    with_conn_app(pool, |conn| {
        let rows = diesel::delete(
            segments::table
                .filter(segments::project_id.eq(pid))
                .filter(segments::id.eq(cid)),
        )
        .execute(conn)
        .map_err(|e| AppError::Database(e.to_string()))?;

        if rows == 0 {
            return Err(AppError::NotFound("Cohort not found".into()));
        }
        Ok(())
    })
}
