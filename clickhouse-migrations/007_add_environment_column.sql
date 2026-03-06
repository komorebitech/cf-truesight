-- Add environment column to all tables (default 'live' for backward compatibility)

ALTER TABLE truesight.events
    ADD COLUMN IF NOT EXISTS environment LowCardinality(String) DEFAULT 'live';

ALTER TABLE truesight.events_hourly
    ADD COLUMN IF NOT EXISTS environment LowCardinality(String) DEFAULT 'live';

ALTER TABLE truesight.users_daily
    ADD COLUMN IF NOT EXISTS environment LowCardinality(String) DEFAULT 'live';

ALTER TABLE truesight.user_first_seen
    ADD COLUMN IF NOT EXISTS environment LowCardinality(String) DEFAULT 'live';
