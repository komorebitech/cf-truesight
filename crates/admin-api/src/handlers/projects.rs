use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::error::AppError;
use truesight_common::project::{NewProject, UpdateProject};

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListProjectsQuery {
    pub active: Option<bool>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PaginationMeta {
    pub page: i64,
    pub per_page: i64,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub data: Vec<T>,
    pub meta: PaginationMeta,
}

pub async fn list_projects(
    State(state): State<AppState>,
    Query(params): Query<ListProjectsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let (projects, total) =
        crate::db::projects::list_projects(&state.db_pool, params.active, per_page, offset)
            .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(Json(PaginatedResponse {
        data: projects,
        meta: PaginationMeta {
            page,
            per_page,
            total,
        },
    }))
}

pub async fn get_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
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
    Json(body): Json<CreateProjectRequest>,
) -> Result<impl IntoResponse, AppError> {
    let new_project = NewProject { name: body.name };

    let project =
        crate::db::projects::insert_project(&state.db_pool, new_project).map_err(|e| match &e {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            ) => AppError::Validation("A project with this name already exists".to_string()),
            _ => AppError::Database(e.to_string()),
        })?;

    Ok((StatusCode::CREATED, Json(project)))
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub active: Option<bool>,
}

pub async fn update_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProjectRequest>,
) -> Result<impl IntoResponse, AppError> {
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
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
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
