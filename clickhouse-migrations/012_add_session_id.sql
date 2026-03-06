ALTER TABLE {database}.events
    ADD COLUMN IF NOT EXISTS session_id Nullable(String) AFTER environment;
