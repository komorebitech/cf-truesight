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
        EventCatalogCommand::List {
            sort_by,
            sort_order,
            page,
            per_page,
        } => {
            let mut url = format!("{base}/event-catalog?");
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
