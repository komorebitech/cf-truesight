CREATE TABLE team_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(team_id, project_id)
);

CREATE INDEX idx_team_projects_team_id ON team_projects (team_id);
CREATE INDEX idx_team_projects_project_id ON team_projects (project_id);
