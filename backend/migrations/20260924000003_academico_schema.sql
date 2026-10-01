-- Migration: Academico Schema (Diario, Presencas, Avaliacoes, Notas)

CREATE TABLE IF NOT EXISTS diarios_classe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_aula DATE NOT NULL,
    conteudo_ministrado TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presencas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    diario_id UUID NOT NULL REFERENCES diarios_classe(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    presente BOOLEAN NOT NULL DEFAULT true,
    justificativa TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    disciplina_nome VARCHAR(100) NOT NULL,
    nota DOUBLE PRECISION NOT NULL,
    periodo VARCHAR(20) NOT NULL, -- '1_bimestre', '2_bimestre', etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
