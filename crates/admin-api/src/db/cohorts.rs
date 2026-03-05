use diesel::prelude::*;
use uuid::Uuid;

use truesight_common::db::DbPool;
use truesight_common::error::AppError;
use truesight_common::schema::cohorts;

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = cohorts)]
pub struct Cohort {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = cohorts)]
pub struct NewCohort {
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub definition: serde_json::Value,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = cohorts)]
pub struct UpdateCohort {
    pub name: Option<String>,
    pub description: Option<String>,
    pub definition: Option<serde_json::Value>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub fn list_cohorts(pool: &DbPool, pid: Uuid) -> Result<Vec<Cohort>, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    cohorts::table
        .filter(cohorts::project_id.eq(pid))
        .order(cohorts::created_at.desc())
        .load::<Cohort>(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn find_cohort(pool: &DbPool, pid: Uuid, cid: Uuid) -> Result<Cohort, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    cohorts::table
        .filter(cohorts::project_id.eq(pid))
        .filter(cohorts::id.eq(cid))
        .first::<Cohort>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::NotFound("Cohort not found".into()),
            _ => AppError::Database(e.to_string()),
        })
}

pub fn insert_cohort(pool: &DbPool, new: NewCohort) -> Result<Cohort, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    diesel::insert_into(cohorts::table)
        .values(&new)
        .get_result::<Cohort>(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn update_cohort(
    pool: &DbPool,
    pid: Uuid,
    cid: Uuid,
    changes: UpdateCohort,
) -> Result<Cohort, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    diesel::update(
        cohorts::table
            .filter(cohorts::project_id.eq(pid))
            .filter(cohorts::id.eq(cid)),
    )
    .set(&changes)
    .get_result::<Cohort>(&mut conn)
    .map_err(|e| match e {
        diesel::result::Error::NotFound => AppError::NotFound("Cohort not found".into()),
        _ => AppError::Database(e.to_string()),
    })
}

pub fn delete_cohort(pool: &DbPool, pid: Uuid, cid: Uuid) -> Result<(), AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    let rows = diesel::delete(
        cohorts::table
            .filter(cohorts::project_id.eq(pid))
            .filter(cohorts::id.eq(cid)),
    )
    .execute(&mut conn)
    .map_err(|e| AppError::Database(e.to_string()))?;

    if rows == 0 {
        return Err(AppError::NotFound("Cohort not found".into()));
    }
    Ok(())
}
