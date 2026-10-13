-- Migration: 20261014600000_planos_aula.sql
-- Planejamento semanal de aulas do professor com BNCC e comentário da coordenação.
-- Tabela com RLS obrigatória (tenant_id = get_current_tenant()).

CREATE TABLE IF NOT EXISTS planos_aula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    disciplina_id UUID NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semana_inicio DATE NOT NULL,
    objetivos TEXT NOT NULL,
    conteudos TEXT NOT NULL,
    habilidades_bncc TEXT[] NOT NULL DEFAULT '{}',
    atividades TEXT NOT NULL,
    avaliacao TEXT NULL,
    comentario_coordenacao TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_plano_aula_turma_disciplina_semana UNIQUE (tenant_id, turma_id, disciplina_id, semana_inicio)
);

CREATE INDEX IF NOT EXISTS idx_planos_aula_turma_disciplina_semana
    ON planos_aula(tenant_id, turma_id, disciplina_id, semana_inicio);

CREATE INDEX IF NOT EXISTS idx_planos_aula_professor
    ON planos_aula(tenant_id, professor_id);

ALTER TABLE planos_aula ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_aula FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_planos_aula ON planos_aula;
CREATE POLICY tenant_isolation_planos_aula ON planos_aula
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());
