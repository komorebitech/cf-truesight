use truesight_common::error::AppError;
use truesight_common::team::TeamRole;
use uuid::Uuid;

use crate::db;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

/// Check that the authenticated user has at least `min_role` for the given project.
/// Static token users bypass all checks.
pub fn require_project_role(
    state: &AppState,
    auth: &AuthUser,
    project_id: Uuid,
    min_role: TeamRole,
) -> Result<(), AppError> {
    if auth.is_static_token {
        return Ok(());
    }

    let user_id = auth
        .user_id
        .ok_or_else(|| AppError::Unauthorized("No user identity".to_string()))?;

    let role = db::teams::get_user_role_for_project(&state.db_pool, user_id, project_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::Forbidden("You do not have access to this project".to_string()))?;

    if !role.has_at_least(min_role) {
        return Err(AppError::Forbidden(format!(
            "Requires {:?} role or higher",
            min_role
        )));
    }

    Ok(())
}

/// Get the list of project IDs a user has access to. Static token returns None (meaning all).
pub fn accessible_project_ids(
    state: &AppState,
    auth: &AuthUser,
) -> Result<Option<Vec<Uuid>>, AppError> {
    if auth.is_static_token {
        return Ok(None); // all projects
    }

    let user_id = auth
        .user_id
        .ok_or_else(|| AppError::Unauthorized("No user identity".to_string()))?;

    let ids = db::teams::list_project_ids_for_user(&state.db_pool, user_id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(Some(ids))
}
