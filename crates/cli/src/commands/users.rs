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
            page,
            per_page,
            search,
        } => {
            let mut url = format!("{base}/users?");
            if let Some(p) = page {
                url.push_str(&format!("page={p}&"));
            }
            if let Some(pp) = per_page {
                url.push_str(&format!("per_page={pp}&"));
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
        UsersCommand::Events { id, page, per_page } => {
            let mut url = format!("{base}/users/{id}/events?");
            if let Some(p) = page {
                url.push_str(&format!("page={p}&"));
            }
            if let Some(pp) = per_page {
                url.push_str(&format!("per_page={pp}&"));
            }
            let resp = client.get(url.trim_end_matches('&')).await?;
            render(format, &resp);
        }
    }
    Ok(())
}
