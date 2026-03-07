use anyhow::{Context, Result, bail};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;

pub struct TrueSightClient {
    http: reqwest::Client,
    base_url: String,
    token: String,
}

impl TrueSightClient {
    pub fn new(base_url: String, token: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
        }
    }

    fn auth_header(&self) -> String {
        format!("Bearer {}", self.token)
    }

    pub async fn get(&self, path: &str) -> Result<Value> {
        let url = format!("{}{path}", self.base_url);
        let resp = self
            .http
            .get(&url)
            .header(AUTHORIZATION, self.auth_header())
            .send()
            .await
            .context("HTTP request failed")?;

        self.handle_response(resp).await
    }

    pub async fn post(&self, path: &str, body: Option<Value>) -> Result<Value> {
        let url = format!("{}{path}", self.base_url);
        let mut req = self
            .http
            .post(&url)
            .header(AUTHORIZATION, self.auth_header())
            .header(CONTENT_TYPE, "application/json");

        if let Some(b) = body {
            req = req.json(&b);
        }

        let resp = req.send().await.context("HTTP request failed")?;
        self.handle_response(resp).await
    }

    pub async fn patch(&self, path: &str, body: Value) -> Result<Value> {
        let url = format!("{}{path}", self.base_url);
        let resp = self
            .http
            .patch(&url)
            .header(AUTHORIZATION, self.auth_header())
            .header(CONTENT_TYPE, "application/json")
            .json(&body)
            .send()
            .await
            .context("HTTP request failed")?;

        self.handle_response(resp).await
    }

    pub async fn delete(&self, path: &str) -> Result<Value> {
        let url = format!("{}{path}", self.base_url);
        let resp = self
            .http
            .delete(&url)
            .header(AUTHORIZATION, self.auth_header())
            .send()
            .await
            .context("HTTP request failed")?;

        self.handle_response(resp).await
    }

    async fn handle_response(&self, resp: reqwest::Response) -> Result<Value> {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        if status.is_success() {
            if body.is_empty() {
                return Ok(Value::Null);
            }
            serde_json::from_str(&body).context("Failed to parse response JSON")
        } else {
            // Try to extract error message from JSON response
            if let Ok(err_json) = serde_json::from_str::<Value>(&body) {
                if let Some(msg) = err_json
                    .get("error")
                    .and_then(|e| e.get("message"))
                    .and_then(|m| m.as_str())
                {
                    bail!("API error ({status}): {msg}");
                }
                if let Some(msg) = err_json.get("error").and_then(|e| e.as_str()) {
                    bail!("API error ({status}): {msg}");
                }
            }
            bail!("API error ({status}): {body}");
        }
    }
}
