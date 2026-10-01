-- Migration: LTI 1.3 Advantage & SCORM Tracking Schema
-- Suporte ao protocolo 1EdTech LTI 1.3 Advantage (AGS, NRPS, Deep Linking) e SCORM 1.2 / 2004 CMI

CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_configs_tenant_type ON lms_configs(tenant_id, lms_type);

CREATE TABLE IF NOT EXISTS scorm_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    package_id VARCHAR(100) NOT NULL,
    lesson_status VARCHAR(50) NOT NULL DEFAULT 'incomplete', -- 'passed', 'completed', 'failed', 'incomplete', 'browsed'
    score_raw DOUBLE PRECISION,
    score_min DOUBLE PRECISION DEFAULT 0.0,
    score_max DOUBLE PRECISION DEFAULT 100.0,
    session_time VARCHAR(50),
    suspend_data TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_aluno_scorm UNIQUE (tenant_id, aluno_id, package_id)
);

CREATE TABLE IF NOT EXISTS lms_grade_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    disciplina_nome VARCHAR(100) NOT NULL,
    atividade_nome VARCHAR(255) NOT NULL,
    nota DOUBLE PRECISION NOT NULL,
    periodo VARCHAR(20) NOT NULL DEFAULT '1_bimestre',
    origem_lms VARCHAR(50) NOT NULL DEFAULT 'lti_ags',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scorm_tracking_aluno ON scorm_tracking(tenant_id, aluno_id);
CREATE INDEX IF NOT EXISTS idx_lms_grade_sync_tenant ON lms_grade_sync_logs(tenant_id, aluno_id);
