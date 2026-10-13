-- Migration: Virada de ano letivo e rematrícula (C15)
-- Histórico de viradas para idempotência e auditoria.
-- RLS habilitada e forçada com política de isolamento multi-tenant.

CREATE TABLE IF NOT EXISTS viradas_ano_letivo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ano_origem INT NOT NULL,
    ano_destino INT NOT NULL,
    executado_por UUID REFERENCES users(id),
    executado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detalhes JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT unique_tenant_virada_ano UNIQUE (tenant_id, ano_origem, ano_destino)
);

CREATE INDEX IF NOT EXISTS idx_viradas_ano_tenant ON viradas_ano_letivo(tenant_id, ano_origem, ano_destino);

ALTER TABLE viradas_ano_letivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE viradas_ano_letivo FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_viradas_ano_letivo ON viradas_ano_letivo;
CREATE POLICY tenant_isolation_viradas_ano_letivo ON viradas_ano_letivo
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());
