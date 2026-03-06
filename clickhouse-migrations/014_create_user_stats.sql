-- ============================================================
-- 014: User stats table with accurate event counts
-- ============================================================
-- The user_profiles table uses ReplacingMergeTree which is correct
-- for identity resolution (email, name, etc.) but cannot sum
-- event_count across rows. This table uses AggregatingMergeTree
-- to maintain accurate per-user aggregations.

CREATE TABLE IF NOT EXISTS truesight.user_stats (
    project_id UUID,
    user_uid String,
    environment LowCardinality(String) DEFAULT 'live',
    event_count SimpleAggregateFunction(sum, UInt64),
    first_seen SimpleAggregateFunction(min, DateTime64(3)),
    last_seen SimpleAggregateFunction(max, DateTime64(3))
) ENGINE = AggregatingMergeTree()
ORDER BY (project_id, environment, user_uid);

-- Materialized view: auto-populate user_stats from new events
CREATE MATERIALIZED VIEW IF NOT EXISTS truesight.user_stats_mv
TO truesight.user_stats AS
SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    environment,
    count() AS event_count,
    min(server_timestamp) AS first_seen,
    max(server_timestamp) AS last_seen
FROM truesight.events
GROUP BY project_id, user_uid, environment;

-- Backfill from existing events
INSERT INTO truesight.user_stats
SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    environment,
    count() AS event_count,
    min(server_timestamp) AS first_seen,
    max(server_timestamp) AS last_seen
FROM truesight.events
GROUP BY project_id, user_uid, environment;

-- Optimize to merge aggregated data
OPTIMIZE TABLE truesight.user_stats FINAL;
