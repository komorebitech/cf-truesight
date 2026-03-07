use diesel::prelude::*;
use truesight_common::db::{DbPool, with_conn};
use truesight_common::schema::{allowed_domains, invitations};
use truesight_common::team::{AllowedDomain, Invitation, NewAllowedDomain, NewInvitation};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

/// List invitations for a team.
pub fn list_invitations(
    pool: &DbPool,
    team_id: Uuid,
) -> Result<Vec<Invitation>, diesel::result::Error> {
    with_conn(pool, |conn| {
        invitations::table
            .filter(invitations::team_id.eq(team_id))
            .order(invitations::created_at.desc())
            .load::<Invitation>(conn)
    })
}

/// Create an invitation.
pub fn create_invitation(
    pool: &DbPool,
    new: NewInvitation,
) -> Result<Invitation, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::insert_into(invitations::table)
            .values(&new)
            .get_result::<Invitation>(conn)
    })
}

/// Find an invitation by its token.
pub fn find_invitation_by_token(
    pool: &DbPool,
    token: &str,
) -> Result<Option<Invitation>, diesel::result::Error> {
    with_conn(pool, |conn| {
        invitations::table
            .filter(invitations::token.eq(token))
            .first::<Invitation>(conn)
            .optional()
    })
}

/// Mark an invitation as accepted.
pub fn accept_invitation(
    pool: &DbPool,
    invitation_id: Uuid,
) -> Result<bool, diesel::result::Error> {
    with_conn(pool, |conn| {
        let affected = diesel::update(invitations::table.find(invitation_id))
            .set(invitations::accepted.eq(true))
            .execute(conn)?;

        Ok(affected > 0)
    })
}

/// Delete an invitation.
pub fn delete_invitation(
    pool: &DbPool,
    invitation_id: Uuid,
) -> Result<bool, diesel::result::Error> {
    with_conn(pool, |conn| {
        let affected = diesel::delete(invitations::table.find(invitation_id)).execute(conn)?;
        Ok(affected > 0)
    })
}

// ---------------------------------------------------------------------------
// Allowed Domains
// ---------------------------------------------------------------------------

/// List allowed domains for a team.
pub fn list_allowed_domains(
    pool: &DbPool,
    team_id: Uuid,
) -> Result<Vec<AllowedDomain>, diesel::result::Error> {
    with_conn(pool, |conn| {
        allowed_domains::table
            .filter(allowed_domains::team_id.eq(team_id))
            .order(allowed_domains::created_at.desc())
            .load::<AllowedDomain>(conn)
    })
}

/// Add an allowed domain to a team.
pub fn add_allowed_domain(
    pool: &DbPool,
    new: NewAllowedDomain,
) -> Result<AllowedDomain, diesel::result::Error> {
    with_conn(pool, |conn| {
        diesel::insert_into(allowed_domains::table)
            .values(&new)
            .get_result::<AllowedDomain>(conn)
    })
}

/// Remove an allowed domain.
pub fn remove_allowed_domain(
    pool: &DbPool,
    domain_id: Uuid,
) -> Result<bool, diesel::result::Error> {
    with_conn(pool, |conn| {
        let affected = diesel::delete(allowed_domains::table.find(domain_id)).execute(conn)?;
        Ok(affected > 0)
    })
}

/// Find all allowed domains matching a given email domain (for auto-join).
pub fn find_matching_domains(
    pool: &DbPool,
    email_domain: &str,
) -> Result<Vec<AllowedDomain>, diesel::result::Error> {
    with_conn(pool, |conn| {
        allowed_domains::table
            .filter(allowed_domains::domain.eq(email_domain))
            .load::<AllowedDomain>(conn)
    })
}
