use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use truesight_common::error::AppError;
use truesight_common::team::{
    NewAllowedDomain, NewTeam, NewTeamMember, NewTeamProject, TeamRole, UpdateTeam,
};

use crate::db;
use crate::middleware::admin_auth::AuthUser;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn require_team_role(
    state: &AppState,
    auth: &AuthUser,
    team_id: Uuid,
    min_role: TeamRole,
) -> Result<(), AppError> {
    if auth.is_static_token {
        return Ok(());
    }
    let user_id = auth
        .user_id
        .ok_or_else(|| AppError::Unauthorized("No user identity".to_string()))?;

    let role = db::teams::get_user_role_in_team(&state.db_pool, user_id, team_id)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::Forbidden("Not a member of this team".to_string()))?;

    if !role.has_at_least(min_role) {
        return Err(AppError::Forbidden(format!(
            "Requires {:?} role or higher",
            min_role
        )));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct TeamMemberResponse {
    pub id: String,
    pub team_id: String,
    pub user_id: String,
    pub role: TeamRole,
    pub created_at: String,
    pub user: UserBrief,
}

#[derive(Debug, Serialize)]
pub struct UserBrief {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TeamProjectResponse {
    pub id: String,
    pub team_id: String,
    pub project_id: String,
    pub created_at: String,
    pub project: ProjectBrief,
}

#[derive(Debug, Serialize)]
pub struct ProjectBrief {
    pub id: String,
    pub name: String,
    pub active: bool,
}

// ---------------------------------------------------------------------------
// GET /v1/teams
// ---------------------------------------------------------------------------

pub async fn list_teams(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let teams = if auth.is_static_token {
        db::teams::list_all_teams(&state.db_pool)
    } else {
        let user_id = auth
            .user_id
            .ok_or_else(|| AppError::Unauthorized("No user identity".to_string()))?;
        db::teams::list_teams_for_user(&state.db_pool, user_id)
    }
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(Json(teams))
}

// ---------------------------------------------------------------------------
// POST /v1/teams
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateTeamRequest {
    pub name: String,
}

pub async fn create_team(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateTeamRequest>,
) -> Result<impl IntoResponse, AppError> {
    let team = db::teams::insert_team(&state.db_pool, NewTeam { name: body.name }).map_err(
        |e| match &e {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            ) => AppError::Validation("A team with this name already exists".to_string()),
            _ => AppError::Database(e.to_string()),
        },
    )?;

    // Auto-add creator as admin (if JWT user)
    if let Some(user_id) = auth.user_id {
        let _ = db::teams::add_member(
            &state.db_pool,
            NewTeamMember {
                team_id: team.id,
                user_id,
                role: TeamRole::Admin,
            },
        );
    }

    Ok((StatusCode::CREATED, Json(team)))
}

// ---------------------------------------------------------------------------
// GET /v1/teams/{tid}
// ---------------------------------------------------------------------------

pub async fn get_team(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Viewer)?;

    let team = db::teams::find_team(&state.db_pool, tid)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Team not found".to_string()))?;

    Ok(Json(team))
}

// ---------------------------------------------------------------------------
// PATCH /v1/teams/{tid}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct UpdateTeamRequest {
    pub name: Option<String>,
    pub active: Option<bool>,
}

pub async fn update_team(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
    Json(body): Json<UpdateTeamRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let team = db::teams::update_team(
        &state.db_pool,
        tid,
        UpdateTeam {
            name: body.name,
            active: body.active,
            updated_at: Some(chrono::Utc::now()),
        },
    )
    .map_err(|e| match &e {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ) => AppError::Validation("A team with this name already exists".to_string()),
        _ => AppError::Database(e.to_string()),
    })?
    .ok_or_else(|| AppError::NotFound("Team not found".to_string()))?;

    Ok(Json(team))
}

// ---------------------------------------------------------------------------
// DELETE /v1/teams/{tid}
// ---------------------------------------------------------------------------

