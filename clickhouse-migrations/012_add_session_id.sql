ALTER TABLE truesight_local.events
    ADD COLUMN IF NOT EXISTS session_id Nullable(String) AFTER environment;
