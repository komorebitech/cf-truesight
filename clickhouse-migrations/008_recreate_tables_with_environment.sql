-- Recreate aggregate tables with environment in ORDER BY and rebuild materialized views.
-- The events table keeps its original ORDER BY (environment added as a column in 007).

-- ============================================================
-- 1. Drop materialized views (must happen before table renames)
-- ============================================================
DROP VIEW IF EXISTS truesight.events_hourly_mv;
DROP VIEW IF EXISTS truesight.users_daily_mv;
DROP VIEW IF EXISTS truesight.user_first_seen_mv;

-- ============================================================
-- 2. Rename existing tables to *_backup
-- ============================================================
RENAME TABLE truesight.events_hourly TO truesight.events_hourly_backup;
RENAME TABLE truesight.users_daily TO truesight.users_daily_backup;
RENAME TABLE truesight.user_first_seen TO truesight.user_first_seen_backup;

-- ============================================================
-- 3. Create new tables with environment in ORDER BY
-- ============================================================
CREATE TABLE truesight.events_hourly
(
    project_id UUID,
    event_name LowCardinality(String),
    event_type LowCardinality(String),
    environment LowCardinality(String) DEFAULT 'live',
    hour DateTime,
    count UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (project_id, event_name, event_type, environment, hour);

CREATE TABLE truesight.users_daily (
    project_id UUID,
    user_uid String,
    environment LowCardinality(String) DEFAULT 'live',
    event_date Date
) ENGINE = ReplacingMergeTree()
ORDER BY (project_id, event_date, environment, user_uid);

CREATE TABLE truesight.user_first_seen (
    project_id UUID,
    user_uid String,
    environment LowCardinality(String) DEFAULT 'live',
    first_seen_date SimpleAggregateFunction(min, Date)
) ENGINE = AggregatingMergeTree()
ORDER BY (project_id, environment, user_uid);

-- ============================================================
-- 4. Backfill from backup tables (all existing data is 'live')
-- ============================================================
INSERT INTO truesight.events_hourly
    (project_id, event_name, event_type, environment, hour, count)
SELECT
    project_id, event_name, event_type, 'live' AS environment, hour, count
FROM truesight.events_hourly_backup;

INSERT INTO truesight.users_daily
    (project_id, user_uid, environment, event_date)
SELECT
    project_id, user_uid, 'live' AS environment, event_date
FROM truesight.users_daily_backup;

INSERT INTO truesight.user_first_seen
    (project_id, user_uid, environment, first_seen_date)
SELECT
    project_id, user_uid, 'live' AS environment, first_seen_date
FROM truesight.user_first_seen_backup;

-- ============================================================
-- 5. Drop backup tables
-- ============================================================
DROP TABLE truesight.events_hourly_backup;
DROP TABLE truesight.users_daily_backup;
DROP TABLE truesight.user_first_seen_backup;

-- ============================================================
-- 6. Recreate materialized views with environment
-- ============================================================
CREATE MATERIALIZED VIEW truesight.events_hourly_mv
TO truesight.events_hourly
AS SELECT
    project_id,
    event_name,
    event_type,
    environment,
    toStartOfHour(server_timestamp) AS hour,
    count() AS count
FROM truesight.events
GROUP BY ALL;

CREATE MATERIALIZED VIEW truesight.users_daily_mv
TO truesight.users_daily
AS SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    environment,
    toDate(server_timestamp) AS event_date
FROM truesight.events
GROUP BY ALL;

CREATE MATERIALIZED VIEW truesight.user_first_seen_mv
TO truesight.user_first_seen
AS SELECT
    project_id,
    COALESCE(NULLIF(user_id, ''), anonymous_id) AS user_uid,
    environment,
    toDate(min(server_timestamp)) AS first_seen_date
FROM truesight.events
GROUP BY project_id, user_uid, environment;
