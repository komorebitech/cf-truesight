CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    prefix VARCHAR(8) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    label VARCHAR(255) NOT NULL,
    environment VARCHAR(4) NOT NULL CHECK (environment IN ('live', 'test')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
