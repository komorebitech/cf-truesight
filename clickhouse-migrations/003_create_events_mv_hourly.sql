CREATE TABLE IF NOT EXISTS truesight.events_hourly
(
    project_id UUID,
    event_name LowCardinality(String),
    event_type LowCardinality(String),
    hour DateTime,
    count UInt64
)
ENGINE = SummingMergeTree()
ORDER BY (project_id, event_name, event_type, hour);

CREATE MATERIALIZED VIEW IF NOT EXISTS truesight.events_hourly_mv
TO truesight.events_hourly
AS
SELECT
    project_id,
    event_name,
    event_type,
    toStartOfHour(server_timestamp) AS hour,
    count() AS count
FROM truesight.events
GROUP BY ALL;
