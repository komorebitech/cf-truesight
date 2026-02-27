use axum::{
    extract::Request,
    extract::{FromRequestParts, State},
    http::request::Parts,
    middleware::Next,
    response::{IntoResponse, Response},
};
use diesel::prelude::*;
use std::time::Duration;
use uuid::Uuid;

use truesight_common::api_key::ApiKey;
use truesight_common::auth::verify_api_key;
use truesight_common::db::get_conn;
use truesight_common::error::AppError;
use truesight_common::schema::api_keys;

use crate::state::AppState;

/// Newtype wrapper for a validated project ID, injected into request extensions
/// by the API key authentication middleware.
#[derive(Debug, Clone, Copy)]
pub struct ProjectId(pub Uuid);

/// Axum `FromRequestParts` implementation so handlers can extract `ProjectId`
/// directly from the request extensions.
impl<S: Send + Sync> FromRequestParts<S> for ProjectId {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<ProjectId>()
            .copied()
            .ok_or_else(|| AppError::Unauthorized("Missing or invalid API key".to_string()))
    }
}

/// TTL for cached API key lookups (5 minutes).
const CACHE_TTL: Duration = Duration::from_secs(300);

/// Middleware that authenticates requests using the `X-API-Key` header.
///
/// 1. Extracts the raw API key from `X-API-Key`.
/// 2. Computes a SHA-256 cache key and checks the in-memory cache.
/// 3. On cache miss, queries the `api_keys` table for rows whose prefix matches
///    the first 8 characters of the raw key and whose `active` flag is true.
/// 4. For each candidate row, verifies the raw key against the stored Argon2 hash.
/// 5. On a successful match, caches the mapping and injects `ProjectId` into
///    request extensions.
pub async fn api_key_auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    // Extract the raw API key from the header.
    let raw_key = match request
        .headers()
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
    {
        Some(key) if !key.is_empty() => key.to_string(),
        _ => {
            return AppError::Unauthorized("Missing X-API-Key header".to_string()).into_response();
        }
    };

    // Check the cache first.
    if let Some(project_id) = state.api_key_cache.get(&raw_key) {
        request.extensions_mut().insert(ProjectId(project_id));
        return next.run(request).await;
    }

    // Cache miss -- look up by prefix in the database.
    let prefix = if raw_key.len() >= 8 {
        raw_key[..8].to_string()
    } else {
        return AppError::Unauthorized("Invalid API key format".to_string()).into_response();
    };

    let conn_result = get_conn(&state.db_pool);
    let mut conn = match conn_result {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(error = %e, "Failed to get database connection for API key auth");
            return AppError::Internal("Service unavailable".to_string()).into_response();
        }
    };

    let candidates: Vec<ApiKey> = match api_keys::table
        .filter(api_keys::prefix.eq(&prefix))
        .filter(api_keys::active.eq(true))
        .load::<ApiKey>(&mut conn)
    {
        Ok(keys) => keys,
        Err(e) => {
            tracing::error!(error = %e, "Failed to query API keys");
            return AppError::Internal("Service unavailable".to_string()).into_response();
        }
    };

    // Verify the raw key against each candidate's Argon2 hash.
    for candidate in &candidates {
        match verify_api_key(&raw_key, &candidate.key_hash) {
            Ok(true) => {
                // Successful verification -- cache and proceed.
                state
                    .api_key_cache
                    .insert(&raw_key, candidate.project_id, CACHE_TTL);
                request
                    .extensions_mut()
                    .insert(ProjectId(candidate.project_id));
                return next.run(request).await;
            }
            Ok(false) => continue,
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    key_id = %candidate.id,
                    "Error verifying API key"
                );
                continue;
            }
        }
    }

    AppError::Unauthorized("Invalid API key".to_string()).into_response()
}
