mod handlers;
mod middleware;
mod routes;
mod state;
mod validation;

use std::sync::Arc;

use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use truesight_common::auth::ApiKeyCache;
use truesight_common::config::IngestionConfig;
use truesight_common::db::create_pool;
use truesight_common::shutdown::shutdown_signal;
use truesight_common::sqs::SqsProducer;
use truesight_common::telemetry::init_telemetry;

use crate::middleware::rate_limit::RateLimiterMap;
use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file (silently ignore if missing).
    dotenvy::dotenv().ok();

    // Parse configuration from environment variables.
    let config = IngestionConfig::from_env()?;

    // Initialize tracing, Sentry, and Datadog.
    let _telemetry = init_telemetry(
        "ingestion-api",
        &config.sentry_dsn,
        config.dd_enabled,
        &config.dd_agent_host,
        &config.dd_env,
    );

    info!(port = config.port(), "Starting ingestion-api");

    // Create the SQS producer.
    let sqs_producer =
        SqsProducer::new(&config.aws_region, config.sqs_endpoint_url.as_deref()).await?;

    // Create the database connection pool (for API key lookups).
    let db_pool = create_pool(&config.database_url)?;

    // Create the API key cache.
    let api_key_cache = ApiKeyCache::new();

    // Build shared application state.
    let state = AppState {
        sqs_producer: Arc::new(sqs_producer),
        api_key_cache: Arc::new(api_key_cache),
        db_pool,
        config: Arc::new(config),
    };

    // Create the per-project rate limiter map and inject it as a layer.
    let rate_limiter_map = RateLimiterMap::new();

    // Build the router with all routes and middleware.
    //
    // Layer ordering (outermost first, i.e. first to see the request):
    //   TraceLayer -> SentryHttpLayer -> NewSentryLayer -> request_id -> Extension(rate_limiter_map)
    //
    // Note: Sentry tower layers are added via tower::ServiceBuilder to satisfy
    // the Sync bounds required by axum's body type.
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::build_router(state.clone())
        .layer(axum::Extension(rate_limiter_map))
        .layer(axum::middleware::from_fn(
            crate::middleware::request_id::request_id_middleware,
        ))
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // Bind and serve with graceful shutdown.
    let addr = format!("0.0.0.0:{}", state.config.port());
    let listener = TcpListener::bind(&addr).await?;
    info!("Listening on {}", addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Server shut down gracefully");
    Ok(())
}
