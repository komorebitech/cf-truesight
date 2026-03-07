mod callback_server;

use anyhow::{Result, bail};
use colored::Colorize;

use crate::cli::{AuthCommand, Cli};
use crate::config::{Credentials, delete_credentials, load_credentials, save_credentials};

pub async fn run(command: &AuthCommand, cli: &Cli) -> Result<()> {
    match command {
        AuthCommand::Login => login(cli).await,
        AuthCommand::Logout => logout(),
        AuthCommand::Status => status(cli).await,
        AuthCommand::Token => token(),
    }
}

async fn login(cli: &Cli) -> Result<()> {
    let config = crate::config::load_config();
    let api_url = cli
        .api_url
        .as_deref()
        .or(config.api_url.as_deref())
        .unwrap_or("");

    if api_url.is_empty() {
        bail!("No API URL configured. Use --api-url or `truesight config set api_url <url>`.");
    }

    // Derive dashboard URL from API URL: strip /api or use as-is
    // Convention: if api_url is like https://api.example.com, dashboard is https://app.example.com
    // For local dev: http://localhost:8081 -> dashboard at http://localhost:3000
    let dashboard_url = derive_dashboard_url(api_url);

    let state = generate_state();
    let (port, token_rx) = callback_server::start(state.clone()).await?;

    let auth_url = format!("{}/cli/auth?port={}&state={}", dashboard_url, port, state);

    eprintln!(
        "{} Opening browser for authentication...",
        "->".green().bold()
    );
    eprintln!("   {}", auth_url);

    if open::that(&auth_url).is_err() {
        eprintln!(
            "{} Could not open browser. Please visit the URL above manually.",
            "!".yellow().bold()
        );
    }

    eprintln!("{} Waiting for authentication...", "->".green().bold());

    let (token, email, name, expires_at) = token_rx.await??;

    save_credentials(&Credentials {
        token: Some(token),
        email: Some(email.clone()),
        name: Some(name),
        expires_at: Some(expires_at),
    })?;

    eprintln!("{} Logged in as {}", "✓".green().bold(), email.bold());

    Ok(())
}

fn logout() -> Result<()> {
    delete_credentials()?;
    eprintln!("{} Logged out.", "✓".green().bold());
    Ok(())
}

async fn status(cli: &Cli) -> Result<()> {
    let creds = load_credentials();
    if creds.token.is_none() {
        eprintln!("Not logged in.");
        return Ok(());
    }

    // Try to call /v1/auth/me to verify the token
    let config = crate::config::load_config();
    let api_url = cli.api_url.as_deref().or(config.api_url.as_deref());

    if let Some(url) = api_url {
        let token = creds.token.as_deref().unwrap_or("");
        let client = crate::client::TrueSightClient::new(url.to_string(), token.to_string());
        match client.get("/v1/auth/me").await {
            Ok(me) => {
                let email = me
                    .get("user")
                    .and_then(|u| u.get("email"))
                    .and_then(|e| e.as_str())
                    .unwrap_or("unknown");
                let name = me
                    .get("user")
                    .and_then(|u| u.get("name"))
                    .and_then(|n| n.as_str())
                    .unwrap_or("unknown");
                eprintln!("Logged in as {} ({})", name.bold(), email);
                if let Some(exp) = &creds.expires_at {
                    eprintln!("Token expires: {exp}");
                }
            }
            Err(e) => {
                eprintln!("Token may be expired: {e}");
                if let Some(email) = &creds.email {
                    eprintln!("Last logged in as: {email}");
                }
            }
        }
    } else {
        eprintln!(
            "Logged in as: {}",
            creds.email.as_deref().unwrap_or("unknown")
        );
        if let Some(exp) = &creds.expires_at {
            eprintln!("Token expires: {exp}");
        }
        eprintln!("(No API URL configured — cannot verify token)");
    }

    Ok(())
}

fn token() -> Result<()> {
    let creds = load_credentials();
    match creds.token {
        Some(t) => {
            print!("{t}");
            Ok(())
        }
        None => bail!("Not logged in. Run `truesight auth login` first."),
    }
}

fn derive_dashboard_url(api_url: &str) -> String {
    // Local development: API at :8081, dashboard at :3000
    if api_url.contains("localhost:8081") || api_url.contains("127.0.0.1:8081") {
        return api_url.replace("8081", "3000");
    }
    // If API URL starts with api.*, try app.*
    if let Some(rest) = api_url.strip_prefix("https://api.") {
        return format!("https://app.{rest}");
    }
    if let Some(rest) = api_url.strip_prefix("http://api.") {
        return format!("http://app.{rest}");
    }
    // Fallback: use the API URL itself (dashboard may be co-hosted)
    api_url.to_string()
}

fn generate_state() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: [u8; 32] = rng.r#gen();
    base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, bytes)
}
