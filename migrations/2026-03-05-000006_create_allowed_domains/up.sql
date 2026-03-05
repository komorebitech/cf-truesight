CREATE TABLE allowed_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    default_role team_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(team_id, domain)
);

CREATE INDEX idx_allowed_domains_team_id ON allowed_domains (team_id);
CREATE INDEX idx_allowed_domains_domain ON allowed_domains (domain);
