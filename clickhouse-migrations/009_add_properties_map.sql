-- Add a Map column for queryable event properties.
-- The DEFAULT expression auto-populates from the existing JSON String column
-- for new inserts that don't explicitly set properties_map.

ALTER TABLE truesight.events
  ADD COLUMN IF NOT EXISTS properties_map Map(String, String)
  DEFAULT CAST(
    JSONExtractKeysAndValues(if(properties = '', '{}', properties), 'String'),
    'Map(String, String)'
  );

ALTER TABLE truesight.events
  ADD INDEX IF NOT EXISTS idx_props_keys mapKeys(properties_map) TYPE bloom_filter GRANULARITY 4;

ALTER TABLE truesight.events
  ADD INDEX IF NOT EXISTS idx_props_values mapValues(properties_map) TYPE bloom_filter GRANULARITY 4;
