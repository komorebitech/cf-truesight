use anyhow::Result;
use serde_json::json;

use crate::cli::{OutputFormat, ProjectsCommand};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &ProjectsCommand,
    client: &TrueSightClient,
    format: OutputFormat,
) -> Result<()> {
    match command {
        ProjectsCommand::List => {
            let resp = client.get("/v1/projects").await?;
            render(format, &resp);
        }
        ProjectsCommand::Get { id } => {
            let resp = client.get(&format!("/v1/projects/{id}")).await?;
            render(format, &resp);
        }
        ProjectsCommand::Create { name } => {
            let resp = client
                .post("/v1/projects", Some(json!({ "name": name })))
                .await?;
            render(format, &resp);
        }
        ProjectsCommand::Update { id, name, active } => {
            let mut body = serde_json::Map::new();
            if let Some(n) = name {
                body.insert("name".into(), json!(n));
            }
            if let Some(a) = active {
                body.insert("active".into(), json!(a));
            }
            let resp = client
                .patch(&format!("/v1/projects/{id}"), json!(body))
                .await?;
            render(format, &resp);
        }
        ProjectsCommand::Delete { id } => {
            client.delete(&format!("/v1/projects/{id}")).await?;
        }
    }
    Ok(())
}
