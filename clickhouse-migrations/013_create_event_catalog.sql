-- ============================================================
-- 013: Event Catalog summary tables + materialized views
-- ============================================================

-- Table: event_catalog (unique event names with counts and timestamps)
CREATE TABLE IF NOT EXISTS truesight.event_catalog (
    project_id UUID,
    event_name LowCardinality(String),
    event_type LowCardinality(String),
    environment LowCardinality(String) DEFAULT 'live',
    event_count SimpleAggregateFunction(sum, UInt64),
    first_seen SimpleAggregateFunction(min, DateTime64(3)),
    last_seen SimpleAggregateFunction(max, DateTime64(3))
) ENGINE = AggregatingMergeTree()
ORDER BY (project_id, environment, event_name, event_type);

-- Table: event_property_keys (unique property keys per event name)
CREATE TABLE IF NOT EXISTS truesight.event_property_keys (
    project_id UUID,
    event_name LowCardinality(String),
    environment LowCardinality(String) DEFAULT 'live',
    property_key String,
    first_seen SimpleAggregateFunction(min, DateTime64(3))
) ENGINE = AggregatingMergeTree()
ORDER BY (project_id, environment, event_name, property_key);

-- Materialized view: event_catalog_mv
CREATE MATERIALIZED VIEW IF NOT EXISTS truesight.event_catalog_mv
TO truesight.event_catalog AS
SELECT
    project_id,
    event_name,
    event_type,
    environment,
    count() AS event_count,
    min(server_timestamp) AS first_seen,
    max(server_timestamp) AS last_seen
FROM truesight.events
GROUP BY project_id, event_name, event_type, environment;

-- Materialized view: event_property_keys_mv
CREATE MATERIALIZED VIEW IF NOT EXISTS truesight.event_property_keys_mv
TO truesight.event_property_keys AS
SELECT
    project_id,
    event_name,
    environment,
    arrayJoin(mapKeys(properties_map)) AS property_key,
    min(server_timestamp) AS first_seen
FROM truesight.events
WHERE length(mapKeys(properties_map)) > 0
GROUP BY project_id, event_name, environment, property_key;

-- Backfill event_catalog from existing data
INSERT INTO truesight.event_catalog
SELECT
    project_id,
    event_name,
    event_type,
    environment,
    count() AS event_count,
    min(server_timestamp) AS first_seen,
    max(server_timestamp) AS last_seen
FROM truesight.events
GROUP BY project_id, event_name, event_type, environment;

-- Backfill event_property_keys from existing data
INSERT INTO truesight.event_property_keys
SELECT
    project_id,
    event_name,
    environment,
    arrayJoin(mapKeys(properties_map)) AS property_key,
    min(server_timestamp) AS first_seen
FROM truesight.events
WHERE length(mapKeys(properties_map)) > 0
GROUP BY project_id, event_name, environment, property_key;

-- Optimize both tables to merge aggregated data
OPTIMIZE TABLE truesight.event_catalog FINAL;

OPTIMIZE TABLE truesight.event_property_keys FINAL;
