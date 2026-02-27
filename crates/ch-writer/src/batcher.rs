//! Event batcher.
//!
//! Accumulates [`IncomingEvent`]s received from the consumer loops and flushes
//! them to the [`ClickHouseInserter`] when either the batch-size threshold or
//! the timeout interval is reached. After a successful insert the corresponding
//! SQS messages are acknowledged (deleted). Failed batches are routed to the DLQ.

use std::sync::Arc;

use anyhow::Result;
use tokio::sync::{Semaphore, mpsc};
use truesight_common::sqs::SqsConsumer;

use crate::config::{DEFAULT_BATCH_SIZE, DEFAULT_BATCH_TIMEOUT_MS, MAX_IN_FLIGHT};
use crate::consumer::IncomingEvent;
use crate::dlq::DlqSender;
use crate::identity::process_identify_event;
use crate::inserter::ClickHouseInserter;

/// Receives events from consumer loops, batches them, and flushes to ClickHouse.
pub struct Batcher {
    receiver: mpsc::Receiver<IncomingEvent>,
    inserter: Arc<ClickHouseInserter>,
    sqs_consumer: Arc<SqsConsumer>,
    dlq_sender: Arc<DlqSender>,
    queue_url: String,
    dlq_url: Option<String>,
    batch_size: usize,
    batch_timeout_ms: u64,
}

