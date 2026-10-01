-- Migration: Funcionalidades de Escola Infantil (Diretoria)

CREATE TABLE IF NOT EXISTS autorizados_retirada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    rg_cpf VARCHAR(50) NOT NULL,
    grau_parentesco VARCHAR(100) NOT NULL,
    foto_url TEXT,
    telefone VARCHAR(50),
    autorizado_por UUID NOT NULL REFERENCES users(id),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autorizacoes_medicamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    responsavel_id UUID NOT NULL REFERENCES users(id),
    medicamento VARCHAR(255) NOT NULL,
    dosagem VARCHAR(100) NOT NULL,
    horario_aplicacao VARCHAR(50) NOT NULL,
    receita_medica_url TEXT,
    observacoes TEXT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- 'pendente', 'aprovado', 'aplicado', 'cancelado'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_infantil (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES users(id),
    turma_id UUID REFERENCES turmas(id),
    data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT NOT NULL,
    midia_url TEXT,
    campos_experiencia_bncc TEXT, -- ex: 'o_eu_o_outro;corpo_gestos'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grupos_familiares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    responsavel_financeiro_id UUID NOT NULL REFERENCES users(id),
    nome_familia VARCHAR(255) NOT NULL,
    desconto_percentual DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alunos
ADD COLUMN IF NOT EXISTS grupo_familiar_id UUID REFERENCES grupos_familiares(id) ON DELETE SET NULL;


