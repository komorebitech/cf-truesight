use axum::{
    extract::{FromRequestParts, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;
use uuid::Uuid;

use crate::state::AppState;

/// Represents the authenticated user, injected into request extensions.
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct AuthUser {
    /// User ID from the database (None for static admin token).
    pub user_id: Option<Uuid>,
    /// User email (from JWT claims).
    pub email: Option<String>,
    /// User name (from JWT claims).
    pub name: Option<String>,
    /// Whether this request was authenticated via the static admin token.
    pub is_static_token: bool,
}

/// Middleware that validates the `Authorization: Bearer <token>` header.
/// Supports two modes:
/// 1. Static admin token (backward compat for CI/scripts)
/// 2. JWT token (for Google SSO users)
pub async fn admin_auth(
    axum::extract::State(state): axum::extract::State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    let auth_header = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return unauthorized_response("Missing or invalid Authorization header");
        }
    };

    // Try static admin token first
    if token == state.config.admin_api_token {
        let auth_user = AuthUser {
            user_id: None,
            email: None,
            name: None,
            is_static_token: true,
        };
        request.extensions_mut().insert(auth_user);
        return next.run(request).await;
    }

    // Try JWT verification
    if let Some(ref jwt_secret) = state.config.jwt_secret {
        match truesight_common::jwt::verify_jwt(jwt_secret, token) {
            Ok(claims) => {
                let user_id = claims.sub.parse::<Uuid>().ok();
                let auth_user = AuthUser {
                    user_id,
                    email: Some(claims.email),
                    name: Some(claims.name),
                    is_static_token: false,
                };
                request.extensions_mut().insert(auth_user);
                return next.run(request).await;
            }
            Err(_) => {
                return unauthorized_response("Invalid or expired token");
            }
        }
    }

    unauthorized_response("Invalid admin API token")
}

fn unauthorized_response(message: &str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        axum::Json(json!({
            "error": {
                "code": "UNAUTHORIZED",
                "message": message
            }
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Extractor for handlers to get AuthUser from request
// ---------------------------------------------------------------------------

impl<S: Send + Sync> FromRequestParts<S> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or_else(|| AppError::Unauthorized("Not authenticated".to_string()))
    }
}

use truesight_common::error::AppError;
