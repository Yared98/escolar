-- Migration: Regulatório, Censo, Diploma Digital MEC e IA Anti-Evasão Schema

CREATE TABLE IF NOT EXISTS diplomas_digitais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    curso_nome VARCHAR(255) NOT NULL,
    xml_diplomado TEXT NOT NULL,
    xml_documentacao TEXT NOT NULL,
    rvdd_pdf_url VARCHAR(255),
    hash_xades VARCHAR(255) NOT NULL,
    carimbo_tempo TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lgpd_termos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    consentimento_responsavel BOOLEAN NOT NULL DEFAULT true,
    data_aceite TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    versao_termo VARCHAR(20) NOT NULL DEFAULT '1.0'
);

CREATE TABLE IF NOT EXISTS analise_evasao_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    score_risco_evasao DOUBLE PRECISION NOT NULL, -- Ex: 92.50 (percentage)
    fator_principal VARCHAR(255) NOT NULL, -- 'queda_desempenho', 'inadimplencia', 'abstenção_lms'
    calculado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
