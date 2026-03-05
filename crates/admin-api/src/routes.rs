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
        // Auth (requires JWT/token)
        .route("/v1/auth/me", get(handlers::auth::me))
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
        // Property Discovery & Insights
        .route(
            "/v1/stats/projects/{pid}/property-keys",
            get(handlers::properties::property_keys),
        )
        .route(
            "/v1/stats/projects/{pid}/property-values",
            get(handlers::properties::property_values),
        )
        .route(
            "/v1/stats/projects/{pid}/insights",
            post(handlers::properties::insights),
        )
        // User Profiles
        .route(
            "/v1/stats/projects/{pid}/users",
            get(handlers::users_ch::list_users),
        )
        .route(
            "/v1/stats/projects/{pid}/users/{uid}",
            get(handlers::users_ch::get_user),
        )
        .route(
            "/v1/stats/projects/{pid}/users/{uid}/events",
            get(handlers::users_ch::user_events),
        )
        // Retention
        .route(
            "/v1/stats/projects/{pid}/retention",
            post(handlers::retention::retention),
        )
        // Flows
        .route(
            "/v1/stats/projects/{pid}/flows",
            post(handlers::flows::flows),
        )
        // Cohorts
        .route(
            "/v1/projects/{pid}/cohorts",
            get(handlers::cohorts::list_cohorts),
        )
        .route(
            "/v1/projects/{pid}/cohorts",
            post(handlers::cohorts::create_cohort),
        )
        .route(
            "/v1/projects/{pid}/cohorts/{cid}",
            get(handlers::cohorts::get_cohort),
        )
        .route(
            "/v1/projects/{pid}/cohorts/{cid}",
            patch(handlers::cohorts::update_cohort),
        )
        .route(
            "/v1/projects/{pid}/cohorts/{cid}",
            delete(handlers::cohorts::delete_cohort),
        )
        .route(
            "/v1/projects/{pid}/cohorts/{cid}/users",
            get(handlers::cohorts::cohort_users),
        )
        .route(
            "/v1/projects/{pid}/cohorts/{cid}/size",
            get(handlers::cohorts::cohort_size),
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
        // Teams
        .route("/v1/teams", get(handlers::teams::list_teams))
        .route("/v1/teams", post(handlers::teams::create_team))
        .route("/v1/teams/{tid}", get(handlers::teams::get_team))
        .route("/v1/teams/{tid}", patch(handlers::teams::update_team))
        .route("/v1/teams/{tid}", delete(handlers::teams::delete_team))
        // Team Members
        .route(
            "/v1/teams/{tid}/members",
            get(handlers::teams::list_members),
        )
        .route(
            "/v1/teams/{tid}/members/{uid}",
            patch(handlers::teams::update_member),
        )
        .route(
            "/v1/teams/{tid}/members/{uid}",
            delete(handlers::teams::remove_member),
        )
        // Team Projects
        .route(
            "/v1/teams/{tid}/projects",
            get(handlers::teams::list_team_projects),
        )
        .route(
            "/v1/teams/{tid}/projects",
            post(handlers::teams::link_project),
        )
        .route(
            "/v1/teams/{tid}/projects/{pid}",
            delete(handlers::teams::unlink_project),
        )
        // Team Invitations
        .route(
            "/v1/teams/{tid}/invitations",
            get(handlers::teams::list_invitations),
        )
        .route(
            "/v1/teams/{tid}/invitations",
            post(handlers::teams::create_invitation),
        )
        .route(
            "/v1/teams/{tid}/invitations/{iid}",
            delete(handlers::teams::delete_invitation),
        )
        .route(
            "/v1/invitations/accept",
            post(handlers::invitations::accept_invitation),
        )
        // Allowed Domains
        .route(
            "/v1/teams/{tid}/allowed-domains",
            get(handlers::teams::list_allowed_domains),
        )
        .route(
            "/v1/teams/{tid}/allowed-domains",
            post(handlers::teams::add_allowed_domain),
        )
        .route(
            "/v1/teams/{tid}/allowed-domains/{did}",
            delete(handlers::teams::remove_allowed_domain),
        )
        .route_layer(middleware::from_fn_with_state(state.clone(), admin_auth))
        .with_state(state.clone());

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(handlers::health::health))
        .route("/v1/auth/google", post(handlers::auth::google_login))
        .with_state(state);

    Router::new().merge(api_routes).merge(public_routes)
}
