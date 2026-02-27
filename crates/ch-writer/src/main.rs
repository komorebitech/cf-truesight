//! TrueSight ClickHouse Writer
//!
//! Consumes enriched events from SQS and inserts them into ClickHouse in
//! batches. Designed to run as a long-lived service with multiple concurrent
//! consumer tasks, a batching layer, and a health-check endpoint.

mod batcher;
mod config;
mod consumer;
mod dedup;
mod dlq;
mod health;
mod identity;
mod inserter;

use std::sync::Arc;

use anyhow::Result;
use tokio::sync::{mpsc, watch};
use truesight_common::sqs::SqsConsumer;
use truesight_common::telemetry::init_telemetry;

use crate::batcher::Batcher;
use crate::config::WriterConfig;
use crate::consumer::ConsumerLoop;
use crate::dlq::DlqSender;
use crate::inserter::ClickHouseInserter;

/// Number of concurrent SQS consumer tasks.
const NUM_CONSUMERS: usize = 3;

/// Port on which the health endpoint listens.
const HEALTH_PORT: u16 = 9090;

/// Channel buffer size between consumers and batcher.
const CHANNEL_BUFFER: usize = 10_000;

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env (best-effort; missing file is fine in production).
    dotenvy::dotenv().ok();

    // Load configuration from environment variables.
    let config = WriterConfig::from_env()?;

    // Initialise tracing + optional Sentry integration.
    let _sentry_guard = init_telemetry("ch-writer", &config.sentry_dsn);

    tracing::info!("ch-writer starting");
    tracing::info!(dedup = crate::dedup::dedup_note(), "dedup strategy");

    // --- Build shared resources ---

    let inserter = Arc::new(ClickHouseInserter::new(
        &config.clickhouse_url,
        &config.clickhouse_database,
        &config.clickhouse_user,
        &config.clickhouse_password,
    ));

    let sqs_consumer =
        Arc::new(SqsConsumer::new(&config.aws_region, config.sqs_endpoint_url.as_deref()).await?);

    let dlq_sender = Arc::new(
        DlqSender::from_config(&config.aws_region, config.sqs_endpoint_url.as_deref()).await?,
    );

    // Derive a DLQ URL by convention: source queue URL + "-dlq" suffix.
    // In production this would typically be configured explicitly; this is a
    // sensible default.
    let dlq_url: Option<String> = Some(format!("{}-dlq", &config.sqs_queue_url));

    // --- Shutdown signal ---

    let (shutdown_tx, _shutdown_rx) = watch::channel(false);
    let (health_shutdown_tx, health_shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    // --- Channel between consumers and batcher ---

    let (event_tx, event_rx) = mpsc::channel(CHANNEL_BUFFER);

    // --- Spawn consumer tasks ---

    let mut consumer_handles = Vec::with_capacity(NUM_CONSUMERS);

    for i in 0..NUM_CONSUMERS {
        // Each consumer gets its own SqsConsumer instance to avoid shared
        // mutable state. They share the same SQS queue and DLQ.
        let consumer_client =
            SqsConsumer::new(&config.aws_region, config.sqs_endpoint_url.as_deref()).await?;

        let dlq_client =
            DlqSender::from_config(&config.aws_region, config.sqs_endpoint_url.as_deref()).await?;

        let consumer_loop = ConsumerLoop::new(
            consumer_client,
            config.sqs_queue_url.clone(),
            event_tx.clone(),
            dlq_client,
            dlq_url.clone(),
            config.sqs_receive_batch_size,
        );

        let cancel_rx = shutdown_tx.subscribe();

        let handle = tokio::spawn(async move {
            if let Err(e) = consumer_loop.run(cancel_rx).await {
                tracing::error!(consumer = i, error = %e, "consumer task exited with error");
            }
        });

        consumer_handles.push(handle);
    }

    // Drop the sender held by main so the batcher sees channel closure when all
    // consumer tasks finish.
    drop(event_tx);

    // --- Spawn batcher ---

    let batcher = Batcher::new(
        event_rx,
        Arc::clone(&inserter),
        Arc::clone(&sqs_consumer),
        Arc::clone(&dlq_sender),
        config.sqs_queue_url.clone(),
        dlq_url.clone(),
        Some(config.batch_size()),
        Some(config.flush_interval_secs() * 1000), // convert seconds to ms
    );

    let batcher_handle = tokio::spawn(async move {
        if let Err(e) = batcher.run().await {
            tracing::error!(error = %e, "batcher exited with error");
        }
    });

    // --- Spawn health endpoint ---

    let health_handle = tokio::spawn(async move {
        health::serve_health(HEALTH_PORT, async {
            let _ = health_shutdown_rx.await;
        })
        .await;
    });

    // --- Wait for shutdown signal ---

    let ctrl_c = tokio::signal::ctrl_c();

    #[cfg(unix)]
    let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;

    #[cfg(unix)]
    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("received SIGINT, shutting down");
        }
        _ = sigterm.recv() => {
            tracing::info!("received SIGTERM, shutting down");
        }
    }

    #[cfg(not(unix))]
    {
        ctrl_c.await?;
        tracing::info!("received Ctrl-C, shutting down");
    }

    // --- Graceful shutdown ---

    // Signal consumers to stop.
    let _ = shutdown_tx.send(true);

    // Wait for consumer tasks to finish.
    for handle in consumer_handles {
        let _ = handle.await;
    }

    // Batcher will drain the channel and flush remaining events.
    let _ = batcher_handle.await;

    // Shut down health endpoint.
    let _ = health_shutdown_tx.send(());
    let _ = health_handle.await;

    tracing::info!("ch-writer shut down complete");
    Ok(())
}
