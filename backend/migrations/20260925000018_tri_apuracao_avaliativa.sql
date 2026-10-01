-- Migration: TRI (Teoria de Resposta ao Item) & Apuracao Avaliativa / Gabaritos
-- Suporte ao modelo logistico de 3 parametros (a=discriminacao, b=dificuldade, c=acerto ao acaso)

CREATE TABLE IF NOT EXISTS simulados_tri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    disciplina VARCHAR(100) NOT NULL,
    data_aplicacao DATE NOT NULL,
    total_itens INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulados_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    simulado_id UUID NOT NULL REFERENCES simulados_tri(id) ON DELETE CASCADE,
    numero_item INT NOT NULL,
    gabarito_correto CHAR(1) NOT NULL,
    parametro_a DOUBLE PRECISION NOT NULL DEFAULT 1.0, -- Discriminação (0.5 a 2.5)
    parametro_b DOUBLE PRECISION NOT NULL DEFAULT 0.0, -- Dificuldade (-3.0 a 3.0)
    parametro_c DOUBLE PRECISION NOT NULL DEFAULT 0.2, -- Acerto ao acaso (0.2 para 5 alternativas)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_simulado_item UNIQUE (simulado_id, numero_item)
);

CREATE TABLE IF NOT EXISTS simulados_respostas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    simulado_id UUID NOT NULL REFERENCES simulados_tri(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    respostas_marcadas JSONB NOT NULL, -- Ex: [{"numero": 1, "resposta": "A"}]
    total_acertos INT NOT NULL DEFAULT 0,
    proficiencia_theta DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    escala_enem DOUBLE PRECISION NOT NULL DEFAULT 500.0,
    coerencia_pedagogica_score DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    status_diagnostico VARCHAR(50) NOT NULL DEFAULT 'coerente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_simulado_aluno UNIQUE (simulado_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_simulados_tenant ON simulados_tri(tenant_id);
CREATE INDEX IF NOT EXISTS idx_simulados_itens_simulado ON simulados_itens(simulado_id);
CREATE INDEX IF NOT EXISTS idx_simulados_respostas_aluno ON simulados_respostas(tenant_id, aluno_id);
