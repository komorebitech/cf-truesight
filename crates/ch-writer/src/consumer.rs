//! SQS consumer loop.
//!
//! Each [`ConsumerLoop`] long-polls SQS for messages, deserialises them into
//! [`EnrichedEvent`]s, and forwards them through a `tokio::mpsc` channel to the
//! batcher. On deserialisation failure the raw message body is sent to the DLQ.

use anyhow::Result;
use tokio::sync::mpsc;
use truesight_common::event::EnrichedEvent;
use truesight_common::sqs::SqsConsumer;

use crate::dlq::DlqSender;

/// A message that has been successfully deserialised, carrying the original SQS
/// receipt handle so that the batcher can acknowledge it after a successful
/// insert.
#[derive(Debug)]
pub struct IncomingEvent {
    pub event: EnrichedEvent,
    /// Opaque receipt handle used to delete the message from SQS after the
    /// batch has been persisted.
    pub receipt_handle: String,
    /// Original raw message body, retained so it can be forwarded to the DLQ
    /// if insertion ultimately fails.
    pub raw_body: String,
}

/// Continuously polls SQS and forwards deserialised events to the batcher.
pub struct ConsumerLoop {
    consumer: SqsConsumer,
    queue_url: String,
    sender: mpsc::Sender<IncomingEvent>,
    dlq_sender: DlqSender,
    dlq_url: Option<String>,
    receive_batch_size: i32,
}

impl ConsumerLoop {
    /// Creates a new consumer loop.
    ///
    /// * `consumer`           - The shared SQS consumer client.
    /// * `queue_url`          - URL of the source SQS queue.
    /// * `sender`             - Channel to the batcher.
    /// * `dlq_sender`         - Client for sending failed messages to the DLQ.
    /// * `dlq_url`            - URL of the dead-letter queue (if configured).
    /// * `receive_batch_size` - Maximum number of messages per `ReceiveMessage` call.
    pub fn new(
        consumer: SqsConsumer,
        queue_url: String,
        sender: mpsc::Sender<IncomingEvent>,
        dlq_sender: DlqSender,
        dlq_url: Option<String>,
        receive_batch_size: i32,
    ) -> Self {
        Self {
            consumer,
            queue_url,
            sender,
            dlq_sender,
            dlq_url,
            receive_batch_size,
        }
    }

    /// Runs the consumer loop until the provided cancellation token is
    /// triggered.
    ///
    /// The loop long-polls SQS with a 20-second wait time. Each received
    /// message is deserialised; on failure the raw body is forwarded to the
    /// DLQ (if configured) and the message is deleted from the source queue to
    /// avoid reprocessing poison pills.
    pub async fn run(self, cancel: tokio::sync::watch::Receiver<bool>) -> Result<()> {
        tracing::info!(queue_url = %self.queue_url, "consumer loop started");

        loop {
            if *cancel.borrow() {
                tracing::info!("consumer loop received shutdown signal");
                break;
            }

            let messages = match self
                .consumer
                .receive_messages(&self.queue_url, self.receive_batch_size, 20)
                .await
            {
                Ok(msgs) => msgs,
                Err(e) => {
                    tracing::error!(error = %e, "failed to receive SQS messages");
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    continue;
                }
            };

            if messages.is_empty() {
                continue;
            }

            tracing::debug!(count = messages.len(), "received SQS messages");

            for msg in messages {
                let body = match msg.body() {
                    Some(b) => b.to_string(),
                    None => {
                        tracing::warn!("received SQS message with no body, skipping");
                        continue;
                    }
                };

                let receipt_handle = match msg.receipt_handle() {
                    Some(rh) => rh.to_string(),
                    None => {
                        tracing::warn!("received SQS message with no receipt handle, skipping");
                        continue;
                    }
                };

                match serde_json::from_str::<EnrichedEvent>(&body) {
                    Ok(event) => {
                        let incoming = IncomingEvent {
                            event,
                            receipt_handle,
                            raw_body: body,
                        };

                        if let Err(e) = self.sender.send(incoming).await {
                            tracing::error!(error = %e, "batcher channel closed, stopping consumer");
                            return Err(anyhow::anyhow!("batcher channel closed"));
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            error = %e,
                            body_preview = %body.chars().take(200).collect::<String>(),
                            "failed to deserialise SQS message"
                        );

                        // Send to DLQ if configured.
                        if let Some(ref dlq_url) = self.dlq_url
                            && let Err(dlq_err) = self
                                .dlq_sender
                                .send_to_dlq(dlq_url, &body, &format!("deserialisation error: {e}"))
                                .await
                        {
                            tracing::error!(error = %dlq_err, "failed to send to DLQ");
                        }

                        // Delete the poison-pill from the source queue.
                        if let Err(del_err) = self
                            .consumer
                            .delete_message(&self.queue_url, &receipt_handle)
                            .await
                        {
                            tracing::error!(error = %del_err, "failed to delete poison message");
                        }
                    }
                }
            }
        }

        Ok(())
    }
}
