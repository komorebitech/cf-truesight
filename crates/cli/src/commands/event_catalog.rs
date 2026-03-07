use anyhow::Result;

use crate::cli::{EventCatalogCommand, OutputFormat};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &EventCatalogCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    let base = format!("/v1/stats/projects/{project}");
    match command {
        EventCatalogCommand::List => {
            let resp = client.get(&format!("{base}/event-catalog")).await?;
            render(format, &resp);
        }
        EventCatalogCommand::Properties { event_name } => {
            let encoded = urlencoding(event_name);
            let resp = client
                .get(&format!("{base}/event-catalog/{encoded}/properties"))
                .await?;
            render(format, &resp);
        }
    }
    Ok(())
}

fn urlencoding(s: &str) -> String {
    s.replace(' ', "%20")
        .replace('#', "%23")
        .replace('&', "%26")
        .replace('?', "%3F")
}
