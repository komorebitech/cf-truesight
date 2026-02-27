CREATE DATABASE IF NOT EXISTS truesight_local;

CREATE TABLE IF NOT EXISTS truesight_local.events
(
    event_id UUID,
    project_id UUID,
    event_name LowCardinality(String),
    event_type LowCardinality(String),
    user_id Nullable(String),
    anonymous_id String,
    mobile_number Nullable(String),
    email Nullable(String),
    client_timestamp DateTime64(3),
    server_timestamp DateTime64(3),
    properties String DEFAULT '{}',
    app_version Nullable(String),
    os_name LowCardinality(String),
    os_version String,
    device_model LowCardinality(String),
    device_id String,
    network_type LowCardinality(Nullable(String)),
    locale String,
    timezone String,
    sdk_version LowCardinality(String)
)
ENGINE = ReplacingMergeTree(server_timestamp)
PARTITION BY toYYYYMM(server_timestamp)
ORDER BY (project_id, event_name, server_timestamp, event_id)
TTL toDateTime(server_timestamp) + INTERVAL 12 MONTH;
