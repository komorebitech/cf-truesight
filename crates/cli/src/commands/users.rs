use anyhow::Result;

use crate::cli::{OutputFormat, UsersCommand};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &UsersCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    let base = format!("/v1/stats/projects/{project}");
    match command {
        UsersCommand::List {
            limit,
            offset,
            search,
        } => {
            let mut url = format!("{base}/users?");
            if let Some(l) = limit {
                url.push_str(&format!("limit={l}&"));
            }
            if let Some(o) = offset {
                url.push_str(&format!("offset={o}&"));
            }
            if let Some(s) = search {
                url.push_str(&format!("search={s}&"));
            }
            let resp = client.get(url.trim_end_matches('&')).await?;
            render(format, &resp);
        }
        UsersCommand::Get { id } => {
            let resp = client.get(&format!("{base}/users/{id}")).await?;
            render(format, &resp);
        }
        UsersCommand::Events { id, limit, offset } => {
            let mut url = format!("{base}/users/{id}/events?");
            if let Some(l) = limit {
                url.push_str(&format!("limit={l}&"));
            }
            if let Some(o) = offset {
                url.push_str(&format!("offset={o}&"));
            }
            let resp = client.get(url.trim_end_matches('&')).await?;
            render(format, &resp);
        }
    }
    Ok(())
}
