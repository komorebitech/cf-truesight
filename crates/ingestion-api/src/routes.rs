use axum::{
    Json, Router, middleware,
    response::IntoResponse,
    routing::{get, post},
};
use serde_json::json;

use crate::handlers::{health, ingest};
use crate::middleware::{api_key_auth, rate_limit, zstd_decode};
use crate::state::AppState;

/// Build the application router with all routes and per-route middleware.
pub fn build_router(state: AppState) -> Router {
    // The ingest route requires authentication, rate limiting, and zstd decoding.
    // Middleware layers are applied bottom-up (last added runs first), so the
    // order here is:
    //   1. zstd_decode (outermost -- runs first on request, decompresses body)
    //   2. api_key_auth (authenticates, injects ProjectId)
    //   3. rate_limit  (checks per-project rate limit using ProjectId)
    let ingest_route = post(ingest::ingest_batch)
        .route_layer(middleware::from_fn(rate_limit::rate_limit_middleware))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            api_key_auth::api_key_auth_middleware,
        ))
        .route_layer(middleware::from_fn(zstd_decode::zstd_decode_middleware));

    Router::new()
        .route("/v1/events/batch", ingest_route)
        .route("/health", get(health::health_check))
        .fallback(fallback_handler)
        .with_state(state)
}

/// Catch-all handler that returns a 404 JSON response for unknown routes.
async fn fallback_handler() -> impl IntoResponse {
    (
        axum::http::StatusCode::NOT_FOUND,
        Json(json!({
            "error": {
                "code": "NOT_FOUND",
                "message": "The requested resource was not found"
            }
        })),
    )
}
