-- Migration: leitura de notificação por pessoa.
-- Antes havia um único `lida` em notificacoes_sistema: em avisos gerais (sem destinatário) a primeira
-- pessoa que marcasse como lida apagava o aviso para a escola toda, e a tela nem gravava a leitura.
-- RLS habilitada e forçada com política de isolamento multi-tenant.

CREATE TABLE IF NOT EXISTS notificacoes_leituras (
    notificacao_id UUID NOT NULL REFERENCES notificacoes_sistema(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (notificacao_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_leituras_usuario
    ON notificacoes_leituras(tenant_id, user_id);

ALTER TABLE notificacoes_leituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_leituras FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notificacoes_leituras ON notificacoes_leituras;
CREATE POLICY tenant_isolation_notificacoes_leituras ON notificacoes_leituras
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());
