use diesel::prelude::*;
use uuid::Uuid;

use truesight_common::db::{DbPool, with_conn_app};
use truesight_common::error::AppError;
use truesight_common::schema::funnels;

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = funnels)]
pub struct Funnel {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub steps: serde_json::Value,
    pub window_seconds: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = funnels)]
pub struct NewFunnel {
    pub project_id: Uuid,
    pub name: String,
    pub steps: serde_json::Value,
    pub window_seconds: i32,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = funnels)]
pub struct UpdateFunnel {
    pub name: Option<String>,
    pub steps: Option<serde_json::Value>,
    pub window_seconds: Option<i32>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub fn list_funnels(pool: &DbPool, pid: Uuid) -> Result<Vec<Funnel>, AppError> {
    with_conn_app(pool, |conn| {
        funnels::table
            .filter(funnels::project_id.eq(pid))
            .order(funnels::created_at.desc())
            .load::<Funnel>(conn)
            .map_err(|e| AppError::Database(e.to_string()))
    })
}

pub fn find_funnel(pool: &DbPool, pid: Uuid, fid: Uuid) -> Result<Funnel, AppError> {
    with_conn_app(pool, |conn| {
        funnels::table
            .filter(funnels::project_id.eq(pid))
            .filter(funnels::id.eq(fid))
            .first::<Funnel>(conn)
            .map_err(|e| match e {
                diesel::result::Error::NotFound => AppError::NotFound("Funnel not found".into()),
                _ => AppError::Database(e.to_string()),
            })
    })
}

pub fn insert_funnel(pool: &DbPool, new: NewFunnel) -> Result<Funnel, AppError> {
    with_conn_app(pool, |conn| {
        diesel::insert_into(funnels::table)
            .values(&new)
            .get_result::<Funnel>(conn)
            .map_err(|e| AppError::Database(e.to_string()))
    })
}

pub fn update_funnel(
    pool: &DbPool,
    pid: Uuid,
    fid: Uuid,
    changes: UpdateFunnel,
) -> Result<Funnel, AppError> {
    with_conn_app(pool, |conn| {
        diesel::update(
            funnels::table
                .filter(funnels::project_id.eq(pid))
                .filter(funnels::id.eq(fid)),
        )
        .set(&changes)
        .get_result::<Funnel>(conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::NotFound("Funnel not found".into()),
            _ => AppError::Database(e.to_string()),
        })
    })
}

pub fn delete_funnel(pool: &DbPool, pid: Uuid, fid: Uuid) -> Result<(), AppError> {
    with_conn_app(pool, |conn| {
        let rows = diesel::delete(
            funnels::table
                .filter(funnels::project_id.eq(pid))
                .filter(funnels::id.eq(fid)),
        )
        .execute(conn)
        .map_err(|e| AppError::Database(e.to_string()))?;

        if rows == 0 {
            return Err(AppError::NotFound("Funnel not found".into()));
        }
        Ok(())
    })
}
