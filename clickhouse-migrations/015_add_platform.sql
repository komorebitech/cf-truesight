ALTER TABLE truesight.events ADD COLUMN IF NOT EXISTS platform LowCardinality(String) DEFAULT '' AFTER sdk_version;
