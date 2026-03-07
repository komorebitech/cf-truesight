use anyhow::{Result, bail};

use crate::cli::ConfigCommand;
use crate::config::{load_config, save_config};

pub fn run(command: &ConfigCommand) -> Result<()> {
    match command {
        ConfigCommand::Set { key, value } => set(key, value),
        ConfigCommand::Get { key } => get(key),
    }
}

fn set(key: &str, value: &str) -> Result<()> {
    let mut config = load_config();
    match key {
        "api_url" => config.api_url = Some(value.to_string()),
        "default_project" => config.default_project = Some(value.to_string()),
        _ => bail!("Unknown config key: {key}. Valid keys: api_url, default_project"),
    }
    save_config(&config)?;
    eprintln!("Set {key} = {value}");
    Ok(())
}

fn get(key: &str) -> Result<()> {
    let config = load_config();
    let value = match key {
        "api_url" => config.api_url,
        "default_project" => config.default_project,
        _ => bail!("Unknown config key: {key}. Valid keys: api_url, default_project"),
    };
    match value {
        Some(v) => println!("{v}"),
        None => eprintln!("{key} is not set"),
    }
    Ok(())
}
