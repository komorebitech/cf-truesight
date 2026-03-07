use anyhow::Result;

use crate::cli::{OutputFormat, RetentionCommand};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &RetentionCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    match command {
        RetentionCommand::Query { body, body_file } => {
            let body = super::read_body(body, body_file)?;
            let resp = client
                .post(
                    &format!("/v1/stats/projects/{project}/retention"),
                    Some(body),
                )
                .await?;
            render(format, &resp);
        }
    }
    Ok(())
}
