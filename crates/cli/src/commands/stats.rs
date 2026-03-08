use anyhow::Result;

use crate::cli::{OutputFormat, StatsCommand};
use crate::client::TrueSightClient;
use crate::output::render;

/// Normalize a date string for the API.
/// Accepts DD-MM-YYYY, YYYY-MM-DD, or full ISO datetime.
/// Appends T00:00:00Z for `from` or T23:59:59Z for `to`.
fn normalize_dt(s: &str, is_end: bool) -> String {
    if s.contains('T') || s.contains(' ') {
        return s.to_string();
    }
    // Convert DD-MM-YYYY to YYYY-MM-DD
    let iso_date = if s.len() == 10 && s.chars().nth(2) == Some('-') && s.chars().nth(5) == Some('-')
    {
        let parts: Vec<&str> = s.split('-').collect();
        if parts.len() == 3 {
            format!("{}-{}-{}", parts[2], parts[1], parts[0])
        } else {
            s.to_string()
        }
    } else {
        s.to_string()
    };
    if is_end {
        format!("{iso_date}T23:59:59Z")
    } else {
        format!("{iso_date}T00:00:00Z")
    }
}

pub async fn run(
    command: &StatsCommand,
    client: &TrueSightClient,
    project: &str,
    format: OutputFormat,
) -> Result<()> {
    let base = format!("/v1/stats/projects/{project}");
    match command {
        StatsCommand::EventCount { from, to } => {
            let (f, t) = (normalize_dt(from, false), normalize_dt(to, true));
            let resp = client
                .get(&format!("{base}/event-count?from={f}&to={t}"))
                .await?;
            render(format, &resp);
        }
        StatsCommand::Throughput {
            from,
            to,
            granularity,
        } => {
            let (f, t) = (normalize_dt(from, false), normalize_dt(to, true));
            let resp = client
                .get(&format!(
                    "{base}/throughput?from={f}&to={t}&granularity={granularity}"
                ))
                .await?;
            render(format, &resp);
        }
        StatsCommand::EventTypes { from, to } => {
            let (f, t) = (normalize_dt(from, false), normalize_dt(to, true));
            let resp = client
                .get(&format!("{base}/event-types?from={f}&to={t}"))
                .await?;
            render(format, &resp);
        }
        StatsCommand::EventNames { from, to, limit } => {
            let (f, t) = (normalize_dt(from, false), normalize_dt(to, true));
            let mut url = format!("{base}/event-names?from={f}&to={t}");
            if let Some(l) = limit {
                url.push_str(&format!("&limit={l}"));
            }
            let resp = client.get(&url).await?;
            render(format, &resp);
        }
        StatsCommand::Events {
            from,
            to,
            page,
            per_page,
            event_type,
            event_name,
            sort_by,
            sort_order,
        } => {
            let (f, t) = (normalize_dt(from, false), normalize_dt(to, true));
            let mut url = format!("{base}/events?from={f}&to={t}");
            if let Some(p) = page {
                url.push_str(&format!("&page={p}"));
            }
            if let Some(pp) = per_page {
                url.push_str(&format!("&per_page={pp}"));
            }
            if let Some(et) = event_type {
                url.push_str(&format!("&event_type={et}"));
            }
            if let Some(en) = event_name {
                url.push_str(&format!("&event_name={en}"));
            }
            if let Some(sb) = sort_by {
                url.push_str(&format!("&sort_by={sb}"));
            }
            url.push_str(&format!("&sort_order={sort_order}"));
            let resp = client.get(&url).await?;
            render(format, &resp);
        }
        StatsCommand::ActiveUsers { from, to } => {
            let (f, t) = (normalize_dt(from, false), normalize_dt(to, true));
            let resp = client
                .get(&format!("{base}/active-users?from={f}&to={t}"))
                .await?;
            render(format, &resp);
        }
        StatsCommand::LiveUsers => {
            let resp = client.get(&format!("{base}/live-users")).await?;
            render(format, &resp);
        }
        StatsCommand::PlatformDistribution { from, to } => {
            let (f, t) = (normalize_dt(from, false), normalize_dt(to, true));
            let resp = client
                .get(&format!("{base}/platform-distribution?from={f}&to={t}"))
                .await?;
            render(format, &resp);
        }
    }
    Ok(())
}