pub async fn delete_team(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let deleted = db::teams::delete_team(&state.db_pool, tid)
        .map_err(|e| AppError::Database(e.to_string()))?;

    if !deleted {
        return Err(AppError::NotFound("Team not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /v1/teams/{tid}/members
// ---------------------------------------------------------------------------

pub async fn list_members(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Viewer)?;

    let members = db::teams::list_members(&state.db_pool, tid)
        .map_err(|e| AppError::Database(e.to_string()))?;

    let response: Vec<TeamMemberResponse> = members
        .into_iter()
        .map(|(m, u)| TeamMemberResponse {
            id: m.id.to_string(),
            team_id: m.team_id.to_string(),
            user_id: m.user_id.to_string(),
            role: m.role,
            created_at: m.created_at.to_rfc3339(),
            user: UserBrief {
                id: u.id.to_string(),
                email: u.email,
                name: u.name,
                picture_url: u.picture_url,
            },
        })
        .collect();

    Ok(Json(response))
}

// ---------------------------------------------------------------------------
// PATCH /v1/teams/{tid}/members/{uid}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct UpdateMemberRequest {
    pub role: TeamRole,
}

pub async fn update_member(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((tid, uid)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateMemberRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let member = db::teams::update_member_role(&state.db_pool, tid, uid, body.role)
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Member not found".to_string()))?;

    Ok(Json(member))
}

// ---------------------------------------------------------------------------
// DELETE /v1/teams/{tid}/members/{uid}
// ---------------------------------------------------------------------------

pub async fn remove_member(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((tid, uid)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let removed = db::teams::remove_member(&state.db_pool, tid, uid)
        .map_err(|e| AppError::Database(e.to_string()))?;

    if !removed {
        return Err(AppError::NotFound("Member not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /v1/teams/{tid}/projects
// ---------------------------------------------------------------------------

pub async fn list_team_projects(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Viewer)?;

    let projects = db::teams::list_team_projects(&state.db_pool, tid)
        .map_err(|e| AppError::Database(e.to_string()))?;

    let response: Vec<TeamProjectResponse> = projects
        .into_iter()
        .map(|(tp, p)| TeamProjectResponse {
            id: tp.id.to_string(),
            team_id: tp.team_id.to_string(),
            project_id: tp.project_id.to_string(),
            created_at: tp.created_at.to_rfc3339(),
            project: ProjectBrief {
                id: p.id.to_string(),
                name: p.name,
                active: p.active,
            },
        })
        .collect();

    Ok(Json(response))
}

// ---------------------------------------------------------------------------
// POST /v1/teams/{tid}/projects
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct LinkProjectRequest {
    pub project_id: Uuid,
}

pub async fn link_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
    Json(body): Json<LinkProjectRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Editor)?;

    let tp = db::teams::link_project(
        &state.db_pool,
        NewTeamProject {
            team_id: tid,
            project_id: body.project_id,
        },
    )
    .map_err(|e| match &e {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ) => AppError::Validation("Project already linked to this team".to_string()),
        _ => AppError::Database(e.to_string()),
    })?;

    Ok((StatusCode::CREATED, Json(tp)))
}

// ---------------------------------------------------------------------------
// DELETE /v1/teams/{tid}/projects/{pid}
// ---------------------------------------------------------------------------

pub async fn unlink_project(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((tid, pid)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let unlinked = db::teams::unlink_project(&state.db_pool, tid, pid)
        .map_err(|e| AppError::Database(e.to_string()))?;

    if !unlinked {
        return Err(AppError::NotFound("Project link not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /v1/teams/{tid}/invitations
// ---------------------------------------------------------------------------

pub async fn list_invitations(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let invitations = db::invitations::list_invitations(&state.db_pool, tid)
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(Json(invitations))
}

// ---------------------------------------------------------------------------
// POST /v1/teams/{tid}/invitations
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateInvitationRequest {
    pub email: String,
    pub role: TeamRole,
}

pub async fn create_invitation(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
    Json(body): Json<CreateInvitationRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let invited_by = auth
        .user_id
        .ok_or_else(|| AppError::Unauthorized("No user identity".to_string()))?;

    // Generate random token
    use rand::Rng;
    let token: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();

    let expires_at = chrono::Utc::now() + chrono::Duration::days(7);

    let invitation = db::invitations::create_invitation(
        &state.db_pool,
        truesight_common::team::NewInvitation {
            team_id: tid,
            email: body.email,
            role: body.role,
            invited_by,
            token,
            expires_at,
        },
    )
    .map_err(|e| match &e {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ) => AppError::Validation(
            "An invitation for this email already exists in this team".to_string(),
        ),
        _ => AppError::Database(e.to_string()),
    })?;

    Ok((StatusCode::CREATED, Json(invitation)))
}

// ---------------------------------------------------------------------------
// DELETE /v1/teams/{tid}/invitations/{iid}
// ---------------------------------------------------------------------------

pub async fn delete_invitation(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((tid, iid)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let deleted = db::invitations::delete_invitation(&state.db_pool, iid)
        .map_err(|e| AppError::Database(e.to_string()))?;

    if !deleted {
        return Err(AppError::NotFound("Invitation not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /v1/teams/{tid}/allowed-domains
// ---------------------------------------------------------------------------

pub async fn list_allowed_domains(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let domains = db::invitations::list_allowed_domains(&state.db_pool, tid)
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(Json(domains))
}

// ---------------------------------------------------------------------------
// POST /v1/teams/{tid}/allowed-domains
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AddAllowedDomainRequest {
    pub domain: String,
    pub default_role: TeamRole,
}

pub async fn add_allowed_domain(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(tid): Path<Uuid>,
    Json(body): Json<AddAllowedDomainRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let domain = db::invitations::add_allowed_domain(
        &state.db_pool,
        NewAllowedDomain {
            team_id: tid,
            domain: body.domain,
            default_role: body.default_role,
        },
    )
    .map_err(|e| match &e {
        diesel::result::Error::DatabaseError(
            diesel::result::DatabaseErrorKind::UniqueViolation,
            _,
        ) => AppError::Validation("This domain is already allowed for this team".to_string()),
        _ => AppError::Database(e.to_string()),
    })?;

    Ok((StatusCode::CREATED, Json(domain)))
}

// ---------------------------------------------------------------------------
// DELETE /v1/teams/{tid}/allowed-domains/{did}
// ---------------------------------------------------------------------------

pub async fn remove_allowed_domain(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((tid, did)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, AppError> {
    require_team_role(&state, &auth, tid, TeamRole::Admin)?;

    let removed = db::invitations::remove_allowed_domain(&state.db_pool, did)
        .map_err(|e| AppError::Database(e.to_string()))?;

    if !removed {
        return Err(AppError::NotFound("Allowed domain not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
