use anyhow::Result;

use crate::cli::{BoardWidgetsCommand, BoardsCommand, OutputFormat};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &BoardsCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    let base = format!("/v1/projects/{project}/boards");
    match command {
        BoardsCommand::List => {
            let resp = client.get(&base).await?;
            render(format, &resp);
        }
        BoardsCommand::Get { id } => {
            let resp = client.get(&format!("{base}/{id}")).await?;
            render(format, &resp);
        }
        BoardsCommand::Create { body, body_file } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.post(&base, Some(body)).await?;
            render(format, &resp);
        }
        BoardsCommand::Update {
            id,
            body,
            body_file,
        } => {
            let body = super::read_body(body, body_file)?;
            let resp = client.patch(&format!("{base}/{id}"), body).await?;
            render(format, &resp);
        }
        BoardsCommand::Delete { id } => {
            client.delete(&format!("{base}/{id}")).await?;
        }
        BoardsCommand::Widgets { command } => {
            run_widgets(command, client, &base, format).await?;
        }
        BoardsCommand::Layouts {
            board_id,
            body,
            body_file,
        } => {
            let body = super::read_body(body, body_file)?;
            let resp = client
                .patch(&format!("{base}/{board_id}/layouts"), body)
                .await?;
            render(format, &resp);
        }
    }
    Ok(())
}

async fn run_widgets(
    command: &BoardWidgetsCommand,
    client: &TrueSightClient,
    base: &str,
    format: OutputFormat,
) -> Result<()> {
    match command {
        BoardWidgetsCommand::Create {
            board_id,
            body,
            body_file,
        } => {
            let body = super::read_body(body, body_file)?;
            let resp = client
                .post(&format!("{base}/{board_id}/widgets"), Some(body))
                .await?;
            render(format, &resp);
        }
        BoardWidgetsCommand::Update {
            board_id,
            widget_id,
            body,
            body_file,
        } => {
            let body = super::read_body(body, body_file)?;
            let resp = client
                .patch(&format!("{base}/{board_id}/widgets/{widget_id}"), body)
                .await?;
            render(format, &resp);
        }
        BoardWidgetsCommand::Delete {
            board_id,
            widget_id,
        } => {
            client
                .delete(&format!("{base}/{board_id}/widgets/{widget_id}"))
                .await?;
        }
    }
    Ok(())
}
