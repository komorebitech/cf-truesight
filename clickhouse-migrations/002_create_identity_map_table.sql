CREATE DATABASE IF NOT EXISTS truesight_local;

CREATE TABLE IF NOT EXISTS truesight_local.identity_map
(
    project_id UUID,
    anonymous_id String,
    user_id String,
    first_seen DateTime64(3),
    last_seen DateTime64(3)
)
ENGINE = ReplacingMergeTree(last_seen)
PARTITION BY toYYYYMM(first_seen)
ORDER BY (project_id, anonymous_id);
