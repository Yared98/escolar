-- Migration: Identidade visual da escola (tenant_branding)

CREATE TABLE IF NOT EXISTS tenant_branding (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    cor_primaria CHAR(7) NOT NULL DEFAULT '#2d5338' CHECK (cor_primaria ~ '^#[0-9a-f]{6}$'),
    cor_destaque CHAR(7) NOT NULL DEFAULT '#f59e0b' CHECK (cor_destaque ~ '^#[0-9a-f]{6}$'),
    nome_exibicao VARCHAR(120),
    logo BYTEA,
    logo_mime VARCHAR(20) CHECK (logo_mime IN ('image/png', 'image/jpeg', 'image/webp')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_tenant_branding_logo_size CHECK (logo IS NULL OR octet_length(logo) <= 262144),
    CONSTRAINT chk_tenant_branding_logo_mime_pair CHECK ((logo IS NULL) = (logo_mime IS NULL))
);

ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_branding FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenant_branding ON tenant_branding;
CREATE POLICY tenant_isolation_tenant_branding ON tenant_branding
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_branding TO escolar_runtime;
