pub mod boards;
pub mod update;
pub mod cohorts;
pub mod config;
pub mod event_catalog;
pub mod flows;
pub mod funnels;
pub mod pivots;
pub mod projects;
pub mod properties;
pub mod retention;
pub mod segments;
pub mod skill;
pub mod stats;
pub mod teams;
pub mod trends;
pub mod users;

use anyhow::{Result, bail};
use serde_json::Value;
use std::io::Read;

/// Read a JSON body from --body, --body-file, or stdin.
pub fn read_body(body: &Option<String>, body_file: &Option<String>) -> Result<Value> {
    if let Some(b) = body {
        return serde_json::from_str(b).map_err(|e| anyhow::anyhow!("Invalid JSON in --body: {e}"));
    }
    if let Some(path) = body_file {
        let contents = std::fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("Cannot read {path}: {e}"))?;
        return serde_json::from_str(&contents)
            .map_err(|e| anyhow::anyhow!("Invalid JSON in {path}: {e}"));
    }
    // Try stdin if not a TTY
    if !atty_check() {
        let mut buf = String::new();
        std::io::stdin().read_to_string(&mut buf)?;
        if !buf.trim().is_empty() {
            return serde_json::from_str(&buf)
                .map_err(|e| anyhow::anyhow!("Invalid JSON from stdin: {e}"));
        }
    }
    bail!("No request body provided. Use --body, --body-file, or pipe JSON to stdin.")
}

fn atty_check() -> bool {
    use std::io::IsTerminal;
    std::io::stdin().is_terminal()
}
