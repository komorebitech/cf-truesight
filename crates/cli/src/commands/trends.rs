use anyhow::Result;

use crate::cli::{OutputFormat, TrendsCommand};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &TrendsCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    match command {
        TrendsCommand::Query { body, body_file } => {
            let body = super::read_body(body, body_file)?;
            let resp = client
                .post(&format!("/v1/stats/projects/{project}/trends"), Some(body))
                .await?;
            render(format, &resp);
        }
    }
    Ok(())
}
