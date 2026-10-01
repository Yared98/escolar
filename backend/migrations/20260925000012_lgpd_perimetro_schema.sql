-- Migration: LGPD Termos de Consentimento (Art. 14 Menores) & Controle Perimetral Não-Invasivo (RFID/QR Code)

ALTER TABLE lgpd_termos
ADD COLUMN IF NOT EXISTS responsavel_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ip_subscritor VARCHAR(45),
ADD COLUMN IF NOT EXISTS hash_termo VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_lgpd_termos_aluno ON lgpd_termos(tenant_id, aluno_id);

CREATE TABLE IF NOT EXISTS perimetro_credenciais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    tipo_identificador VARCHAR(50) NOT NULL DEFAULT 'rfid_ou_qrcode', -- 'rfid', 'qrcode', 'rfid_ou_qrcode'
    codigo VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_perimetro_codigo UNIQUE(tenant_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_perimetro_credenciais_busca ON perimetro_credenciais(tenant_id, codigo, ativo);

CREATE TABLE IF NOT EXISTS perimetro_acessos_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    tipo_identificador VARCHAR(50) NOT NULL,
    codigo VARCHAR(255) NOT NULL,
    direcao VARCHAR(20) NOT NULL DEFAULT 'entrada', -- 'entrada', 'saida'
    acesso_permitido BOOLEAN NOT NULL DEFAULT true,
    motivo_bloqueio VARCHAR(255),
    ponto_acesso VARCHAR(100) NOT NULL DEFAULT 'Portaria Principal',
    registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perimetro_logs ON perimetro_acessos_logs(tenant_id, aluno_id, registrado_em DESC);
