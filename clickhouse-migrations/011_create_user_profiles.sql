-- User profiles table: stores aggregated user data from events and identify calls.
-- ReplacingMergeTree deduplicates by last_seen so we always get the latest profile.

CREATE TABLE IF NOT EXISTS truesight.user_profiles (
    project_id UUID,
    user_uid String,
    properties Map(String, String),
    email Nullable(String),
    name Nullable(String),
    mobile_number Nullable(String),
    first_seen DateTime64(3),
    last_seen DateTime64(3),
    event_count UInt64 DEFAULT 0,
    environment LowCardinality(String) DEFAULT 'live'
) ENGINE = ReplacingMergeTree(last_seen)
ORDER BY (project_id, environment, user_uid);
