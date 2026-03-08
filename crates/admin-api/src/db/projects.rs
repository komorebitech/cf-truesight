use diesel::prelude::*;
use truesight_common::db::{DbPool, with_conn};
use truesight_common::project::{NewProject, Project, UpdateProject};
use truesight_common::schema::projects;
use uuid::Uuid;

use crate::handlers::pagination::SortOrder;

/// Apply dynamic ORDER BY to a boxed projects query.
macro_rules! apply_project_sort {
    ($query:expr, $sort_col:expr, $sort_order:expr) => {
        match ($sort_col, $sort_order) {
            ("name", SortOrder::Asc) => $query.order(projects::name.asc()),
            ("name", SortOrder::Desc) => $query.order(projects::name.desc()),
            ("updated_at", SortOrder::Asc) => $query.order(projects::updated_at.asc()),
            ("updated_at", SortOrder::Desc) => $query.order(projects::updated_at.desc()),
            ("created_at", SortOrder::Asc) => $query.order(projects::created_at.asc()),
            (_, _) => $query.order(projects::created_at.desc()),
        }
    };
}

/// Lists projects with optional active filter and pagination.
/// Returns `(projects, total_count)`.
pub fn list_projects(
    pool: &DbPool,
    active_filter: Option<bool>,
    limit: i64,
    offset: i64,
    sort_col: &str,
    sort_order: &SortOrder,
) -> Result<(Vec<Project>, i64), diesel::result::Error> {
    with_conn(pool, |conn| {
        let mut query = projects::table.into_boxed();
        let mut count_query = projects::table.into_boxed();

        if let Some(active) = active_filter {
            query = query.filter(projects::active.eq(active));
            count_query = count_query.filter(projects::active.eq(active));
        }

        let total: i64 = count_query.count().get_result(conn)?;

        let query = apply_project_sort!(query, sort_col, sort_order);
        let items = query.limit(limit).offset(offset).load::<Project>(conn)?;

        Ok((items, total))
    })
}

/// Lists projects with optional active filter, pagination, filtered to specific IDs.
pub fn list_projects_filtered(
    pool: &DbPool,
    active_filter: Option<bool>,
    limit: i64,
    offset: i64,
    allowed_ids: &[Uuid],
    sort_col: &str,
    sort_order: &SortOrder,
) -> Result<(Vec<Project>, i64), diesel::result::Error> {
    with_conn(pool, |conn| {
        let mut query = projects::table.into_boxed();
        let mut count_query = projects::table.into_boxed();

        query = query.filter(projects::id.eq_any(allowed_ids));
        count_query = count_query.filter(projects::id.eq_any(allowed_ids));

        if let Some(active) = active_filter {
            query = query.filter(projects::active.eq(active));
            count_query = count_query.filter(projects::active.eq(active));
        }

        let total: i64 = count_query.count().get_result(conn)?;

        let query = apply_project_sort!(query, sort_col, sort_order);
        let items = query.limit(limit).offset(offset).load::<Project>(conn)?;

        Ok((items, total))
    })
}

/// Finds a single project by ID.
pub fn find_project(pool: &DbPool, id: Uuid) -> Result<Option<Project>, diesel::result::Error> {
    with_conn(pool, |conn| {
        projects::table.find(id).first::<Project>(conn).optional()
    })
}

/// Inserts a new project.
pub fn insert_project(pool: &DbPool, new: NewProject) -> Result<Project, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::insert_into(projects::table)
            .values(&new)
            .get_result::<Project>(conn)
    })
}

/// Updates a project.
pub fn update_project(
    pool: &DbPool,
    id: Uuid,
    changes: UpdateProject,
) -> Result<Option<Project>, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::update(projects::table.find(id))
            .set(&changes)
            .get_result::<Project>(conn)
            .optional()
    })
}

/// Soft-deletes a project by setting active = false.
/// Returns true if a row was updated.
pub fn soft_delete_project(pool: &DbPool, id: Uuid) -> Result<bool, diesel::result::Error> {
    with_conn(pool, |conn| {
        let affected = diesel::update(projects::table.find(id))
            .set(projects::active.eq(false))
            .execute(conn)?;

        Ok(affected > 0)
    })
}
