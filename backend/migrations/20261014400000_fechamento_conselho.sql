-- Fechamento de bimestre/trimestre e conselho de classe.
-- Tabelas com RLS obrigatória (tenant_id = get_current_tenant()).

CREATE TABLE IF NOT EXISTS fechamentos_periodo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL,
    periodo VARCHAR(20) NOT NULL,
    fechado_por UUID REFERENCES users(id),
    fechado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, turma_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_fechamentos_periodo_turma ON fechamentos_periodo(tenant_id, turma_id);

ALTER TABLE fechamentos_periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechamentos_periodo FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_fechamentos_periodo ON fechamentos_periodo;
CREATE POLICY tenant_isolation_fechamentos_periodo ON fechamentos_periodo
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());

CREATE TABLE IF NOT EXISTS pareceres_conselho (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL,
    aluno_id UUID NOT NULL,
    periodo VARCHAR(20) NOT NULL,
    parecer TEXT NOT NULL CHECK (char_length(parecer) <= 2000),
    encaminhamento VARCHAR(30) NULL CHECK (encaminhamento IN ('recuperacao', 'acompanhamento', 'sem_pendencias')),
    registrado_por UUID REFERENCES users(id),
    registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, aluno_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_pareceres_conselho_turma ON pareceres_conselho(tenant_id, turma_id);
CREATE INDEX IF NOT EXISTS idx_pareceres_conselho_aluno ON pareceres_conselho(tenant_id, aluno_id);

ALTER TABLE pareceres_conselho ENABLE ROW LEVEL SECURITY;
ALTER TABLE pareceres_conselho FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_pareceres_conselho ON pareceres_conselho;
CREATE POLICY tenant_isolation_pareceres_conselho ON pareceres_conselho
    AS PERMISSIVE FOR ALL TO escolar_runtime
    USING (tenant_id = get_current_tenant())
    WITH CHECK (tenant_id = get_current_tenant());
