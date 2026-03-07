use anyhow::Result;

use crate::cli::{CohortsCommand, OutputFormat};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &CohortsCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    let base = format!("/v1/projects/{project}/cohorts");
    match command {
        CohortsCommand::List => {
            let resp = client.get(&base).await?;
            render(format, &resp);
        }
        CohortsCommand::Get { id } => {
            let resp = client.get(&format!("{base}/{id}")).await?;
            render(format, &resp);
        }
        CohortsCommand::Create { body, body_file } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.post(&base, Some(body)).await?;
            render(format, &resp);
        }
        CohortsCommand::Update {
            id,
            body,
            body_file,
        } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.patch(&format!("{base}/{id}"), body).await?;
            render(format, &resp);
        }
        CohortsCommand::Delete { id } => {
            client.delete(&format!("{base}/{id}")).await?;
        }
        CohortsCommand::Size { id } => {
            let resp = client.get(&format!("{base}/{id}/size")).await?;
            render(format, &resp);
        }
        CohortsCommand::Users { id, page, per_page } => {
            let mut url = format!("{base}/{id}/users?");
            if let Some(p) = page {
                url.push_str(&format!("page={p}&"));
            }
            if let Some(pp) = per_page {
                url.push_str(&format!("per_page={pp}&"));
            }
            let resp = client.get(url.trim_end_matches('&')).await?;
            render(format, &resp);
        }
    }
    Ok(())
}
