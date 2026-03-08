use diesel::prelude::*;
use truesight_common::db::{DbPool, with_conn};
use truesight_common::project::Project;
use truesight_common::schema::{projects, team_members, team_projects, teams, users};
use truesight_common::team::{
    NewTeam, NewTeamMember, NewTeamProject, Team, TeamMember, TeamProject, TeamRole, UpdateTeam,
};
use truesight_common::user::User;
use uuid::Uuid;

use crate::handlers::pagination::SortOrder;

/// Apply dynamic ORDER BY to a boxed teams query.
macro_rules! apply_team_sort {
    ($query:expr, $sort_col:expr, $sort_order:expr) => {
        match ($sort_col, $sort_order) {
            ("name", SortOrder::Asc) => $query.order(teams::name.asc()),
            ("name", SortOrder::Desc) => $query.order(teams::name.desc()),
            ("created_at", SortOrder::Asc) => $query.order(teams::created_at.asc()),
            (_, _) => $query.order(teams::created_at.desc()),
        }
    };
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

/// List teams for a specific user (via team_members join).
/// Returns `(teams, total_count)`.
pub fn list_teams_for_user(
    pool: &DbPool,
    user_id: Uuid,
    limit: i64,
    offset: i64,
    sort_col: &str,
    sort_order: &SortOrder,
) -> Result<(Vec<Team>, i64), diesel::result::Error> {
    with_conn(pool, |conn| {
        let base = teams::table
            .inner_join(team_members::table.on(team_members::team_id.eq(teams::id)))
            .filter(team_members::user_id.eq(user_id))
            .filter(teams::active.eq(true));

        let total: i64 = base.count().get_result(conn)?;

        let query = base.select(Team::as_select()).into_boxed();
        let query = apply_team_sort!(query, sort_col, sort_order);
        let items = query.limit(limit).offset(offset).load::<Team>(conn)?;

        Ok((items, total))
    })
}

/// List all active teams (for static token / superadmin).
/// Returns `(teams, total_count)`.
pub fn list_all_teams(
    pool: &DbPool,
    limit: i64,
    offset: i64,
    sort_col: &str,
    sort_order: &SortOrder,
) -> Result<(Vec<Team>, i64), diesel::result::Error> {
    with_conn(pool, |conn| {
        let base = teams::table.filter(teams::active.eq(true));

        let total: i64 = base.count().get_result(conn)?;

        let query = base.into_boxed();
        let query = apply_team_sort!(query, sort_col, sort_order);
        let items = query.limit(limit).offset(offset).load::<Team>(conn)?;

        Ok((items, total))
    })
}

/// Find a team by ID.
pub fn find_team(pool: &DbPool, team_id: Uuid) -> Result<Option<Team>, diesel::result::Error> {
    with_conn(pool, |conn| {
        teams::table.find(team_id).first::<Team>(conn).optional()
    })
}

/// Insert a new team.
pub fn insert_team(pool: &DbPool, new: NewTeam) -> Result<Team, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::insert_into(teams::table)
            .values(&new)
            .get_result::<Team>(conn)
    })
}

/// Update a team.
pub fn update_team(
    pool: &DbPool,
    team_id: Uuid,
    changes: UpdateTeam,
) -> Result<Option<Team>, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::update(teams::table.find(team_id))
            .set(&changes)
            .get_result::<Team>(conn)
            .optional()
    })
}

/// Delete a team (hard delete).
pub fn delete_team(pool: &DbPool, team_id: Uuid) -> Result<bool, diesel::result::Error> {
    with_conn(pool, |conn| {
        let affected = diesel::delete(teams::table.find(team_id)).execute(conn)?;
        Ok(affected > 0)
    })
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

/// List members of a team with their user details.
pub fn list_members(
    pool: &DbPool,
    team_id: Uuid,
) -> Result<Vec<(TeamMember, User)>, diesel::result::Error> {
    with_conn(pool, |conn| {
        team_members::table
            .inner_join(users::table.on(users::id.eq(team_members::user_id)))
            .filter(team_members::team_id.eq(team_id))
            .select((TeamMember::as_select(), User::as_select()))
            .order(team_members::created_at.asc())
            .load::<(TeamMember, User)>(conn)
    })
}

/// Add a member to a team.
pub fn add_member(pool: &DbPool, new: NewTeamMember) -> Result<TeamMember, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::insert_into(team_members::table)
            .values(&new)
            .get_result::<TeamMember>(conn)
    })
}

