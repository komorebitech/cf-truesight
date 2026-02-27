//! Dead-letter queue (DLQ) sender for failed messages.
//!
//! When an event cannot be inserted into ClickHouse after exhausting retries the
//! original SQS message body is forwarded to a DLQ so it can be investigated and
//! replayed later.

use anyhow::{Context, Result};
use aws_sdk_sqs::Client;
use aws_sdk_sqs::config::Region;
use aws_sdk_sqs::types::MessageAttributeValue;

/// Wraps an SQS client for sending messages to a dead-letter queue.
pub struct DlqSender {
    client: Client,
}

impl DlqSender {
    /// Creates a new `DlqSender` from an existing SQS [`Client`].
    #[allow(dead_code)]
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    /// Creates a new `DlqSender` by building an SQS client from the given
    /// region and optional endpoint URL.
    pub async fn from_config(region: &str, endpoint_url: Option<&str>) -> Result<Self> {
        let mut config_loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(Region::new(region.to_string()));

        if let Some(endpoint) = endpoint_url {
            config_loader = config_loader.endpoint_url(endpoint);
        }

        let sdk_config = config_loader.load().await;
        let client = Client::new(&sdk_config);

        Ok(Self { client })
    }

    /// Sends a failed message to the specified DLQ.
    ///
    /// The original `message_body` is preserved as-is. An additional message
    /// attribute `error_reason` is attached so operators can quickly triage
    /// failures without parsing the body.
    pub async fn send_to_dlq(
        &self,
        queue_url: &str,
        message_body: &str,
        error_reason: &str,
    ) -> Result<()> {
        let error_attr = MessageAttributeValue::builder()
            .data_type("String")
            .string_value(error_reason)
            .build()
            .context("failed to build error_reason attribute")?;

        self.client
            .send_message()
            .queue_url(queue_url)
            .message_body(message_body)
            .message_attributes("error_reason", error_attr)
            .send()
            .await
            .context("failed to send message to DLQ")?;

        tracing::warn!(queue_url, error_reason, "sent failed message to DLQ");

        Ok(())
    }
}
