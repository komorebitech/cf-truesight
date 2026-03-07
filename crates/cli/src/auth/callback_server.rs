use anyhow::{Result, bail};
use axum::{Router, extract::Query, response::Html, routing::get};
use serde::Deserialize;
use std::net::TcpListener;
use tokio::sync::oneshot;

#[derive(Deserialize)]
struct CallbackParams {
    token: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

/// Start a local HTTP server for the OAuth callback.
/// Returns the port and a receiver that will deliver (token, email, name, expires_at).
pub async fn start(
    expected_state: String,
) -> Result<(
    u16,
    oneshot::Receiver<Result<(String, String, String, String)>>,
)> {
    let port = find_available_port()?;
    let (tx, rx) = oneshot::channel();

    // Wrap in Option so we can take() it exactly once
    let tx = std::sync::Arc::new(tokio::sync::Mutex::new(Some(tx)));

    let app = Router::new().route(
        "/callback",
        get({
            let expected_state = expected_state.clone();
            let tx = tx.clone();
            move |Query(params): Query<CallbackParams>| {
                let expected_state = expected_state.clone();
                let tx = tx.clone();
                async move {
                    if let Some(error) = params.error {
                        let _ = tx.lock().await.take().map(|tx| {
                            let _ = tx.send(Err(anyhow::anyhow!("Auth error: {error}")));
                        });
                        return Html(format!(
                            "<html><body><h2>Authentication failed</h2><p>{error}</p></body></html>"
                        ));
                    }

                    let token = match params.token {
                        Some(t) => t,
                        None => {
                            let _ = tx.lock().await.take().map(|tx| {
                                let _ = tx.send(Err(anyhow::anyhow!("No token in callback")));
                            });
                            return Html(
                                "<html><body><h2>Authentication failed</h2><p>No token received.</p></body></html>".to_string()
                            );
                        }
                    };

                    // Validate CSRF state
                    let state = params.state.unwrap_or_default();
                    if state != expected_state {
                        let _ = tx.lock().await.take().map(|tx| {
                            let _ = tx.send(Err(anyhow::anyhow!("State mismatch (CSRF check failed)")));
                        });
                        return Html(
                            "<html><body><h2>Authentication failed</h2><p>State mismatch.</p></body></html>".to_string()
                        );
                    }

                    // Decode JWT payload (no signature verification — server already verified)
                    let (email, name, expires_at) = decode_jwt_claims(&token);

                    let _ = tx.lock().await.take().map(|tx| {
                        let _ = tx.send(Ok((token, email, name, expires_at)));
                    });

                    Html(
                        "<html><body style=\"font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0\">\
                         <div style=\"text-align:center\">\
                         <h2 style=\"color:#2d6a4f\">Authentication successful!</h2>\
                         <p style=\"color:#666\">You can close this tab and return to the terminal.</p>\
                         </div></body></html>"
                        .to_string()
                    )
                }
            }
        }),
    );

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{port}")).await?;

    tokio::spawn(async move {
        // Serve until the sender is consumed (one request)
        axum::serve(listener, app).await.ok();
    });

    Ok((port, rx))
}

fn find_available_port() -> Result<u16> {
    for port in 9876..=9899 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    bail!("Could not find an available port in range 9876-9899")
}

fn decode_jwt_claims(token: &str) -> (String, String, String) {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() < 2 {
        return ("unknown".into(), "unknown".into(), "unknown".into());
    }

    let payload = parts[1];
    let decoded =
        base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, payload).or_else(
            |_| {
                // Try with standard base64 (some JWTs may use it)
                base64::Engine::decode(&base64::engine::general_purpose::STANDARD, payload)
            },
        );

    let decoded = match decoded {
        Ok(d) => d,
        Err(_) => return ("unknown".into(), "unknown".into(), "unknown".into()),
    };

    let claims: serde_json::Value = match serde_json::from_slice(&decoded) {
        Ok(c) => c,
        Err(_) => return ("unknown".into(), "unknown".into(), "unknown".into()),
    };

    let email = claims
        .get("email")
        .or_else(|| claims.get("sub"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let name = claims
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let expires_at = claims
        .get("exp")
        .and_then(|v| v.as_i64())
        .map(|ts| {
            chrono::DateTime::from_timestamp(ts, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|| ts.to_string())
        })
        .unwrap_or_else(|| "unknown".to_string());

    (email, name, expires_at)
}
