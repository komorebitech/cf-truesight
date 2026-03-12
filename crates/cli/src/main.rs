mod auth;
mod cli;
mod client;
mod commands;
mod config;
mod output;

use anyhow::{Result, bail};
use clap::Parser;

use cli::{Cli, Command};
use client::TrueSightClient;
use config::{load_config, load_credentials};

fn resolve_token(cli: &Cli) -> Result<String> {
    if let Some(t) = &cli.token {
        return Ok(t.clone());
    }
    let creds = load_credentials();
    if let Some(t) = creds.token {
        return Ok(t);
    }
    bail!("Not authenticated. Run `truesight auth login` or set TRUESIGHT_TOKEN.")
}

fn resolve_api_url(cli: &Cli) -> Result<String> {
    if let Some(url) = &cli.api_url {
        return Ok(url.clone());
    }
    let cfg = load_config();
    if let Some(url) = cfg.api_url {
        return Ok(url);
    }
    // Default to production API
    Ok("https://ts-admin.cityflo.net".to_string())
}

fn resolve_project(cli: &Cli) -> Result<String> {
    if let Some(p) = &cli.project {
        return Ok(p.clone());
    }
    let cfg = load_config();
    if let Some(p) = cfg.default_project {
        return Ok(p);
    }
    bail!(
        "No project specified. Use -p/--project, TRUESIGHT_PROJECT, or `truesight config set default_project <id>`."
    )
}

fn build_client(cli: &Cli) -> Result<TrueSightClient> {
    let url = resolve_api_url(cli)?;
    let token = resolve_token(cli)?;
    Ok(TrueSightClient::new(url, token))
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Command::Update => commands::update::run().await,
        Command::Skill => commands::skill::run(),
        Command::Auth { command } => auth::run(command, &cli).await,
        Command::Config { command } => commands::config::run(command),
        Command::Projects { command } => {
            let client = build_client(&cli)?;
            commands::projects::run(command, &client, cli.format).await
        }
        Command::Teams { command } => {
            let client = build_client(&cli)?;
            commands::teams::run(command, &client, cli.format).await
        }
        Command::Stats { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::stats::run(command, &client, &project, cli.format).await
        }
        Command::EventCatalog { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::event_catalog::run(command, &client, &project, cli.format).await
        }
        Command::Properties { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::properties::run(command, &client, &project, cli.format).await
        }
        Command::Trends { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::trends::run(command, &client, &project, cli.format).await
        }
        Command::Retention { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::retention::run(command, &client, &project, cli.format).await
        }
        Command::Pivots { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::pivots::run(command, &client, &project, cli.format).await
        }
        Command::Flows { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::flows::run(command, &client, &project, cli.format).await
        }
        Command::Users { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::users::run(command, &client, &project, cli.format).await
        }
        Command::Segments { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::segments::run(command, &client, &project, cli.format).await
        }
        Command::Cohorts { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::cohorts::run(command, &client, &project, cli.format).await
        }
        Command::Boards { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::boards::run(command, &client, &project, cli.format).await
        }
        Command::Funnels { command } => {
            let client = build_client(&cli)?;
            let project = resolve_project(&cli)?;
            commands::funnels::run(command, &client, &project, cli.format).await
        }
    }
}
