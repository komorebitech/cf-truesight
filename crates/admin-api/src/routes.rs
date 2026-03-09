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
        .route("/v1/auth/me/onboarding-complete", post(handlers::auth::complete_onboarding))
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
        // Event Catalog
        .route(
            "/v1/stats/projects/{pid}/event-catalog",
            get(handlers::event_catalog::event_catalog),
        )
        .route(
            "/v1/stats/projects/{pid}/event-catalog/{event_name}/properties",
            get(handlers::event_catalog::event_properties),
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
            "/v1/stats/projects/{pid}/event-names",
            get(handlers::stats::event_names),
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
        .route(
            "/v1/stats/projects/{pid}/platform-distribution",
            get(handlers::stats::platform_distribution),
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
        // Trends
        .route(
            "/v1/stats/projects/{pid}/trends",
            post(handlers::trends::trends),
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
        // Pivots
        .route(
            "/v1/stats/projects/{pid}/pivots",
            post(handlers::pivots::pivots),
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
        // Segments
        .route(
            "/v1/projects/{pid}/segments",
            get(handlers::segments::list_segments),
        )
        .route(
            "/v1/projects/{pid}/segments",
            post(handlers::segments::create_segment),
        )
        .route(
            "/v1/projects/{pid}/segments/preview",
            post(handlers::segments::segment_preview),
        )
        .route(
            "/v1/projects/{pid}/segments/{sid}",
            get(handlers::segments::get_segment),
        )
        .route(
            "/v1/projects/{pid}/segments/{sid}",
            patch(handlers::segments::update_segment),
        )
        .route(
            "/v1/projects/{pid}/segments/{sid}",
            delete(handlers::segments::delete_segment),
        )
        .route(
            "/v1/projects/{pid}/segments/{sid}/size",
            get(handlers::segments::segment_size),
        )
        .route(
            "/v1/projects/{pid}/segments/{sid}/users",
            get(handlers::segments::segment_users),
        )
        // Boards
        .route(
            "/v1/projects/{pid}/boards",
            get(handlers::boards::list_boards),
        )
        .route(
            "/v1/projects/{pid}/boards",
            post(handlers::boards::create_board),
        )
        .route(
            "/v1/projects/{pid}/boards/{bid}",
            get(handlers::boards::get_board),
        )
        .route(
            "/v1/projects/{pid}/boards/{bid}",
            patch(handlers::boards::update_board),
        )
        .route(
            "/v1/projects/{pid}/boards/{bid}",
            delete(handlers::boards::delete_board),
        )
        .route(
            "/v1/projects/{pid}/boards/{bid}/widgets",
            post(handlers::boards::create_widget),
        )
        .route(
            "/v1/projects/{pid}/boards/{bid}/widgets/{wid}",
            patch(handlers::boards::update_widget),
        )
        .route(
            "/v1/projects/{pid}/boards/{bid}/widgets/{wid}",
            delete(handlers::boards::delete_widget),
        )
        .route(
            "/v1/projects/{pid}/boards/{bid}/layouts",
            patch(handlers::boards::batch_update_layouts),
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

    // SSE routes (auth via query param, outside middleware)
    let sse_routes = Router::new()
        .route(
            "/v1/stats/projects/{pid}/events/stream",
            get(handlers::live_events::live_events_stream),
        )
        .with_state(state.clone());

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(handlers::health::health))
        .route("/v1/auth/google", post(handlers::auth::google_login))
        .with_state(state);

    Router::new()
        .merge(api_routes)
        .merge(sse_routes)
        .merge(public_routes)
}
