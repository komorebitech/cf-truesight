use anyhow::Result;

use crate::cli::{OutputFormat, SegmentsCommand};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &SegmentsCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    let base = format!("/v1/projects/{project}/segments");
    match command {
        SegmentsCommand::List => {
            let resp = client.get(&base).await?;
            render(format, &resp);
        }
        SegmentsCommand::Get { id } => {
            let resp = client.get(&format!("{base}/{id}")).await?;
            render(format, &resp);
        }
        SegmentsCommand::Create { body, body_file } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.post(&base, Some(body)).await?;
            render(format, &resp);
        }
        SegmentsCommand::Update {
            id,
            body,
            body_file,
        } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.patch(&format!("{base}/{id}"), body).await?;
            render(format, &resp);
        }
        SegmentsCommand::Delete { id } => {
            client.delete(&format!("{base}/{id}")).await?;
        }
        SegmentsCommand::Size { id } => {
            let resp = client.get(&format!("{base}/{id}/size")).await?;
            render(format, &resp);
        }
        SegmentsCommand::Users { id, limit, offset } => {
            let mut url = format!("{base}/{id}/users?");
            if let Some(l) = limit {
                url.push_str(&format!("limit={l}&"));
            }
            if let Some(o) = offset {
                url.push_str(&format!("offset={o}&"));
            }
            let resp = client.get(url.trim_end_matches('&')).await?;
            render(format, &resp);
        }
        SegmentsCommand::Preview { body, body_file } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.post(&format!("{base}/preview"), Some(body)).await?;
            render(format, &resp);
        }
    }
    Ok(())
}
