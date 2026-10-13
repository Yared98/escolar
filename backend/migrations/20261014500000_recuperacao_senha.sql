-- Recuperação de senha: tokens de uso único e caixa de saída de e-mail simulada.
CREATE TABLE IF NOT EXISTS tokens_recuperacao_senha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    usado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_recuperacao_user
    ON tokens_recuperacao_senha(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_recuperacao_hash
    ON tokens_recuperacao_senha(token_hash);

CREATE TABLE IF NOT EXISTS emails_saida (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    destinatario VARCHAR(255) NOT NULL,
    assunto VARCHAR(255) NOT NULL,
    corpo TEXT NOT NULL,
    modo VARCHAR(20) NOT NULL DEFAULT 'simulado',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_saida_tenant_created
    ON emails_saida(tenant_id, created_at DESC);

-- RLS fail-closed para ambas as tabelas.
ALTER TABLE tokens_recuperacao_senha ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_recuperacao_senha FORCE ROW LEVEL SECURITY;
ALTER TABLE emails_saida ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails_saida FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_tokens_recuperacao_senha ON tokens_recuperacao_senha;
CREATE POLICY tenant_isolation_tokens_recuperacao_senha
    ON tokens_recuperacao_senha
    AS PERMISSIVE
    FOR ALL
    TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());

DROP POLICY IF EXISTS tenant_isolation_emails_saida ON emails_saida;
CREATE POLICY tenant_isolation_emails_saida
    ON emails_saida
    AS PERMISSIVE
    FOR ALL
    TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());
