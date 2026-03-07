use anyhow::{Context, Result, bail};
use colored::Colorize;
use serde::Deserialize;
use std::env;
use std::fs;

const REPO: &str = "komorebitech/cf-truesight";
const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

fn artifact_name() -> Result<String> {
    let os = match env::consts::OS {
        "linux" => "linux",
        "macos" => "darwin",
        "windows" => "windows",
        other => bail!("Unsupported OS: {other}"),
    };
    let arch = match env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        other => bail!("Unsupported architecture: {other}"),
    };
    if os == "windows" {
        Ok(format!("truesight-{os}-{arch}.exe"))
    } else {
        Ok(format!("truesight-{os}-{arch}"))
    }
}

pub async fn run() -> Result<()> {
    eprintln!(
        "{} Current version: v{CURRENT_VERSION}",
        "->".green().bold()
    );
    eprintln!("{} Checking for updates...", "->".green().bold());

    let client = reqwest::Client::new();

    // Fetch latest CLI release
    let releases: Vec<Release> = client
        .get(format!(
            "https://api.github.com/repos/{REPO}/releases?per_page=10"
        ))
        .header("User-Agent", "truesight-cli")
        .send()
        .await?
        .json()
        .await?;

    let release = releases
        .into_iter()
        .find(|r| r.tag_name.starts_with("cli-v"))
        .context("No CLI release found")?;

    let latest_version = release.tag_name.strip_prefix("cli-v").unwrap_or(&release.tag_name);

    if latest_version == CURRENT_VERSION {
        eprintln!(
            "{} Already up to date (v{CURRENT_VERSION})",
            "✓".green().bold()
        );
        return Ok(());
    }

    eprintln!(
        "{} New version available: v{latest_version}",
        "->".green().bold()
    );

    let target = artifact_name()?;
    let asset = release
        .assets
        .iter()
        .find(|a| a.name == target)
        .context(format!("No binary found for {target}"))?;

    eprintln!("{} Downloading {target}...", "->".green().bold());

    let bytes = client
        .get(&asset.browser_download_url)
        .header("User-Agent", "truesight-cli")
        .send()
        .await?
        .bytes()
        .await?;

    // Replace current binary
    let current_exe = env::current_exe().context("Could not determine current executable path")?;
    let backup = current_exe.with_extension("old");

    // Rename current binary to .old, write new one, then remove .old
    fs::rename(&current_exe, &backup)
        .context("Could not rename current binary (try running with sudo)")?;

    if let Err(e) = fs::write(&current_exe, &bytes) {
        // Restore backup on failure
        let _ = fs::rename(&backup, &current_exe);
        bail!("Failed to write new binary: {e}");
    }

    // Set executable permissions on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&current_exe, fs::Permissions::from_mode(0o755))?;
    }

    let _ = fs::remove_file(&backup);

    eprintln!(
        "{} Updated to v{latest_version}",
        "✓".green().bold()
    );

    Ok(())
}
