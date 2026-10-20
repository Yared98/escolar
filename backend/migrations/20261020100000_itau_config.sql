-- Migration: Configuração e dados de cobrança do Itaú (não secretos)
-- Segredos ficam em tenant_gateway_secrets (AES-256-GCM, services/secrets.rs).

CREATE TABLE IF NOT EXISTS tenant_itau_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agencia VARCHAR(4),
    conta VARCHAR(7),
    dac VARCHAR(1),
    id_beneficiario VARCHAR(12),
    chave_pix VARCHAR(77),
    especie_padrao VARCHAR(2) NOT NULL DEFAULT '04',
    multa_padrao_percentual NUMERIC(5, 2) NOT NULL DEFAULT 2.00,
    juros_padrao_percentual NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    ativo BOOLEAN NOT NULL DEFAULT false,
    ultimo_teste_ok_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_itau_config_tenant_unique UNIQUE (tenant_id)
);

ALTER TABLE tenant_itau_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_itau_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_itau_config ON tenant_itau_config;
CREATE POLICY tenant_isolation_itau_config ON tenant_itau_config
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_itau_config TO escolar_runtime;
