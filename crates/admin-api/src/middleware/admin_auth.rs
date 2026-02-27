use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

use crate::state::AppState;

/// Middleware that validates the `Authorization: Bearer <token>` header
/// against the configured `admin_api_token`.
pub async fn admin_auth(
    axum::extract::State(state): axum::extract::State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let auth_header = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return (
                StatusCode::UNAUTHORIZED,
                axum::Json(json!({
                    "error": {
                        "code": "UNAUTHORIZED",
                        "message": "Missing or invalid Authorization header"
                    }
                })),
            )
                .into_response();
        }
    };

    if token != state.config.admin_api_token {
        return (
            StatusCode::UNAUTHORIZED,
            axum::Json(json!({
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid admin API token"
                }
            })),
        )
            .into_response();
    }

    next.run(request).await
}