impl Batcher {
    /// Creates a new `Batcher`.
    ///
    /// * `receiver`      - Channel endpoint from which incoming events are read.
    /// * `inserter`      - Shared ClickHouse inserter.
    /// * `sqs_consumer`  - Shared SQS consumer used to delete acknowledged messages.
    /// * `dlq_sender`    - Shared DLQ sender for failed batches.
    /// * `queue_url`     - Source SQS queue URL (for message deletion).
    /// * `dlq_url`       - Dead-letter queue URL (if configured).
    /// * `batch_size`    - Optional override of [`DEFAULT_BATCH_SIZE`].
    /// * `batch_timeout_ms` - Optional override of [`DEFAULT_BATCH_TIMEOUT_MS`].
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        receiver: mpsc::Receiver<IncomingEvent>,
        inserter: Arc<ClickHouseInserter>,
        sqs_consumer: Arc<SqsConsumer>,
        dlq_sender: Arc<DlqSender>,
        queue_url: String,
        dlq_url: Option<String>,
        batch_size: Option<usize>,
        batch_timeout_ms: Option<u64>,
    ) -> Self {
        Self {
            receiver,
            inserter,
            sqs_consumer,
            dlq_sender,
            queue_url,
            dlq_url,
            batch_size: batch_size.unwrap_or(DEFAULT_BATCH_SIZE),
            batch_timeout_ms: batch_timeout_ms.unwrap_or(DEFAULT_BATCH_TIMEOUT_MS),
        }
    }

    /// Runs the batcher loop.
    ///
    /// Events are accumulated in a local buffer. A flush is triggered when:
    /// - The buffer reaches [`Self::batch_size`] events, OR
    /// - The timeout interval ([`Self::batch_timeout_ms`]) elapses with a
    ///   non-empty buffer.
    ///
    /// At most [`MAX_IN_FLIGHT`] insert tasks run concurrently. When the limit
    /// is reached the batcher blocks until an in-flight task completes.
    pub async fn run(mut self) -> Result<()> {
        tracing::info!(
            batch_size = self.batch_size,
            batch_timeout_ms = self.batch_timeout_ms,
            max_in_flight = MAX_IN_FLIGHT,
            "batcher started"
        );

        let in_flight = Arc::new(Semaphore::new(MAX_IN_FLIGHT));
        let mut buffer: Vec<IncomingEvent> = Vec::with_capacity(self.batch_size);
        let mut interval =
            tokio::time::interval(std::time::Duration::from_millis(self.batch_timeout_ms));

        // The first tick completes immediately; consume it so we don't flush an
        // empty buffer right away.
        interval.tick().await;

        loop {
            tokio::select! {
                maybe_event = self.receiver.recv() => {
                    match maybe_event {
                        Some(event) => {
                            buffer.push(event);
                            if buffer.len() >= self.batch_size {
                                let batch = std::mem::replace(
                                    &mut buffer,
                                    Vec::with_capacity(self.batch_size),
                                );
                                self.flush_batch(batch, &in_flight).await;
                                // Reset the interval so we get a full timeout
                                // window after a size-triggered flush.
                                interval.reset();
                            }
                        }
                        None => {
                            // All senders dropped -- drain remaining buffer.
                            tracing::info!("all consumer senders dropped, flushing remaining buffer");
                            if !buffer.is_empty() {
                                let batch = std::mem::take(&mut buffer);
                                self.flush_batch(batch, &in_flight).await;
                            }
                            break;
                        }
                    }
                }
                _ = interval.tick() => {
                    if !buffer.is_empty() {
                        let batch = std::mem::replace(
                            &mut buffer,
                            Vec::with_capacity(self.batch_size),
                        );
                        self.flush_batch(batch, &in_flight).await;
                    }
                }
            }
        }

        // Wait for all in-flight tasks to finish before returning.
        let _ = in_flight.acquire_many(MAX_IN_FLIGHT as u32).await;
        tracing::info!("batcher shut down");
        Ok(())
    }

    /// Acquires an in-flight permit and spawns a task that inserts the batch,
    /// handles identity events, deletes SQS messages on success, or routes to
    /// the DLQ on failure.
    async fn flush_batch(&self, batch: Vec<IncomingEvent>, in_flight: &Arc<Semaphore>) {
        let permit = in_flight
            .clone()
            .acquire_owned()
            .await
            .expect("semaphore closed");

        let inserter = Arc::clone(&self.inserter);
        let sqs_consumer = Arc::clone(&self.sqs_consumer);
        let dlq_sender = Arc::clone(&self.dlq_sender);
        let queue_url = self.queue_url.clone();
        let dlq_url = self.dlq_url.clone();

        tokio::spawn(async move {
            let event_count = batch.len();
            tracing::info!(count = event_count, "flushing batch");

            let events: Vec<_> = batch.iter().map(|ie| ie.event.clone()).collect();

            match inserter.insert_batch(&events).await {
                Ok(()) => {
                    tracing::info!(count = event_count, "batch inserted successfully");

                    // Process identify events for identity resolution.
                    for event in &events {
                        if let Err(e) = process_identify_event(inserter.client(), event).await {
                            tracing::error!(
                                error = %e,
                                event_id = %event.event_id,
                                "failed to process identify event"
                            );
                        }
                    }

                    // Delete successfully processed messages from SQS.
                    let entries: Vec<(String, String)> = batch
                        .iter()
                        .enumerate()
                        .map(|(i, ie)| (format!("del_{i}"), ie.receipt_handle.clone()))
                        .collect();

                    if let Err(e) = sqs_consumer.delete_message_batch(&queue_url, entries).await {
                        tracing::error!(
                            error = %e,
                            "failed to delete SQS messages after successful insert"
                        );
                    }
                }
                Err(e) => {
                    tracing::error!(
                        error = %e,
                        count = event_count,
                        "batch insert failed after retries"
                    );

                    // Route each event to DLQ if configured.
                    if let Some(ref dlq_url) = dlq_url {
                        for incoming in &batch {
                            if let Err(dlq_err) = dlq_sender
                                .send_to_dlq(
                                    dlq_url,
                                    &incoming.raw_body,
                                    &format!("insert failure: {e}"),
                                )
                                .await
                            {
                                tracing::error!(error = %dlq_err, "failed to send to DLQ");
                            }
                        }
                    }

                    // Delete from source queue to avoid infinite reprocessing.
                    let entries: Vec<(String, String)> = batch
                        .iter()
                        .enumerate()
                        .map(|(i, ie)| (format!("del_{i}"), ie.receipt_handle.clone()))
                        .collect();

                    if let Err(del_err) =
                        sqs_consumer.delete_message_batch(&queue_url, entries).await
                    {
                        tracing::error!(
                            error = %del_err,
                            "failed to delete SQS messages after DLQ routing"
                        );
                    }
                }
            }

            drop(permit);
        });
    }
}
