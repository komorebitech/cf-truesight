use diesel::prelude::*;
use uuid::Uuid;

use truesight_common::db::DbPool;
use truesight_common::error::AppError;
use truesight_common::schema::{board_widgets, boards};

// ── Board ──────────────────────────────────────────────────────────

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = boards)]
pub struct Board {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = boards)]
pub struct NewBoard {
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = boards)]
pub struct UpdateBoard {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_default: Option<bool>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// ── BoardWidget ────────────────────────────────────────────────────

#[derive(Debug, Queryable, Selectable)]
#[diesel(table_name = board_widgets)]
pub struct BoardWidget {
    pub id: Uuid,
    pub board_id: Uuid,
    pub widget_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub layout: serde_json::Value,
    pub position: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = board_widgets)]
pub struct NewBoardWidget {
    pub board_id: Uuid,
    pub widget_type: String,
    pub title: String,
    pub config: serde_json::Value,
    pub layout: serde_json::Value,
    pub position: i32,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = board_widgets)]
pub struct UpdateBoardWidget {
    pub title: Option<String>,
    pub config: Option<serde_json::Value>,
    pub layout: Option<serde_json::Value>,
    pub position: Option<i32>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// ── Board CRUD ─────────────────────────────────────────────────────

pub fn list_boards(pool: &DbPool, pid: Uuid) -> Result<Vec<Board>, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    boards::table
        .filter(boards::project_id.eq(pid))
        .order(boards::created_at.desc())
        .load::<Board>(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn find_board(pool: &DbPool, pid: Uuid, bid: Uuid) -> Result<Board, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    boards::table
        .filter(boards::project_id.eq(pid))
        .filter(boards::id.eq(bid))
        .first::<Board>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::NotFound("Board not found".into()),
            _ => AppError::Database(e.to_string()),
        })
}

pub fn insert_board(pool: &DbPool, new: NewBoard) -> Result<Board, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    diesel::insert_into(boards::table)
        .values(&new)
        .get_result::<Board>(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn update_board(
    pool: &DbPool,
    pid: Uuid,
    bid: Uuid,
    changes: UpdateBoard,
) -> Result<Board, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    diesel::update(
        boards::table
            .filter(boards::project_id.eq(pid))
            .filter(boards::id.eq(bid)),
    )
    .set(&changes)
    .get_result::<Board>(&mut conn)
    .map_err(|e| match e {
        diesel::result::Error::NotFound => AppError::NotFound("Board not found".into()),
        _ => AppError::Database(e.to_string()),
    })
}

pub fn delete_board(pool: &DbPool, pid: Uuid, bid: Uuid) -> Result<(), AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    let rows = diesel::delete(
        boards::table
            .filter(boards::project_id.eq(pid))
            .filter(boards::id.eq(bid)),
    )
    .execute(&mut conn)
    .map_err(|e| AppError::Database(e.to_string()))?;

    if rows == 0 {
        return Err(AppError::NotFound("Board not found".into()));
    }
    Ok(())
}

// ── Widget CRUD ────────────────────────────────────────────────────

pub fn list_widgets(pool: &DbPool, bid: Uuid) -> Result<Vec<BoardWidget>, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    board_widgets::table
        .filter(board_widgets::board_id.eq(bid))
        .order(board_widgets::position.asc())
        .load::<BoardWidget>(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn count_widgets(pool: &DbPool, bid: Uuid) -> Result<i64, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    board_widgets::table
        .filter(board_widgets::board_id.eq(bid))
        .count()
        .get_result::<i64>(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn insert_widget(pool: &DbPool, new: NewBoardWidget) -> Result<BoardWidget, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    diesel::insert_into(board_widgets::table)
        .values(&new)
        .get_result::<BoardWidget>(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))
}

pub fn update_widget(
    pool: &DbPool,
    bid: Uuid,
    wid: Uuid,
    changes: UpdateBoardWidget,
) -> Result<BoardWidget, AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    diesel::update(
        board_widgets::table
            .filter(board_widgets::board_id.eq(bid))
            .filter(board_widgets::id.eq(wid)),
    )
    .set(&changes)
    .get_result::<BoardWidget>(&mut conn)
    .map_err(|e| match e {
        diesel::result::Error::NotFound => AppError::NotFound("Widget not found".into()),
        _ => AppError::Database(e.to_string()),
    })
}

pub fn delete_widget(pool: &DbPool, bid: Uuid, wid: Uuid) -> Result<(), AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    let rows = diesel::delete(
        board_widgets::table
            .filter(board_widgets::board_id.eq(bid))
            .filter(board_widgets::id.eq(wid)),
    )
    .execute(&mut conn)
    .map_err(|e| AppError::Database(e.to_string()))?;

    if rows == 0 {
        return Err(AppError::NotFound("Widget not found".into()));
    }
    Ok(())
}

pub fn batch_update_layouts(
    pool: &DbPool,
    bid: Uuid,
    layouts: Vec<(Uuid, serde_json::Value)>,
) -> Result<(), AppError> {
    let mut conn = pool.get().map_err(|e| AppError::Database(e.to_string()))?;
    let now = chrono::Utc::now();
    for (wid, layout_value) in layouts {
        diesel::update(
            board_widgets::table
                .filter(board_widgets::board_id.eq(bid))
                .filter(board_widgets::id.eq(wid)),
        )
        .set((
            board_widgets::layout.eq(&layout_value),
            board_widgets::updated_at.eq(now),
        ))
        .execute(&mut conn)
        .map_err(|e| AppError::Database(e.to_string()))?;
    }
    Ok(())
}
