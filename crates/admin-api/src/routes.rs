use axum::{
    Router, middleware,
    routing::{delete, get, patch, post},
};

use crate::handlers;
use crate::middleware::admin_auth::admin_auth;
use crate::state::AppState;

pub fn create_router(state: AppState) -> Router {
    // Authenticated routes
    let api_routes = Router::new()
        // Projects
        .route("/v1/projects", get(handlers::projects::list_projects))
        .route("/v1/projects/{id}", get(handlers::projects::get_project))
        .route("/v1/projects", post(handlers::projects::create_project))
        .route(
            "/v1/projects/{id}",
            patch(handlers::projects::update_project),
        )
        .route(
            "/v1/projects/{id}",
            delete(handlers::projects::delete_project),
        )
        // API Keys
        .route(
            "/v1/projects/{pid}/api-keys",
            get(handlers::api_keys::list_api_keys),
        )
        .route(
            "/v1/projects/{pid}/api-keys",
            post(handlers::api_keys::generate_api_key_handler),
        )
        .route(
            "/v1/projects/{pid}/api-keys/{kid}",
            delete(handlers::api_keys::revoke_api_key),
        )
        // Stats
        .route(
            "/v1/stats/projects/{pid}/event-count",
            get(handlers::stats::event_count),
        )
        .route(
            "/v1/stats/projects/{pid}/throughput",
            get(handlers::stats::throughput),
        )
        .route(
            "/v1/stats/projects/{pid}/event-types",
            get(handlers::stats::event_types),
        )
        .route(
            "/v1/stats/projects/{pid}/events",
            get(handlers::stats::list_events),
        )
        // Active Users
        .route(
            "/v1/stats/projects/{pid}/active-users",
            get(handlers::stats::active_users),
        )
        .route(
            "/v1/stats/projects/{pid}/live-users",
            get(handlers::stats::live_users),
        )
        // Funnels
        .route(
            "/v1/projects/{pid}/funnels",
            get(handlers::funnels::list_funnels),
        )
        .route(
            "/v1/projects/{pid}/funnels",
            post(handlers::funnels::create_funnel),
        )
        .route(
            "/v1/projects/{pid}/funnels/compare",
            get(handlers::funnels::compare_funnels),
        )
        .route(
            "/v1/projects/{pid}/funnels/{fid}",
            get(handlers::funnels::get_funnel),
        )
        .route(
            "/v1/projects/{pid}/funnels/{fid}",
            patch(handlers::funnels::update_funnel),
        )
        .route(
            "/v1/projects/{pid}/funnels/{fid}",
            delete(handlers::funnels::delete_funnel),
        )
        .route(
            "/v1/projects/{pid}/funnels/{fid}/results",
            get(handlers::funnels::funnel_results),
        )
        .route(
            "/v1/projects/{pid}/funnels/{fid}/compare",
            get(handlers::funnels::compare_time_ranges),
        )
        .route_layer(middleware::from_fn_with_state(state.clone(), admin_auth))
        .with_state(state.clone());

    // Public routes
    let health_route = Router::new()
        .route("/health", get(handlers::health::health))
        .with_state(state);

    Router::new().merge(api_routes).merge(health_route)
}
