use axum::{
    extract::Request,
    middleware::Next,
    response::{IntoResponse, Response},
};
use dashmap::DashMap;
use governor::{
    Quota, RateLimiter,
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
};
use std::{num::NonZeroU32, sync::Arc};
use uuid::Uuid;

use truesight_common::error::AppError;

use crate::middleware::api_key_auth::ProjectId;

/// Type alias for a single project's rate limiter.
type ProjectRateLimiter = RateLimiter<NotKeyed, InMemoryState, DefaultClock>;

/// Shared, per-project rate limiter registry.
///
/// Each project gets its own token-bucket rate limiter:
/// - Sustained rate: 1000 requests/second
/// - Burst capacity: 200 requests
#[derive(Debug, Clone)]
pub struct RateLimiterMap {
    inner: Arc<DashMap<Uuid, Arc<ProjectRateLimiter>>>,
}

impl RateLimiterMap {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(DashMap::new()),
        }
    }

    /// Get or create a rate limiter for the given project.
    fn get_or_create(&self, project_id: Uuid) -> Arc<ProjectRateLimiter> {
        self.inner
            .entry(project_id)
            .or_insert_with(|| {
                let quota = Quota::per_second(NonZeroU32::new(1000).unwrap())
                    .allow_burst(NonZeroU32::new(200).unwrap());
                Arc::new(RateLimiter::direct(quota))
            })
            .value()
            .clone()
    }
}

impl Default for RateLimiterMap {
    fn default() -> Self {
        Self::new()
    }
}

/// Middleware that enforces per-project rate limits.
///
/// Requires that `ProjectId` has already been injected into request extensions
/// (i.e., this middleware must run after `api_key_auth_middleware`).
///
/// If the rate limit is exceeded, returns 429 Too Many Requests with a
/// `Retry-After` header.
pub async fn rate_limit_middleware(request: Request, next: Next) -> Response {
    let project_id = match request.extensions().get::<ProjectId>() {
        Some(pid) => pid.0,
        None => {
            // Should never happen if middleware ordering is correct.
            return AppError::Unauthorized("Missing project context".to_string()).into_response();
        }
    };

    let rate_limiter_map = match request.extensions().get::<RateLimiterMap>() {
        Some(m) => m.clone(),
        None => {
            tracing::error!("RateLimiterMap not found in request extensions");
            return AppError::Internal("Rate limiter not configured".to_string()).into_response();
        }
    };

    let limiter = rate_limiter_map.get_or_create(project_id);

    match limiter.check() {
        Ok(_) => next.run(request).await,
        Err(not_until) => {
            let wait = not_until.wait_time_from(governor::clock::Clock::now(
                &governor::clock::DefaultClock::default(),
            ));
            let retry_after = wait.as_secs().max(1);

            let mut response = AppError::RateLimited.into_response();
            response.headers_mut().insert(
                "retry-after",
                retry_after
                    .to_string()
                    .parse()
                    .unwrap_or_else(|_| "1".parse().unwrap()),
            );
            response
        }
    }
}
