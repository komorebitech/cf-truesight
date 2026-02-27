CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);
CREATE INDEX idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX idx_projects_active ON projects(active) WHERE active = true;
CREATE INDEX idx_api_keys_active_prefix ON api_keys(prefix) WHERE active = true;
