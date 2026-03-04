-- Add environment column to all tables (default 'live' for backward compatibility)

ALTER TABLE truesight_local.events
    ADD COLUMN IF NOT EXISTS environment LowCardinality(String) DEFAULT 'live';

ALTER TABLE truesight_local.events_hourly
    ADD COLUMN IF NOT EXISTS environment LowCardinality(String) DEFAULT 'live';

ALTER TABLE truesight_local.users_daily
    ADD COLUMN IF NOT EXISTS environment LowCardinality(String) DEFAULT 'live';

ALTER TABLE truesight_local.user_first_seen
    ADD COLUMN IF NOT EXISTS environment LowCardinality(String) DEFAULT 'live';
