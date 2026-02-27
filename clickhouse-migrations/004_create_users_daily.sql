-- Daily unique users materialized view
CREATE TABLE IF NOT EXISTS truesight_local.users_daily (
    project_id UUID,
    user_uid String,
    event_date Date
) ENGINE = ReplacingMergeTree()
ORDER BY (project_id, event_date, user_uid);

CREATE MATERIALIZED VIEW IF NOT EXISTS truesight_local.users_daily_mv
TO truesight_local.users_daily
AS SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    toDate(server_timestamp) AS event_date
FROM truesight_local.events
GROUP BY ALL;

-- Backfill existing data
INSERT INTO truesight_local.users_daily
SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    toDate(server_timestamp) AS event_date
FROM truesight_local.events
GROUP BY ALL;
