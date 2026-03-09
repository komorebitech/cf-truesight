use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;
use uuid::Uuid;

use truesight_common::error::AppError;
use truesight_common::project::{NewProject, UpdateProject};
use truesight_common::team::TeamRole;

use crate::handlers::pagination::{PaginatedResponse, PaginationMeta, SortOrder, validate_sort_column};
use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

const ALLOWED_SORT_COLUMNS: &[&str] = &["name", "created_at", "updated_at"];

#[derive(Debug, Deserialize)]
pub struct ListProjectsQuery {
    pub active: Option<bool>,
    pub page: Option<u64>,
    pub per_page: Option<u64>,
    pub sort_by: Option<String>,
    #[serde(default)]
    pub sort_order: SortOrder,
}

pub async fn list_projects(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<ListProjectsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;
    // Default to active=true so soft-deleted projects are hidden unless explicitly requested
    let active_filter = Some(params.active.unwrap_or(true));

    let sort_col = match params.sort_by.as_deref() {
        Some(col) => validate_sort_column(col, ALLOWED_SORT_COLUMNS)?,
        None => "created_at",
    };

    // For JWT users, filter to accessible projects only
    let accessible = rbac::accessible_project_ids(&state, &auth)?;

    let (projects, total) = if let Some(ref ids) = accessible {
        crate::db::projects::list_projects_filtered(
            &state.db_pool,
            active_filter,
            per_page as i64,
            offset as i64,
            ids,
            sort_col,
            &params.sort_order,
        )
        .map_err(|e| AppError::Database(e.to_string()))?
    } else {
        crate::db::projects::list_projects(
            &state.db_pool,
            active_filter,
            per_page as i64,
            offset as i64,
            sort_col,
            &params.sort_order,
        )
        .map_err(|e| AppError::Database(e.to_string()))?
    };

    let has_more = (offset + per_page) < total as u64;

    Ok(Json(PaginatedResponse {
        data: projects,
        meta: PaginationMeta {
            page,
            per_page,
            has_more,
            total: Some(total),
        },
    }))
}

pub async fn get_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, id, TeamRole::Viewer)?;

    let project = crate::db::projects::find_project(&state.db_pool, id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound(format!("Project {} not found", id)))?;

    Ok(Json(project))
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
}

pub async fn create_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateProjectRequest>,
) -> Result<impl IntoResponse, AppError> {
    // Any authenticated user can create a project
    let new_project = NewProject { name: body.name };

    let project =
        crate::db::projects::insert_project(&state.db_pool, new_project).map_err(|e| match &e {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            ) => AppError::Validation("A project with this name already exists".to_string()),
            _ => AppError::Database(e.to_string()),
        })?;

    // Auto-link the new project to the creator's team so it shows up in their
    // project list. Static-token users see all projects, so no linking needed.
    if let Some(user_id) = auth.user_id
        && let Some(team_id) = crate::db::teams::first_team_for_user(&state.db_pool, user_id)
            .map_err(|e| AppError::Database(e.to_string()))?
    {
        let _ = crate::db::teams::link_project(
            &state.db_pool,
            truesight_common::team::NewTeamProject {
                team_id,
                project_id: project.id,
            },
        );
    }

    Ok((StatusCode::CREATED, Json(project)))
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub active: Option<bool>,
}

pub async fn update_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProjectRequest>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, id, TeamRole::Editor)?;

    let changes = UpdateProject {
        name: body.name,
        active: body.active,
    };

    let project = crate::db::projects::update_project(&state.db_pool, id, changes)
        .map_err(|e| match &e {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            ) => AppError::Validation("A project with this name already exists".to_string()),
            _ => AppError::Database(e.to_string()),
        })?
        .ok_or_else(|| AppError::NotFound(format!("Project {} not found", id)))?;

    Ok(Json(project))
}

pub async fn delete_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, id, TeamRole::Admin)?;

    let deleted = crate::db::projects::soft_delete_project(&state.db_pool, id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    if !deleted {
        return Err(AppError::NotFound(format!("Project {} not found", id)));
    }

    // Also revoke all API keys for this project
    crate::db::api_keys::revoke_all_keys_for_project(&state.db_pool, id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}
