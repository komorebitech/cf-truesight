-- Fix: COALESCE(user_id, anonymous_id) returns '' when user_id is empty string.
-- Use NULLIF(user_id, '') so empty strings are treated as NULL and fall through to anonymous_id.

-- 1. Drop old materialized views (they use the buggy COALESCE)
DROP VIEW IF EXISTS truesight_local.users_daily_mv;
DROP VIEW IF EXISTS truesight_local.user_first_seen_mv;

-- 2. Truncate target tables to remove stale data with empty user_uid
TRUNCATE TABLE truesight_local.users_daily;
TRUNCATE TABLE truesight_local.user_first_seen;

-- 3. Recreate MVs with the fixed COALESCE(NULLIF(...))
CREATE MATERIALIZED VIEW truesight_local.users_daily_mv
TO truesight_local.users_daily
AS SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    toDate(server_timestamp) AS event_date
FROM truesight_local.events
GROUP BY ALL;

CREATE MATERIALIZED VIEW truesight_local.user_first_seen_mv
TO truesight_local.user_first_seen
AS SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    toDate(min(server_timestamp)) AS first_seen_date
FROM truesight_local.events
GROUP BY project_id, user_uid;

-- 4. Backfill users_daily from existing events
INSERT INTO truesight_local.users_daily
SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    toDate(server_timestamp) AS event_date
FROM truesight_local.events
GROUP BY ALL;

OPTIMIZE TABLE truesight_local.users_daily FINAL;

-- 5. Backfill user_first_seen from existing events
INSERT INTO truesight_local.user_first_seen
SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    toDate(min(server_timestamp)) AS first_seen_date
FROM truesight_local.events
GROUP BY project_id, user_uid;

OPTIMIZE TABLE truesight_local.user_first_seen FINAL;
