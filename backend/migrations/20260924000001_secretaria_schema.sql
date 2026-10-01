-- Migration: Secretaria Schema (Alunos, Prontuarios, Contratos, Turmas, Salas, Disciplinas)

CREATE TABLE IF NOT EXISTS alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    data_nascimento DATE NOT NULL,
    nome_responsavel VARCHAR(255) NOT NULL,
    email_responsavel VARCHAR(255) NOT NULL,
    telefone_responsavel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_cpf UNIQUE(tenant_id, cpf)
);

CREATE INDEX IF NOT EXISTS idx_alunos_tenant_cpf ON alunos(tenant_id, cpf);

CREATE TABLE IF NOT EXISTS prontuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    ficha_medica JSONB DEFAULT '{}'::jsonb,
    restricoes_alimentares TEXT,
    historico_observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    ano_letivo INT NOT NULL,
    valor_total DOUBLE PRECISION NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pendente_assinatura',
    hash_documento VARCHAR(255),
    assinado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    capacidade INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS turmas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sala_id UUID REFERENCES salas(id),
    nome VARCHAR(100) NOT NULL,
    ano_letivo INT NOT NULL,
    capacidade_maxima INT NOT NULL DEFAULT 35,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
