use opentelemetry::trace::TracerProvider;
use opentelemetry_otlp::WithExportConfig;
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

/// Guard that must be held for the application lifetime.
/// Dropping it flushes pending Sentry events and shuts down the OTel pipeline.
pub struct TelemetryGuard {
    _sentry_guard: Option<sentry::ClientInitGuard>,
    tracer_provider: Option<opentelemetry_sdk::trace::SdkTracerProvider>,
}

impl Drop for TelemetryGuard {
    fn drop(&mut self) {
        if let Some(provider) = self.tracer_provider.take()
            && let Err(e) = provider.shutdown()
        {
            eprintln!("OpenTelemetry shutdown error: {e:?}");
        }
    }
}

/// Initializes the telemetry stack:
///   1. tracing-subscriber with JSON formatting + env filter (always)
///   2. Sentry layer (if sentry_dsn is provided)
///   3. OpenTelemetry layer exporting to Datadog via OTLP gRPC (if dd_enabled)
///
/// The caller **must** hold the returned `TelemetryGuard` for the lifetime of
/// the application.
pub fn init_telemetry(
    service_name: &str,
    sentry_dsn: &Option<String>,
    dd_enabled: bool,
    dd_agent_host: &str,
    dd_env: &str,
) -> TelemetryGuard {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    let fmt_layer = fmt::layer()
        .json()
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true);

    // --- Sentry (optional) ---
    let sentry_guard = sentry_dsn.as_ref().and_then(|dsn| {
        if dsn.is_empty() {
            return None;
        }
        Some(sentry::init((
            dsn.as_str(),
            sentry::ClientOptions {
                release: sentry::release_name!(),
                environment: Some(service_name.to_string().into()),
                traces_sample_rate: 0.1,
                ..Default::default()
            },
        )))
    });

    let sentry_layer = if sentry_guard.is_some() {
        Some(sentry::integrations::tracing::layer())
    } else {
        None
    };

    // --- OpenTelemetry (optional) ---
    let (tracer_provider, otel_layer) = if dd_enabled {
        match build_otel_provider(service_name, dd_agent_host, dd_env) {
            Ok(provider) => {
                let tracer = provider.tracer(service_name.to_string());
                let layer = tracing_opentelemetry::layer().with_tracer(tracer);
                (Some(provider), Some(layer))
            }
            Err(e) => {
                eprintln!(
                    "Failed to initialize OpenTelemetry: {e:?}. Traces will NOT be exported."
                );
                (None, None)
            }
        }
    } else {
        (None, None)
    };

    // --- Compose and install the subscriber ---
    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(sentry_layer)
        .with(otel_layer)
        .init();

    TelemetryGuard {
        _sentry_guard: sentry_guard,
        tracer_provider,
    }
}

/// Builds the OpenTelemetry tracer provider with OTLP gRPC exporter.
fn build_otel_provider(
    service_name: &str,
    dd_agent_host: &str,
    dd_env: &str,
) -> anyhow::Result<opentelemetry_sdk::trace::SdkTracerProvider> {
    use opentelemetry::KeyValue;
    use opentelemetry_sdk::Resource;

    let endpoint = format!("http://{}:4317", dd_agent_host);

    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(&endpoint)
        .build()?;

    let resource = Resource::builder()
        .with_attributes([
            KeyValue::new("service.name", service_name.to_string()),
            KeyValue::new("deployment.environment", dd_env.to_string()),
            KeyValue::new("service.version", env!("CARGO_PKG_VERSION").to_string()),
        ])
        .build();

    let provider = opentelemetry_sdk::trace::SdkTracerProvider::builder()
        .with_batch_exporter(exporter)
        .with_resource(resource)
        .build();

    Ok(provider)
}
