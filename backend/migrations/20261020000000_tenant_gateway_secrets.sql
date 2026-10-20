-- Segredos de gateways bancários cifrados (AES-256-GCM, chave mestra em APP_SECRETS_KEY).
-- Guarda só o texto cifrado; a decifragem acontece em memória no serviço services/secrets.rs.

CREATE TABLE IF NOT EXISTS tenant_gateway_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gateway_name TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'transporte_chave',
        'cert',
        'cert_chave',
        'client_id',
        'client_secret',
        'webhook_client_secret_hash'
    )),
    ciphertext BYTEA NOT NULL,
    nonce BYTEA NOT NULL CHECK (octet_length(nonce) = 12),
    key_version INTEGER NOT NULL DEFAULT 1,
    created_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_gateway_secrets_unique UNIQUE (tenant_id, gateway_name, tipo)
);

ALTER TABLE tenant_gateway_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_gateway_secrets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_gateway_secrets ON tenant_gateway_secrets;
CREATE POLICY tenant_isolation_gateway_secrets ON tenant_gateway_secrets
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_gateway_secrets TO escolar_runtime;
