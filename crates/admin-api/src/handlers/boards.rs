use axum::{
    Json,
    extract::{Path, State},
    response::IntoResponse,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::error::AppError;
use truesight_common::team::TeamRole;

use crate::db::boards as db;
use crate::handlers::rbac;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

const MAX_WIDGETS_PER_BOARD: i64 = 20;

// ── Board Types ────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct BoardResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<db::Board> for BoardResponse {
    fn from(b: db::Board) -> Self {
        Self {
            id: b.id,
            project_id: b.project_id,
            name: b.name,
            description: b.description,
            is_default: b.is_default,
            created_at: b.created_at,
            updated_at: b.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct BoardDetailResponse {
    #[serde(flatten)]
    pub board: BoardResponse,
    pub widgets: Vec<WidgetResponse>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBoardInput {
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub is_default: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBoardInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_default: Option<bool>,
}

// ── Widget Types ───────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct WidgetResponse {
    pub id: Uuid,
    pub board_id: Uuid,
    pub widget_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub layout: serde_json::Value,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<db::BoardWidget> for WidgetResponse {
    fn from(w: db::BoardWidget) -> Self {
        Self {
            id: w.id,
            board_id: w.board_id,
            widget_type: w.widget_type,
            title: w.title,
            config: w.config,
            layout: w.layout,
            position: w.position,
            created_at: w.created_at,
            updated_at: w.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateWidgetInput {
    pub widget_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub layout: serde_json::Value,
    #[serde(default)]
    pub position: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWidgetInput {
    pub title: Option<String>,
    pub config: Option<serde_json::Value>,
    pub layout: Option<serde_json::Value>,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct LayoutItem {
    pub widget_id: Uuid,
    pub layout: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct BatchLayoutInput {
    pub layouts: Vec<LayoutItem>,
}

// ── Board Handlers ─────────────────────────────────────────────────

pub async fn list_boards(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let boards = db::list_boards(&state.db_pool, project_id)?;
    let response: Vec<BoardResponse> = boards.into_iter().map(BoardResponse::from).collect();
    Ok(Json(response))
}

pub async fn get_board(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, board_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Viewer)?;
    let board = db::find_board(&state.db_pool, project_id, board_id)?;
    let widgets = db::list_widgets(&state.db_pool, board_id)?;
    Ok(Json(BoardDetailResponse {
        board: BoardResponse::from(board),
        widgets: widgets.into_iter().map(WidgetResponse::from).collect(),
    }))
}

pub async fn create_board(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(input): Json<CreateBoardInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    let board = db::insert_board(
        &state.db_pool,
        db::NewBoard {
            project_id,
            name: input.name,
            description: input.description,
            is_default: input.is_default,
        },
    )?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(BoardResponse::from(board)),
    ))
}

pub async fn update_board(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, board_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<UpdateBoardInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    let board = db::update_board(
        &state.db_pool,
        project_id,
        board_id,
        db::UpdateBoard {
            name: input.name,
            description: input.description,
            is_default: input.is_default,
            updated_at: Utc::now(),
        },
    )?;
    Ok(Json(BoardResponse::from(board)))
}

pub async fn delete_board(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, board_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    db::delete_board(&state.db_pool, project_id, board_id)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

// ── Widget Handlers ────────────────────────────────────────────────

pub async fn create_widget(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, board_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<CreateWidgetInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    // Verify board belongs to project
    db::find_board(&state.db_pool, project_id, board_id)?;

    // Enforce widget limit
    let count = db::count_widgets(&state.db_pool, board_id)?;
    if count >= MAX_WIDGETS_PER_BOARD {
        return Err(AppError::Validation(format!(
            "Board already has {} widgets (max {})",
            count, MAX_WIDGETS_PER_BOARD
        )));
    }

    let widget = db::insert_widget(
        &state.db_pool,
        db::NewBoardWidget {
            board_id,
            widget_type: input.widget_type,
            title: input.title,
            config: input.config,
            layout: input.layout,
            position: input.position,
        },
    )?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(WidgetResponse::from(widget)),
    ))
}

pub async fn update_widget(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, board_id, widget_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(input): Json<UpdateWidgetInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    db::find_board(&state.db_pool, project_id, board_id)?;
    let widget = db::update_widget(
        &state.db_pool,
        board_id,
        widget_id,
        db::UpdateBoardWidget {
            title: input.title,
            config: input.config,
            layout: input.layout,
            position: input.position,
            updated_at: Utc::now(),
        },
    )?;
    Ok(Json(WidgetResponse::from(widget)))
}

pub async fn delete_widget(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, board_id, widget_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    db::find_board(&state.db_pool, project_id, board_id)?;
    db::delete_widget(&state.db_pool, board_id, widget_id)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn batch_update_layouts(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, board_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<BatchLayoutInput>,
) -> Result<impl IntoResponse, AppError> {
    rbac::require_project_role(&state, &auth, project_id, TeamRole::Editor)?;
    db::find_board(&state.db_pool, project_id, board_id)?;
    let layouts: Vec<(Uuid, serde_json::Value)> = input
        .layouts
        .into_iter()
        .map(|l| (l.widget_id, l.layout))
        .collect();
    db::batch_update_layouts(&state.db_pool, board_id, layouts)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
