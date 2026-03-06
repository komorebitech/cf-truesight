DROP VIEW IF EXISTS cohorts;
ALTER TABLE segments DROP COLUMN segment_type;
ALTER TABLE segments RENAME TO cohorts;
