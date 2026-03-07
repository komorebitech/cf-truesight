use anyhow::Result;

use crate::cli::{FlowsCommand, OutputFormat};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &FlowsCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    match command {
        FlowsCommand::Query { body, body_file } => {
            let body = super::read_body(body, body_file)?;
            let resp = client
                .post(&format!("/v1/stats/projects/{project}/flows"), Some(body))
                .await?;
            render(format, &resp);
        }
    }
    Ok(())
}
