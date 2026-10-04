-- Migration: 20261004120000_create_login_attempts.sql
-- Tabela de tentativas de login com suporte a RLS e rate limiting por conta.

CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    ip VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
    success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_tenant_email_created
    ON login_attempts (tenant_id, email, created_at);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_login_attempts ON login_attempts;
CREATE POLICY tenant_isolation_login_attempts ON login_attempts
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());
