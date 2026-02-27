mod db;
mod handlers;
mod middleware;
mod routes;
mod state;

use std::sync::Arc;

use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use tokio::net::TcpListener;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use truesight_common::api_key::{NewApiKey, generate_api_key};
use truesight_common::auth::hash_api_key;
use truesight_common::config::AdminConfig;
use truesight_common::db::create_pool;
use truesight_common::project::NewProject;
use truesight_common::telemetry::init_telemetry;

use crate::state::AppState;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../../migrations");

fn run_migrations(pool: &truesight_common::db::DbPool) {
    let mut conn = pool
        .get()
        .expect("Failed to get DB connection for migrations");
    conn.run_pending_migrations(MIGRATIONS)
        .expect("Failed to run database migrations");
    info!("Database migrations completed successfully");
}

fn build_clickhouse_client(config: &AdminConfig) -> clickhouse::Client {
    clickhouse::Client::default()
        .with_url(&config.clickhouse_url)
        .with_user(&config.clickhouse_user)
        .with_password(&config.clickhouse_password)
        .with_database(&config.clickhouse_database)
}

fn build_cors_layer(config: &AdminConfig) -> CorsLayer {
    use axum::http::{Method, header};

    let origins = &config.cors_allowed_origins;

    let allow_origin = if origins == "*" {
        AllowOrigin::any()
    } else {
        let parsed: Vec<_> = origins
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect();
        AllowOrigin::list(parsed)
    };

    CorsLayer::new()
        .allow_origin(allow_origin)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
}

async fn seed(pool: &truesight_common::db::DbPool) -> anyhow::Result<()> {
    info!("Running seed...");

    let project = db::projects::insert_project(
        pool,
        NewProject {
            name: "Test Project".to_string(),
        },
    )?;
    info!("Created project: {} ({})", project.name, project.id);

    let (full_key, prefix) = generate_api_key("test");
    let key_hash = hash_api_key(&full_key)?;
    let api_key = db::api_keys::insert_api_key(
        pool,
        NewApiKey {
            project_id: project.id,
            prefix,
            key_hash,
            label: "Default test key".to_string(),
            environment: "test".to_string(),
        },
    )?;
    info!(
        "Created API key: {} (prefix: {})",
        api_key.id, api_key.prefix
    );
    info!("Plaintext key (save this!): {}", full_key);

    info!("Seed completed");
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment
    dotenvy::dotenv().ok();

    // Load config
    let config = AdminConfig::from_env()?;

    // Init telemetry
    let _sentry_guard = init_telemetry("admin-api", &config.sentry_dsn);

    info!("Starting admin-api");

    // Create DB pool
    let db_pool = create_pool(&config.database_url)?;

    // Run migrations
    run_migrations(&db_pool);

    // Check for --seed argument
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--seed") {
        seed(&db_pool).await?;
        return Ok(());
    }

    // Create ClickHouse client
    let ch_client = build_clickhouse_client(&config);

    // Build CORS layer
    let cors = build_cors_layer(&config);

    // Record start time for health checks
    handlers::health::record_start_time();

    // Build app state
    let state = AppState {
        db_pool,
        clickhouse_client: Arc::new(ch_client),
        config: Arc::new(config.clone()),
    };

    // Build router
    let app = routes::create_router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    // Bind and serve
    let addr = format!("0.0.0.0:{}", config.port());
    info!("Listening on {}", addr);
    let listener = TcpListener::bind(&addr).await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Server shut down gracefully");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C handler");
    info!("Received shutdown signal");
}