/// Update a member's role.
pub fn update_member_role(
    pool: &DbPool,
    team_id: Uuid,
    user_id: Uuid,
    role: TeamRole,
) -> Result<Option<TeamMember>, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::update(
            team_members::table
                .filter(team_members::team_id.eq(team_id))
                .filter(team_members::user_id.eq(user_id)),
        )
        .set(team_members::role.eq(role))
        .get_result::<TeamMember>(conn)
        .optional()
    })
}

/// Remove a member from a team.
pub fn remove_member(
    pool: &DbPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<bool, diesel::result::Error> {
    with_conn(pool, |conn| {
        let affected = diesel::delete(
            team_members::table
                .filter(team_members::team_id.eq(team_id))
                .filter(team_members::user_id.eq(user_id)),
        )
        .execute(conn)?;

        Ok(affected > 0)
    })
}

/// Get a user's role for a given team.
pub fn get_user_role_in_team(
    pool: &DbPool,
    user_id: Uuid,
    team_id: Uuid,
) -> Result<Option<TeamRole>, diesel::result::Error> {
    with_conn(pool, |conn| {
        team_members::table
            .filter(team_members::team_id.eq(team_id))
            .filter(team_members::user_id.eq(user_id))
            .select(team_members::role)
            .first::<TeamRole>(conn)
            .optional()
    })
}

/// Get a user's best (highest) role for a given project by joining
/// team_members and team_projects.
pub fn get_user_role_for_project(
    pool: &DbPool,
    user_id: Uuid,
    project_id: Uuid,
) -> Result<Option<TeamRole>, diesel::result::Error> {
    with_conn(pool, |conn| {
        let roles: Vec<TeamRole> = team_members::table
            .inner_join(team_projects::table.on(team_projects::team_id.eq(team_members::team_id)))
            .filter(team_members::user_id.eq(user_id))
            .filter(team_projects::project_id.eq(project_id))
            .select(team_members::role)
            .load::<TeamRole>(conn)?;

        // Return the highest-privilege role
        Ok(roles.into_iter().max_by_key(|r| match r {
            TeamRole::Admin => 3,
            TeamRole::Editor => 2,
            TeamRole::Viewer => 1,
        }))
    })
}

/// Get all project IDs a user has access to (via team_members + team_projects).
pub fn list_project_ids_for_user(
    pool: &DbPool,
    user_id: Uuid,
) -> Result<Vec<Uuid>, diesel::result::Error> {
    with_conn(pool, |conn| {
        team_members::table
            .inner_join(team_projects::table.on(team_projects::team_id.eq(team_members::team_id)))
            .filter(team_members::user_id.eq(user_id))
            .select(team_projects::project_id)
            .distinct()
            .load::<Uuid>(conn)
    })
}

// ---------------------------------------------------------------------------
// Team Projects
// ---------------------------------------------------------------------------

/// List projects linked to a team (with full project details).
pub fn list_team_projects(
    pool: &DbPool,
    team_id: Uuid,
) -> Result<Vec<(TeamProject, Project)>, diesel::result::Error> {
    with_conn(pool, |conn| {
        team_projects::table
            .inner_join(projects::table.on(projects::id.eq(team_projects::project_id)))
            .filter(team_projects::team_id.eq(team_id))
            .select((TeamProject::as_select(), Project::as_select()))
            .order(team_projects::created_at.desc())
            .load::<(TeamProject, Project)>(conn)
    })
}

/// Link a project to a team.
pub fn link_project(
    pool: &DbPool,
    new: NewTeamProject,
) -> Result<TeamProject, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::insert_into(team_projects::table)
            .values(&new)
            .get_result::<TeamProject>(conn)
    })
}

/// Unlink a project from a team.
pub fn unlink_project(
    pool: &DbPool,
    team_id: Uuid,
    project_id: Uuid,
) -> Result<bool, diesel::result::Error> {
    with_conn(pool, |conn| {
        let affected = diesel::delete(
            team_projects::table
                .filter(team_projects::team_id.eq(team_id))
                .filter(team_projects::project_id.eq(project_id)),
        )
        .execute(conn)?;

        Ok(affected > 0)
    })
}
