use anyhow::{Context, Result};
use colored::Colorize;
use std::fs;
use std::path::PathBuf;

const SKILL_CONTENT: &str = include_str!("../../../../skills/ts/SKILL.md");

fn skill_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().context("Could not determine home directory")?;
    Ok(home.join(".claude").join("skills").join("ts"))
}

pub fn run() -> Result<()> {
    let dir = skill_dir()?;
    let path = dir.join("SKILL.md");

    fs::create_dir_all(&dir)
        .with_context(|| format!("Could not create {}", dir.display()))?;

    fs::write(&path, SKILL_CONTENT)
        .with_context(|| format!("Could not write {}", path.display()))?;

    eprintln!(
        "{} Installed Claude Code skill to {}",
        "✓".green().bold(),
        path.display()
    );
    eprintln!(
        "  Available as {} (or {}) in Claude Code.",
        "/ts".bold(),
        "/truesight".bold()
    );

    Ok(())
}
