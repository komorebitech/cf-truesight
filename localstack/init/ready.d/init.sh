#!/bin/bash
set -euo pipefail

echo "Creating SQS queues..."

# Create Dead Letter Queue first
awslocal sqs create-queue \
  --queue-name truesight-events-dlq-local \
  --attributes '{
    "MessageRetentionPeriod": "1209600"
  }'

DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/truesight-events-dlq-local \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

# Create main events queue with DLQ redrive policy
awslocal sqs create-queue \
  --queue-name truesight-events-local \
  --attributes "{
    \"VisibilityTimeout\": \"300\",
    \"MessageRetentionPeriod\": \"345600\",
    \"ReceiveMessageWaitTimeSeconds\": \"20\",
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"${DLQ_ARN}\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"
  }"

echo "SQS queues created successfully"
