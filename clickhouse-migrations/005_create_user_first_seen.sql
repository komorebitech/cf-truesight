-- User first seen aggregation table
CREATE TABLE IF NOT EXISTS truesight_local.user_first_seen (
    project_id UUID,
    user_uid String,
    first_seen_date SimpleAggregateFunction(min, Date)
) ENGINE = AggregatingMergeTree()
ORDER BY (project_id, user_uid);

CREATE MATERIALIZED VIEW IF NOT EXISTS truesight_local.user_first_seen_mv
TO truesight_local.user_first_seen
AS SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    toDate(min(server_timestamp)) AS first_seen_date
FROM truesight_local.events
GROUP BY project_id, user_uid;

-- Backfill existing data
INSERT INTO truesight_local.user_first_seen
SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    toDate(min(server_timestamp)) AS first_seen_date
FROM truesight_local.events
GROUP BY project_id, user_uid;
