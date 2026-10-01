-- Migration: Explicit Relationship Schema for Responsável (Pai/Mãe) -> Alunos
-- Resolves relationship between Users (role='responsavel') and Alunos

ALTER TABLE alunos 
ADD COLUMN IF NOT EXISTS responsavel_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS responsaveis_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    responsavel_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    parentesco VARCHAR(50) DEFAULT 'Pai/Mãe/Responsável Legal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_responsavel_aluno UNIQUE(tenant_id, responsavel_user_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS idx_responsaveis_alunos_user ON responsaveis_alunos(tenant_id, responsavel_user_id);
CREATE INDEX IF NOT EXISTS idx_responsaveis_alunos_aluno ON responsaveis_alunos(tenant_id, aluno_id);
