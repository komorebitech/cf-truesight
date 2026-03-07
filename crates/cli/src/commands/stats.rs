use anyhow::Result;

use crate::cli::{OutputFormat, StatsCommand};
use crate::client::TrueSightClient;
use crate::output::render;

pub async fn run(
    command: &StatsCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    let base = format!("/v1/stats/projects/{project}");
    match command {
        StatsCommand::EventCount { from, to } => {
            let resp = client
                .get(&format!("{base}/event-count?from={from}&to={to}"))
                .await?;
            render(format, &resp);
        }
        StatsCommand::Throughput {
            from,
            to,
            granularity,
        } => {
            let resp = client
                .get(&format!(
                    "{base}/throughput?from={from}&to={to}&granularity={granularity}"
                ))
                .await?;
            render(format, &resp);
        }
        StatsCommand::EventTypes { from, to } => {
            let resp = client
                .get(&format!("{base}/event-types?from={from}&to={to}"))
                .await?;
            render(format, &resp);
        }
        StatsCommand::EventNames { from, to, limit } => {
            let mut url = format!("{base}/event-names?from={from}&to={to}");
            if let Some(l) = limit {
                url.push_str(&format!("&limit={l}"));
            }
            let resp = client.get(&url).await?;
            render(format, &resp);
        }
        StatsCommand::Events {
            from,
            to,
            limit,
            offset,
            event_type,
            event_name,
        } => {
            let mut url = format!("{base}/events?from={from}&to={to}");
            if let Some(l) = limit {
                url.push_str(&format!("&limit={l}"));
            }
            if let Some(o) = offset {
                url.push_str(&format!("&offset={o}"));
            }
            if let Some(et) = event_type {
                url.push_str(&format!("&event_type={et}"));
            }
            if let Some(en) = event_name {
                url.push_str(&format!("&event_name={en}"));
            }
            let resp = client.get(&url).await?;
            render(format, &resp);
        }
        StatsCommand::ActiveUsers { from, to } => {
            let resp = client
                .get(&format!("{base}/active-users?from={from}&to={to}"))
                .await?;
            render(format, &resp);
        }
        StatsCommand::LiveUsers => {
            let resp = client.get(&format!("{base}/live-users")).await?;
            render(format, &resp);
        }
        StatsCommand::PlatformDistribution { from, to } => {
            let resp = client
                .get(&format!("{base}/platform-distribution?from={from}&to={to}"))
                .await?;
            render(format, &resp);
        }
    }
    Ok(())
}
