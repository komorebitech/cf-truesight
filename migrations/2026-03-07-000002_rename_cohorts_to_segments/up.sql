ALTER TABLE cohorts RENAME TO segments;
ALTER TABLE segments ADD COLUMN segment_type VARCHAR(50) NOT NULL DEFAULT 'manual';
-- Keep backward-compat view
CREATE VIEW cohorts AS SELECT id, project_id, name, description, definition, created_at, updated_at FROM segments;
