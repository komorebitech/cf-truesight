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
        ProjectsCommand::List {
            sort_by,
            sort_order,
            page,
            per_page,
        } => {
            let mut url = "/v1/projects?".to_string();
            if let Some(sb) = sort_by {
                url.push_str(&format!("sort_by={sb}&"));
            }
            url.push_str(&format!("sort_order={sort_order}&"));
            if let Some(p) = page {
                url.push_str(&format!("page={p}&"));
            }
            if let Some(pp) = per_page {
                url.push_str(&format!("per_page={pp}&"));
            }
            let resp = client.get(url.trim_end_matches('&')).await?;
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
