use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_project: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Credentials {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

fn config_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().context("Could not determine home directory")?;
    Ok(home.join(".truesight"))
}

fn ensure_config_dir() -> Result<PathBuf> {
    let dir = config_dir()?;
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

pub fn load_config() -> Config {
    config_dir()
        .ok()
        .and_then(|dir| fs::read_to_string(dir.join("config.json")).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_config(config: &Config) -> Result<()> {
    let dir = ensure_config_dir()?;
    let json = serde_json::to_string_pretty(config)?;
    fs::write(dir.join("config.json"), json)?;
    Ok(())
}

pub fn load_credentials() -> Credentials {
    config_dir()
        .ok()
        .and_then(|dir| fs::read_to_string(dir.join("credentials.json")).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_credentials(creds: &Credentials) -> Result<()> {
    let dir = ensure_config_dir()?;
    let json = serde_json::to_string_pretty(creds)?;
    fs::write(dir.join("credentials.json"), json)?;
    Ok(())
}

pub fn delete_credentials() -> Result<()> {
    let dir = config_dir()?;
    let path = dir.join("credentials.json");
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}
