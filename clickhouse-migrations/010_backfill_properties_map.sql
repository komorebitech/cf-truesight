-- Backfill properties_map for existing rows.
-- This triggers a mutation that rewrites parts to materialise the DEFAULT expression.

ALTER TABLE truesight_local.events
  UPDATE properties_map = CAST(
    JSONExtractKeysAndValues(if(properties = '', '{}', properties), 'String'),
    'Map(String, String)'
  )
  WHERE properties != '' AND properties != '{}';
