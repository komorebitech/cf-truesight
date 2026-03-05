use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use serde::Deserialize;

use truesight_common::error::AppError;
use truesight_common::team::NewTeamMember;

use crate::db;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// POST /v1/invitations/accept
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AcceptInvitationRequest {
    pub token: String,
}

pub async fn accept_invitation(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<AcceptInvitationRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = auth
        .user_id
        .ok_or_else(|| AppError::Unauthorized("JWT required to accept invitations".to_string()))?;

    // Find invitation by token
    let invitation = db::invitations::find_invitation_by_token(&state.db_pool, &body.token)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Invitation not found".to_string()))?;

    // Check if already accepted
    if invitation.accepted {
        return Err(AppError::Validation(
            "Invitation has already been accepted".to_string(),
        ));
    }

    // Check expiration
    if invitation.expires_at < chrono::Utc::now() {
        return Err(AppError::Validation("Invitation has expired".to_string()));
    }

    // Add user as team member
    db::teams::add_member(
        &state.db_pool,
        NewTeamMember {
            team_id: invitation.team_id,
            user_id,
            role: invitation.role,
        },
    )
    .map_err(|e| match &e {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ) => AppError::Validation("You are already a member of this team".to_string()),
        _ => AppError::Database(e.to_string()),
    })?;

    // Mark invitation as accepted
    db::invitations::accept_invitation(&state.db_pool, invitation.id)
        .map_err(|e| AppError::Database(e.to_string()))?;

    // Return the team
    let team = db::teams::find_team(&state.db_pool, invitation.team_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Team not found".to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "team": team }))))
}
