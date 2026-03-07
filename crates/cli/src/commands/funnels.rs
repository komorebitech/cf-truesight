use anyhow::Result;

use crate::cli::{FunnelsCommand, OutputFormat};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &FunnelsCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    let base = format!("/v1/projects/{project}/funnels");
    match command {
        FunnelsCommand::List => {
            let resp = client.get(&base).await?;
            render(format, &resp);
        }
        FunnelsCommand::Get { id } => {
            let resp = client.get(&format!("{base}/{id}")).await?;
            render(format, &resp);
        }
        FunnelsCommand::Create { body, body_file } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.post(&base, Some(body)).await?;
            render(format, &resp);
        }
        FunnelsCommand::Update {
            id,
            body,
            body_file,
        } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.patch(&format!("{base}/{id}"), body).await?;
            render(format, &resp);
        }
        FunnelsCommand::Delete { id } => {
            client.delete(&format!("{base}/{id}")).await?;
        }
        FunnelsCommand::Results { id, from, to } => {
            let mut url = format!("{base}/{id}/results?");
            if let Some(f) = from {
                url.push_str(&format!("from={f}&"));
            }
            if let Some(t) = to {
                url.push_str(&format!("to={t}&"));
            }
            let resp = client.get(url.trim_end_matches('&')).await?;
            render(format, &resp);
        }
        FunnelsCommand::Compare { ids, from, to } => {
            let mut url = format!("/v1/projects/{project}/funnels/compare?ids={ids}");
            if let Some(f) = from {
                url.push_str(&format!("&from={f}"));
            }
            if let Some(t) = to {
                url.push_str(&format!("&to={t}"));
            }
            let resp = client.get(&url).await?;
            render(format, &resp);
        }
        FunnelsCommand::CompareTime {
            id,
            from,
            to,
            compare_from,
            compare_to,
        } => {
            let url = format!(
                "{base}/{id}/compare?from={from}&to={to}&compare_from={compare_from}&compare_to={compare_to}"
            );
            let resp = client.get(&url).await?;
            render(format, &resp);
        }
    }
    Ok(())
}
