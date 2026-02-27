use anyhow::{Context, Result};
pub use aws_sdk_sqs::types::Message;
use aws_sdk_sqs::types::{
    BatchResultErrorEntry, DeleteMessageBatchRequestEntry, MessageAttributeValue,
    SendMessageBatchRequestEntry,
};
use aws_sdk_sqs::{Client, config::Region};

use crate::event::EnrichedEvent;

pub struct SqsProducer {
    client: Client,
}

impl SqsProducer {
    /// Creates a new SQS producer. If `endpoint_url` is provided, it overrides the default
    /// AWS endpoint (useful for local development with LocalStack).
    pub async fn new(region: &str, endpoint_url: Option<&str>) -> Result<Self> {
        let mut config_loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(Region::new(region.to_string()));

        if let Some(endpoint) = endpoint_url {
            config_loader = config_loader.endpoint_url(endpoint);
        }

        let sdk_config = config_loader.load().await;
        let client = Client::new(&sdk_config);

        Ok(Self { client })
    }

    /// Returns a reference to the underlying SQS client (useful for health checks).
    pub fn client(&self) -> &Client {
        &self.client
    }

    /// Sends a batch of enriched events to the given SQS queue.
    /// SQS allows at most 10 messages per `SendMessageBatch` call, so this
    /// method chunks the events accordingly.
    pub async fn send_batch(&self, events: &[EnrichedEvent], queue_url: &str) -> Result<()> {
        for chunk in events.chunks(10) {
            let mut entries = Vec::with_capacity(chunk.len());

            for (i, event) in chunk.iter().enumerate() {
                let body =
                    serde_json::to_string(event).context("Failed to serialize EnrichedEvent")?;

                let project_id_attr = MessageAttributeValue::builder()
                    .data_type("String")
                    .string_value(event.project_id.to_string())
                    .build()
                    .context("Failed to build project_id attribute")?;

                let event_type_attr = MessageAttributeValue::builder()
                    .data_type("String")
                    .string_value(
                        serde_json::to_string(&event.event_type)
                            .unwrap_or_default()
                            .trim_matches('"')
                            .to_string(),
                    )
                    .build()
                    .context("Failed to build event_type attribute")?;

                let event_id_attr = MessageAttributeValue::builder()
                    .data_type("String")
                    .string_value(event.event_id.to_string())
                    .build()
                    .context("Failed to build event_id attribute")?;

                let entry = SendMessageBatchRequestEntry::builder()
                    .id(format!("msg_{}", i))
                    .message_body(body)
                    .message_attributes("project_id", project_id_attr)
                    .message_attributes("event_type", event_type_attr)
                    .message_attributes("event_id", event_id_attr)
                    .build()
                    .context("Failed to build SendMessageBatchRequestEntry")?;

                entries.push(entry);
            }

            let result = self
                .client
                .send_message_batch()
                .queue_url(queue_url)
                .set_entries(Some(entries))
                .send()
                .await
                .context("SQS SendMessageBatch failed")?;

            let failed: &[BatchResultErrorEntry] = &result.failed;
            if !failed.is_empty() {
                let ids: Vec<String> = failed.iter().map(|f| f.id().to_string()).collect();
                tracing::error!(
                    failed_ids = ?ids,
                    "Some SQS messages failed to send"
                );
                return Err(anyhow::anyhow!(
                    "Failed to send {} messages to SQS",
                    failed.len()
                ));
            }
        }

        Ok(())
    }
}

pub struct SqsConsumer {
    client: Client,
}

impl SqsConsumer {
    /// Creates a new SQS consumer. If `endpoint_url` is provided, it overrides the default
    /// AWS endpoint (useful for local development with LocalStack).
    pub async fn new(region: &str, endpoint_url: Option<&str>) -> Result<Self> {
        let mut config_loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(Region::new(region.to_string()));

        if let Some(endpoint) = endpoint_url {
            config_loader = config_loader.endpoint_url(endpoint);
        }

        let sdk_config = config_loader.load().await;
        let client = Client::new(&sdk_config);

        Ok(Self { client })
    }

    /// Receives messages from the given SQS queue.
    pub async fn receive_messages(
        &self,
        queue_url: &str,
        max: i32,
        wait_secs: i32,
    ) -> Result<Vec<Message>> {
        let output = self
            .client
            .receive_message()
            .queue_url(queue_url)
            .max_number_of_messages(max)
            .wait_time_seconds(wait_secs)
            .message_attribute_names("All")
            .send()
            .await
            .context("SQS ReceiveMessage failed")?;

        Ok(output.messages.unwrap_or_default())
    }

    /// Deletes a single message from the queue using its receipt handle.
    pub async fn delete_message(&self, queue_url: &str, receipt_handle: &str) -> Result<()> {
        self.client
            .delete_message()
            .queue_url(queue_url)
            .receipt_handle(receipt_handle)
            .send()
            .await
            .context("SQS DeleteMessage failed")?;

        Ok(())
    }

    /// Deletes a batch of messages from the queue.
    /// `entries` is a vector of `(id, receipt_handle)` pairs.
    pub async fn delete_message_batch(
        &self,
        queue_url: &str,
        entries: Vec<(String, String)>,
    ) -> Result<()> {
        for chunk in entries.chunks(10) {
            let delete_entries: Vec<DeleteMessageBatchRequestEntry> = chunk
                .iter()
                .map(|(id, receipt_handle)| {
                    DeleteMessageBatchRequestEntry::builder()
                        .id(id)
                        .receipt_handle(receipt_handle)
                        .build()
                        .expect("Failed to build DeleteMessageBatchRequestEntry")
                })
                .collect();

            self.client
                .delete_message_batch()
                .queue_url(queue_url)
                .set_entries(Some(delete_entries))
                .send()
                .await
                .context("SQS DeleteMessageBatch failed")?;
        }

        Ok(())
    }
}
