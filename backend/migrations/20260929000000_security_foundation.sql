-- Fundação de segurança: RLS fail-closed, papel de execução sem superuser,
-- refresh tokens, estorno de despesas e fila de notificações.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'escolar_runtime') THEN
        CREATE ROLE escolar_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
END $$;

GRANT escolar_runtime TO escolar_app;
GRANT USAGE ON SCHEMA public TO escolar_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO escolar_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO escolar_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO escolar_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO escolar_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO escolar_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO escolar_runtime;

DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO escolar_runtime', current_database());
END $$;

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT * FROM (VALUES
            ('alunos', 'tenant_isolation_alunos'),
            ('prontuarios', 'tenant_isolation_prontuarios'),
            ('turmas', 'tenant_isolation_turmas'),
            ('faturas', 'tenant_isolation_faturas'),
            ('despesas', 'tenant_isolation_despesas'),
            ('notas', 'tenant_isolation_notas'),
            ('presencas', 'tenant_isolation_presencas'),
            ('contratos', 'tenant_isolation_contratos'),
            ('diplomas_digitais', 'tenant_isolation_diplomas'),
            ('leads', 'tenant_isolation_leads'),
            ('lead_interacoes', 'tenant_isolation_lead_interacoes'),
            ('autorizados_retirada', 'tenant_isolation_autorizados_retirada'),
            ('autorizacoes_medicamento', 'tenant_isolation_autorizacoes_medicamento'),
            ('portfolio_infantil', 'tenant_isolation_portfolio_infantil'),
            ('grupos_familiares', 'tenant_isolation_grupos_familiares'),
            ('eventos_calendario', 'tenant_isolation_eventos_calendario'),
            ('eventos_rsvps', 'tenant_isolation_eventos_rsvps'),
            ('notificacoes_sistema', 'tenant_isolation_notificacoes_sistema'),
            ('tenant_bank_integrations', 'tenant_isolation_bank_integrations')
        ) AS t(tbl, policy)
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', rec.tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', rec.tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', rec.policy, rec.tbl);
        EXECUTE format(
            'CREATE POLICY %I ON %I AS PERMISSIVE FOR ALL TO escolar_runtime USING (tenant_id = get_current_tenant()) WITH CHECK (tenant_id = get_current_tenant())',
            rec.policy,
            rec.tbl
        );
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(tenant_id, user_id);

ALTER TABLE despesas
    ADD COLUMN IF NOT EXISTS estorno_de UUID REFERENCES despesas(id);

ALTER TABLE notificacoes_sistema
    ADD COLUMN IF NOT EXISTS status_processamento VARCHAR(20) NOT NULL DEFAULT 'pendente',
    ADD COLUMN IF NOT EXISTS tentativas INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_notificacoes_processamento
    ON notificacoes_sistema(status_processamento, created_at);

CREATE OR REPLACE FUNCTION validar_diploma_publico(p_codigo TEXT)
RETURNS TABLE (
    diploma_id UUID,
    tenant_id UUID,
    aluno_id UUID,
    aluno_nome TEXT,
    cpf TEXT,
    curso_nome TEXT,
    status TEXT,
    hash_xades TEXT,
    carimbo_tempo TIMESTAMPTZ,
    data_emissao TIMESTAMPTZ,
    notas JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        d.id,
        d.tenant_id,
        d.aluno_id,
        a.nome::text,
        a.cpf::text,
        d.curso_nome::text,
        COALESCE(d.status, 'registrado_e_assinado')::text,
        d.hash_xades::text,
        d.carimbo_tempo,
        d.created_at,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_array(n.disciplina_nome, n.periodo, n.nota)
                    ORDER BY n.disciplina_nome, n.periodo
                )
                FROM notas n
                WHERE n.tenant_id = d.tenant_id AND n.aluno_id = d.aluno_id
            ),
            '[]'::jsonb
        )
    FROM diplomas_digitais d
    JOIN alunos a ON a.id = d.aluno_id AND a.tenant_id = d.tenant_id
    WHERE d.codigo_validacao = p_codigo
       OR d.hash_xades = p_codigo
       OR d.id::text = p_codigo
       OR d.id::text = regexp_replace(p_codigo, '^dip-', '')
    ORDER BY d.created_at DESC
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION validar_diploma_publico(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validar_diploma_publico(TEXT) TO escolar_runtime;

CREATE OR REPLACE FUNCTION claim_notificacoes_pendentes(p_limit INT)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    aluno_id UUID,
    destinatario_id UUID,
    modulo VARCHAR,
    titulo VARCHAR,
    mensagem TEXT,
    prioridade VARCHAR,
    canal_disparo VARCHAR,
    tentativas INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE notificacoes_sistema AS n
    SET status_processamento = 'processando',
        tentativas = n.tentativas + 1
    WHERE n.id IN (
        SELECT fila.id
        FROM notificacoes_sistema AS fila
        WHERE fila.status_processamento = 'pendente'
        ORDER BY fila.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    RETURNING
        n.id,
        n.tenant_id,
        n.aluno_id,
        n.destinatario_id,
        n.modulo,
        n.titulo,
        n.mensagem,
        n.prioridade,
        n.canal_disparo,
        n.tentativas;
END;
$$;

CREATE OR REPLACE FUNCTION concluir_notificacao(p_id UUID, p_tenant UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM set_config('app.current_tenant', p_tenant::text, true);
    UPDATE notificacoes_sistema
    SET status_processamento = p_status
    WHERE id = p_id
      AND tenant_id = p_tenant
      AND status_processamento = 'processando';
END;
$$;

REVOKE ALL ON FUNCTION claim_notificacoes_pendentes(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION concluir_notificacao(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_notificacoes_pendentes(INT) TO escolar_runtime;
GRANT EXECUTE ON FUNCTION concluir_notificacao(UUID, UUID, TEXT) TO escolar_runtime;
