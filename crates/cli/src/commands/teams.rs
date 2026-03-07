use anyhow::Result;
use serde_json::json;

use crate::cli::{
    OutputFormat, TeamDomainsCommand, TeamInvitationsCommand, TeamMembersCommand,
    TeamProjectsCommand, TeamsCommand,
};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &TeamsCommand,
    client: &TrueSightClient,
    format: OutputFormat,
) -> Result<()> {
    match command {
        TeamsCommand::List => {
            let resp = client.get("/v1/teams").await?;
            render(format, &resp);
        }
        TeamsCommand::Get { id } => {
            let resp = client.get(&format!("/v1/teams/{id}")).await?;
            render(format, &resp);
        }
        TeamsCommand::Create { name } => {
            let resp = client
                .post("/v1/teams", Some(json!({ "name": name })))
                .await?;
            render(format, &resp);
        }
        TeamsCommand::Update { id, name } => {
            let mut body = serde_json::Map::new();
            if let Some(n) = name {
                body.insert("name".into(), json!(n));
            }
            let resp = client
                .patch(&format!("/v1/teams/{id}"), json!(body))
                .await?;
            render(format, &resp);
        }
        TeamsCommand::Delete { id } => {
            client.delete(&format!("/v1/teams/{id}")).await?;
        }
        TeamsCommand::Members { command } => run_members(command, client, format).await?,
        TeamsCommand::Projects { command } => run_projects(command, client, format).await?,
        TeamsCommand::Invitations { command } => run_invitations(command, client, format).await?,
        TeamsCommand::Domains { command } => run_domains(command, client, format).await?,
    }
    Ok(())
}

async fn run_members(
    command: &TeamMembersCommand,
    client: &TrueSightClient,
    format: OutputFormat,
) -> Result<()> {
    match command {
        TeamMembersCommand::List { team_id } => {
            let resp = client.get(&format!("/v1/teams/{team_id}/members")).await?;
            render(format, &resp);
        }
        TeamMembersCommand::Update {
            team_id,
            user_id,
            role,
        } => {
            let resp = client
                .patch(
                    &format!("/v1/teams/{team_id}/members/{user_id}"),
                    json!({ "role": role }),
                )
                .await?;
            render(format, &resp);
        }
        TeamMembersCommand::Remove { team_id, user_id } => {
            client
                .delete(&format!("/v1/teams/{team_id}/members/{user_id}"))
                .await?;
        }
    }
    Ok(())
}

async fn run_projects(
    command: &TeamProjectsCommand,
    client: &TrueSightClient,
    format: OutputFormat,
) -> Result<()> {
    match command {
        TeamProjectsCommand::List { team_id } => {
            let resp = client.get(&format!("/v1/teams/{team_id}/projects")).await?;
            render(format, &resp);
        }
        TeamProjectsCommand::Link {
            team_id,
            project_id,
        } => {
            let resp = client
                .post(
                    &format!("/v1/teams/{team_id}/projects"),
                    Some(json!({ "project_id": project_id })),
                )
                .await?;
            render(format, &resp);
        }
        TeamProjectsCommand::Unlink {
            team_id,
            project_id,
        } => {
            client
                .delete(&format!("/v1/teams/{team_id}/projects/{project_id}"))
                .await?;
        }
    }
    Ok(())
}

async fn run_invitations(
    command: &TeamInvitationsCommand,
    client: &TrueSightClient,
    format: OutputFormat,
) -> Result<()> {
    match command {
        TeamInvitationsCommand::List { team_id } => {
            let resp = client
                .get(&format!("/v1/teams/{team_id}/invitations"))
                .await?;
            render(format, &resp);
        }
        TeamInvitationsCommand::Create {
            team_id,
            email,
            role,
        } => {
            let resp = client
                .post(
                    &format!("/v1/teams/{team_id}/invitations"),
                    Some(json!({ "email": email, "role": role })),
                )
                .await?;
            render(format, &resp);
        }
        TeamInvitationsCommand::Delete {
            team_id,
            invitation_id,
        } => {
            client
                .delete(&format!("/v1/teams/{team_id}/invitations/{invitation_id}"))
                .await?;
        }
    }
    Ok(())
}

async fn run_domains(
    command: &TeamDomainsCommand,
    client: &TrueSightClient,
    format: OutputFormat,
) -> Result<()> {
    match command {
        TeamDomainsCommand::List { team_id } => {
            let resp = client
                .get(&format!("/v1/teams/{team_id}/allowed-domains"))
                .await?;
            render(format, &resp);
        }
        TeamDomainsCommand::Add { team_id, domain } => {
            let resp = client
                .post(
                    &format!("/v1/teams/{team_id}/allowed-domains"),
                    Some(json!({ "domain": domain })),
                )
                .await?;
            render(format, &resp);
        }
        TeamDomainsCommand::Remove { team_id, domain_id } => {
            client
                .delete(&format!("/v1/teams/{team_id}/allowed-domains/{domain_id}"))
                .await?;
        }
    }
    Ok(())
}
