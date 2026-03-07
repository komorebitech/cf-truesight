use anyhow::Result;

use crate::cli::{OutputFormat, PropertiesCommand};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &PropertiesCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    let base = format!("/v1/stats/projects/{project}");
    match command {
        PropertiesCommand::Keys { event_name } => {
            let mut url = format!("{base}/property-keys");
            if let Some(en) = event_name {
                url.push_str(&format!("?event_name={en}"));
            }
            let resp = client.get(&url).await?;
            render(format, &resp);
        }
        PropertiesCommand::Values { key, event_name } => {
            let mut url = format!("{base}/property-values?key={key}");
            if let Some(en) = event_name {
                url.push_str(&format!("&event_name={en}"));
            }
            let resp = client.get(&url).await?;
            render(format, &resp);
        }
        PropertiesCommand::Insights { body, body_file } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.post(&format!("{base}/insights"), Some(body)).await?;
            render(format, &resp);
        }
    }
    Ok(())
}
