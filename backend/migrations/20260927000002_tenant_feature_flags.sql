-- Migration: Tenant Feature Flags

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, feature_name)
);

-- Seed default for all existing tenants (disable TRI by default)
INSERT INTO tenant_feature_flags (tenant_id, feature_name, is_enabled)
SELECT id, 'module_tri', false FROM tenants
ON CONFLICT DO NOTHING;

