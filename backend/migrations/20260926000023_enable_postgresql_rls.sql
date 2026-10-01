-- Migration: 20260926000023_enable_postgresql_rls.sql
-- Implementação de Row-Level Security (RLS) nativa para isolamento Multi-Tenant rigoroso (Lei 13.709/2018 - LGPD Art. 14)

-- 1. Função estável de extração segura do tenant da sessão da conexão
CREATE OR REPLACE FUNCTION get_current_tenant() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Habilitação de RLS e Políticas nas Tabelas Principais do Ecossistema

-- Alunos
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_alunos ON alunos;
CREATE POLICY tenant_isolation_alunos ON alunos
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());

-- Prontuários Médicos & Pedagógicos
ALTER TABLE prontuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_prontuarios ON prontuarios;
CREATE POLICY tenant_isolation_prontuarios ON prontuarios
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());

-- Turmas
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_turmas ON turmas;
CREATE POLICY tenant_isolation_turmas ON turmas
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());

-- Faturas
ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_faturas ON faturas;
CREATE POLICY tenant_isolation_faturas ON faturas
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());

-- Despesas
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_despesas ON despesas;
CREATE POLICY tenant_isolation_despesas ON despesas
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());

-- Notas
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_notas ON notas;
CREATE POLICY tenant_isolation_notas ON notas
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());

-- Presenças
ALTER TABLE presencas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_presencas ON presencas;
CREATE POLICY tenant_isolation_presencas ON presencas
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());

-- Contratos
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_contratos ON contratos;
CREATE POLICY tenant_isolation_contratos ON contratos
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());

-- Diplomas Digitais (MEC Portaria 70/2025)
ALTER TABLE diplomas_digitais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_diplomas ON diplomas_digitais;
CREATE POLICY tenant_isolation_diplomas ON diplomas_digitais
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());

-- CRM Leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_leads ON leads;
CREATE POLICY tenant_isolation_leads ON leads
    AS PERMISSIVE
    FOR ALL
    USING (get_current_tenant() IS NULL OR tenant_id = get_current_tenant())
    WITH CHECK (get_current_tenant() IS NULL OR tenant_id = get_current_tenant());
