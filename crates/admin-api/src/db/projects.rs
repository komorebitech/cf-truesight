use diesel::prelude::*;
use truesight_common::db::DbPool;
use truesight_common::project::{NewProject, Project, UpdateProject};
use truesight_common::schema::projects;
use uuid::Uuid;

/// Lists projects with optional active filter and pagination.
/// Returns `(projects, total_count)`.
pub fn list_projects(
    pool: &DbPool,
    active_filter: Option<bool>,
    limit: i64,
    offset: i64,
) -> Result<(Vec<Project>, i64), diesel::result::Error> {
    let mut conn = pool.get().map_err(|e| {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new(e.to_string()),
        )
    })?;

    let mut query = projects::table.into_boxed();
    let mut count_query = projects::table.into_boxed();

    if let Some(active) = active_filter {
        query = query.filter(projects::active.eq(active));
        count_query = count_query.filter(projects::active.eq(active));
    }

    let total: i64 = count_query.count().get_result(&mut conn)?;

    let items = query
        .order(projects::created_at.desc())
        .limit(limit)
        .offset(offset)
        .load::<Project>(&mut conn)?;

    Ok((items, total))
}

/// Finds a single project by ID.
pub fn find_project(pool: &DbPool, id: Uuid) -> Result<Option<Project>, diesel::result::Error> {
    let mut conn = pool.get().map_err(|e| {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new(e.to_string()),
        )
    })?;

    projects::table
        .find(id)
        .first::<Project>(&mut conn)
        .optional()
}

/// Inserts a new project.
pub fn insert_project(pool: &DbPool, new: NewProject) -> Result<Project, diesel::result::Error> {
    let mut conn = pool.get().map_err(|e| {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new(e.to_string()),
        )
    })?;

    diesel::insert_into(projects::table)
        .values(&new)
        .get_result::<Project>(&mut conn)
}

/// Updates a project.
pub fn update_project(
    pool: &DbPool,
    id: Uuid,
    changes: UpdateProject,
) -> Result<Option<Project>, diesel::result::Error> {
    let mut conn = pool.get().map_err(|e| {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new(e.to_string()),
        )
    })?;

    diesel::update(projects::table.find(id))
        .set(&changes)
        .get_result::<Project>(&mut conn)
        .optional()
}

/// Soft-deletes a project by setting active = false.
/// Returns true if a row was updated.
pub fn soft_delete_project(pool: &DbPool, id: Uuid) -> Result<bool, diesel::result::Error> {
    let mut conn = pool.get().map_err(|e| {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::Unknown,
            Box::new(e.to_string()),
        )
    })?;

    let affected = diesel::update(projects::table.find(id))
        .set(projects::active.eq(false))
        .execute(&mut conn)?;

    Ok(affected > 0)
}
