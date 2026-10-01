-- Migration: Painel da Professora da Educação Infantil & Ocorrências Auditáveis

CREATE TABLE IF NOT EXISTS ocorrencias_aluno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES users(id),
    turma_id UUID REFERENCES turmas(id),
    tipo_ocorrencia VARCHAR(100) NOT NULL, -- 'febre', 'queda_arranhao', 'indisposicao', 'atrito_colega', 'outros'
    descricao TEXT NOT NULL,
    prioridade VARCHAR(20) NOT NULL DEFAULT 'alta', -- 'baixa', 'media', 'alta', 'urgente'
    notificado_responsavel BOOLEAN NOT NULL DEFAULT true,
    lido_pelo_responsavel BOOLEAN NOT NULL DEFAULT false,
    lido_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_tenant_aluno ON ocorrencias_aluno(tenant_id, aluno_id);
