use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

/// Initializes the telemetry stack (tracing + optional Sentry).
///
/// Returns the Sentry `ClientInitGuard` if a DSN was provided. The caller **must**
/// hold this guard for the lifetime of the application so that Sentry can flush
/// pending events on shutdown.
pub fn init_telemetry(
    service_name: &str,
    sentry_dsn: &Option<String>,
) -> Option<sentry::ClientInitGuard> {
    // Build the tracing subscriber with JSON formatting and env-based filter.
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    let fmt_layer = fmt::layer()
        .json()
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true);

    let registry = tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer);

    // Initialize Sentry if DSN is configured.
    let guard = sentry_dsn.as_ref().and_then(|dsn| {
        if dsn.is_empty() {
            return None;
        }

        let guard = sentry::init((
            dsn.as_str(),
            sentry::ClientOptions {
                release: sentry::release_name!(),
                environment: Some(service_name.to_string().into()),
                traces_sample_rate: 0.1,
                ..Default::default()
            },
        ));

        Some(guard)
    });

    if guard.is_some() {
        let sentry_layer = sentry::integrations::tracing::layer();
        registry.with(sentry_layer).init();
    } else {
        registry.init();
    }

    guard
}
