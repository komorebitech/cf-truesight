//! Minimal HTTP health-check endpoint.
//!
//! Exposes `GET /health` on port 9090 so that container orchestrators (ECS,
//! Kubernetes) can probe liveness.

use axum::{Json, Router, routing::get};
use serde_json::{Value, json};

/// Returns a configured [`Router`] with the health endpoint.
pub fn health_router() -> Router {
    Router::new().route("/health", get(health_handler))
}

async fn health_handler() -> Json<Value> {
    Json(json!({ "status": "healthy" }))
}

/// Starts the health HTTP server on the given port.
///
/// This function runs until the provided `shutdown` future resolves, allowing
/// the caller to tie it into the global graceful-shutdown mechanism.
pub async fn serve_health(
    port: u16,
    shutdown: impl std::future::Future<Output = ()> + Send + 'static,
) {
    let app = health_router();
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .expect("failed to bind health endpoint");

    tracing::info!(port, "health endpoint listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await
        .expect("health server error");
}
