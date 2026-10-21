-- Migration: Tabela gateway_avisos para fila e reprocessamento de webhooks Itaú (boleto e Pix)
-- e colunas webhook_client_id / webhook_boleto_registrado_em em tenant_itau_config

CREATE TABLE IF NOT EXISTS gateway_avisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gateway_name TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('boleto', 'pix')),
    event_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'descartado')),
    tentativas INT NOT NULL DEFAULT 0,
    ultimo_erro TEXT,
    proxima_tentativa_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gateway_avisos_unique UNIQUE (tenant_id, gateway_name, event_id)
);

CREATE INDEX IF NOT EXISTS idx_gateway_avisos_pendentes
    ON gateway_avisos (tenant_id, status, proxima_tentativa_em)
    WHERE status = 'pendente';

ALTER TABLE gateway_avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_avisos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_gateway_avisos ON gateway_avisos;
CREATE POLICY tenant_isolation_gateway_avisos ON gateway_avisos
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON gateway_avisos TO escolar_runtime;

ALTER TABLE tenant_itau_config
    ADD COLUMN IF NOT EXISTS webhook_client_id TEXT,
    ADD COLUMN IF NOT EXISTS webhook_boleto_registrado_em TIMESTAMPTZ;
