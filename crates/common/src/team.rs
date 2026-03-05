use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel_derive_enum::DbEnum;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::schema::{allowed_domains, invitations, team_members, team_projects, teams};

// ---------------------------------------------------------------------------
// TeamRole enum
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, DbEnum)]
#[ExistingTypePath = "crate::schema::sql_types::TeamRole"]
#[serde(rename_all = "lowercase")]
pub enum TeamRole {
    #[db_rename = "admin"]
    Admin,
    #[db_rename = "editor"]
    Editor,
    #[db_rename = "viewer"]
    Viewer,
}

impl TeamRole {
    /// Returns true if this role has at least the permissions of `required`.
    /// admin > editor > viewer
    pub fn has_at_least(&self, required: TeamRole) -> bool {
        self.level() >= required.level()
    }

    fn level(&self) -> u8 {
        match self {
            TeamRole::Admin => 3,
            TeamRole::Editor => 2,
            TeamRole::Viewer => 1,
        }
    }
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = teams)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Team {
    pub id: Uuid,
    pub name: String,
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = teams)]
pub struct NewTeam {
    pub name: String,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = teams)]
pub struct UpdateTeam {
    pub name: Option<String>,
    pub active: Option<bool>,
    pub updated_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// TeamMember
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = team_members)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct TeamMember {
    pub id: Uuid,
    pub team_id: Uuid,
    pub user_id: Uuid,
    pub role: TeamRole,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = team_members)]
pub struct NewTeamMember {
    pub team_id: Uuid,
    pub user_id: Uuid,
    pub role: TeamRole,
}

// ---------------------------------------------------------------------------
// TeamProject
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = team_projects)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct TeamProject {
    pub id: Uuid,
    pub team_id: Uuid,
    pub project_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = team_projects)]
pub struct NewTeamProject {
    pub team_id: Uuid,
    pub project_id: Uuid,
}

// ---------------------------------------------------------------------------
// Invitation
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = invitations)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Invitation {
    pub id: Uuid,
    pub team_id: Uuid,
    pub email: String,
    pub role: TeamRole,
    pub invited_by: Uuid,
    pub token: String,
    pub accepted: bool,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = invitations)]
pub struct NewInvitation {
    pub team_id: Uuid,
    pub email: String,
    pub role: TeamRole,
    pub invited_by: Uuid,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// AllowedDomain
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = allowed_domains)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct AllowedDomain {
    pub id: Uuid,
    pub team_id: Uuid,
    pub domain: String,
    pub default_role: TeamRole,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = allowed_domains)]
pub struct NewAllowedDomain {
    pub team_id: Uuid,
    pub domain: String,
    pub default_role: TeamRole,
}
