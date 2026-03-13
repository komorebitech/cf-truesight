-- ============================================================
-- 017: Backfill materialized view tables with identity-resolved data
-- ============================================================
-- The users_daily, user_first_seen, and user_stats tables contain
-- duplicate entries for users who were anonymous before identifying:
-- one row with user_uid = anonymous_id, another with user_uid = user_id.
-- This migration re-backfills these tables with identity_map-resolved
-- user_uids so the duplicates are merged into a single entry.
--
-- The materialized views are NOT changed — query-time identity
-- resolution handles ongoing data correctly.

-- ============================================================
-- 1. Re-backfill users_daily
-- ============================================================
TRUNCATE TABLE truesight.users_daily;

INSERT INTO truesight.users_daily
    (project_id, user_uid, environment, event_date)
SELECT
    e.project_id,
    COALESCE(m.user_id, NULLIF(e.user_id, ''), e.anonymous_id) AS user_uid,
    e.environment,
    toDate(e.server_timestamp) AS event_date
FROM truesight.events AS e
LEFT JOIN truesight.identity_map FINAL AS m
    ON m.project_id = e.project_id AND m.anonymous_id = e.anonymous_id
GROUP BY ALL;

-- ============================================================
-- 2. Re-backfill user_first_seen
-- ============================================================
TRUNCATE TABLE truesight.user_first_seen;

INSERT INTO truesight.user_first_seen
    (project_id, user_uid, environment, first_seen_date)
SELECT
    e.project_id,
    COALESCE(m.user_id, NULLIF(e.user_id, ''), e.anonymous_id) AS user_uid,
    e.environment,
    toDate(min(e.server_timestamp)) AS first_seen_date
FROM truesight.events AS e
LEFT JOIN truesight.identity_map FINAL AS m
    ON m.project_id = e.project_id AND m.anonymous_id = e.anonymous_id
GROUP BY e.project_id, user_uid, e.environment;

-- ============================================================
-- 3. Re-backfill user_stats
-- ============================================================
TRUNCATE TABLE truesight.user_stats;

INSERT INTO truesight.user_stats
    (project_id, user_uid, environment, event_count, first_seen, last_seen)
SELECT
    e.project_id,
    COALESCE(m.user_id, NULLIF(e.user_id, ''), e.anonymous_id) AS user_uid,
    e.environment,
    count() AS event_count,
    min(e.server_timestamp) AS first_seen,
    max(e.server_timestamp) AS last_seen
FROM truesight.events AS e
LEFT JOIN truesight.identity_map FINAL AS m
    ON m.project_id = e.project_id AND m.anonymous_id = e.anonymous_id
GROUP BY e.project_id, user_uid, e.environment;

OPTIMIZE TABLE truesight.users_daily FINAL;
OPTIMIZE TABLE truesight.user_first_seen FINAL;
OPTIMIZE TABLE truesight.user_stats FINAL;

-- ============================================================
-- 4. Clean up orphaned user_profiles
-- ============================================================
-- Delete profiles keyed by anonymous_id that have been resolved
-- to a user_id via identity_map. The identify event already created
-- the authoritative profile under user_id.
ALTER TABLE truesight.user_profiles DELETE WHERE
    (project_id, user_uid) IN (
        SELECT project_id, anonymous_id
        FROM truesight.identity_map FINAL
    );
