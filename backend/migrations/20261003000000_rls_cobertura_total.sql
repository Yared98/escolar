-- Migration: 20261003000000_rls_cobertura_total.sql
-- Cobertura total de RLS (Row Level Security) fail-closed em todas as tabelas com tenant_id.
-- Garante isolamento estrito de dados multi-tenant conforme LGPD (Art. 14) e arquitetura Escolar ERP.

-- 1. Ativação de ENABLE + FORCE RLS e aplicação de políticas fail-closed (TO escolar_runtime)
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT * FROM (VALUES
            ('users', 'tenant_isolation_users'),
            ('audit_logs', 'tenant_isolation_audit_logs'),
            ('salas', 'tenant_isolation_salas'),
            ('regua_cobranca_logs', 'tenant_isolation_regua_cobranca_logs'),
            ('diarios_classe', 'tenant_isolation_diarios_classe'),
            ('lms_configs', 'tenant_isolation_lms_configs'),
            ('lgpd_termos', 'tenant_isolation_lgpd_termos'),
            ('analise_evasao_logs', 'tenant_isolation_analise_evasao_logs'),
            ('nfse_emissoes', 'tenant_isolation_nfse_emissoes'),
            ('conciliacao_bancaria', 'tenant_isolation_conciliacao_bancaria'),
            ('plano_contas', 'tenant_isolation_plano_contas'),
            ('turma_alunos', 'tenant_isolation_turma_alunos'),
            ('projetos_educacionais', 'tenant_isolation_projetos_educacionais'),
            ('cardapios', 'tenant_isolation_cardapios'),
            ('restricoes_alimentares_aluno', 'tenant_isolation_restricoes_alimentares_aluno'),
            ('funcionarios', 'tenant_isolation_funcionarios'),
            ('fornecedores', 'tenant_isolation_fornecedores'),
            ('mensagens_agenda', 'tenant_isolation_mensagens_agenda'),
            ('rotina_diaria_infantil', 'tenant_isolation_rotina_diaria_infantil'),
            ('ocorrencias_aluno', 'tenant_isolation_ocorrencias_aluno'),
            ('notificacoes_disparos_logs', 'tenant_isolation_notificacoes_disparos_logs'),
            ('responsaveis_alunos', 'tenant_isolation_responsaveis_alunos'),
            ('perimetro_credenciais', 'tenant_isolation_perimetro_credenciais'),
            ('perimetro_acessos_logs', 'tenant_isolation_perimetro_acessos_logs'),
            ('oauth_authorization_codes', 'tenant_isolation_oauth_authorization_codes'),
            ('revoked_tokens', 'tenant_isolation_revoked_tokens'),
            ('scorm_tracking', 'tenant_isolation_scorm_tracking'),
            ('lms_grade_sync_logs', 'tenant_isolation_lms_grade_sync_logs'),
            ('atendimento_protocolos', 'tenant_isolation_atendimento_protocolos'),
            ('simulados_tri', 'tenant_isolation_simulados_tri'),
            ('simulados_itens', 'tenant_isolation_simulados_itens'),
            ('simulados_respostas', 'tenant_isolation_simulados_respostas'),
            ('disciplinas', 'tenant_isolation_disciplinas'),
            ('turma_disciplinas', 'tenant_isolation_turma_disciplinas'),
            ('turma_professores', 'tenant_isolation_turma_professores'),
            ('horarios_turma', 'tenant_isolation_horarios_turma'),
            ('tenant_feature_flags', 'tenant_isolation_tenant_feature_flags'),
            ('tenant_cora_config', 'tenant_isolation_tenant_cora_config'),
            ('refresh_tokens', 'tenant_isolation_refresh_tokens'),
            ('pratos', 'tenant_isolation_pratos'),
            ('cardapio_recorrencias', 'tenant_isolation_cardapio_recorrencias'),
            ('push_subscriptions', 'tenant_isolation_push_subscriptions')
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

-- 2. Funções SECURITY DEFINER para operações pré-autenticação (onde o tenant ainda não é conhecido na conexão)

-- Função para validação de refresh token no endpoint /api/v1/auth/refresh
CREATE OR REPLACE FUNCTION validar_refresh_token_publico(p_hash TEXT)
RETURNS TABLE (
    user_id UUID,
    tenant_id UUID,
    role VARCHAR,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT rt.user_id, rt.tenant_id, u.role::VARCHAR, rt.expires_at, rt.revoked_at
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id AND u.tenant_id = rt.tenant_id
    WHERE rt.token_hash = p_hash;
$$;

REVOKE ALL ON FUNCTION validar_refresh_token_publico(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validar_refresh_token_publico(TEXT) TO escolar_runtime;

-- Função para troca de código OAuth 2.0 por token no endpoint /api/v1/auth/oauth/token
CREATE OR REPLACE FUNCTION validar_oauth_code_publico(p_code TEXT, p_client_id TEXT)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    user_id UUID,
    client_id VARCHAR,
    redirect_uri VARCHAR,
    code_challenge VARCHAR,
    used BOOL,
    expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.id, o.tenant_id, o.user_id, o.client_id::VARCHAR, o.redirect_uri::VARCHAR, o.code_challenge::VARCHAR, o.used, o.expires_at
    FROM oauth_authorization_codes o
    WHERE o.code = p_code AND o.client_id = p_client_id;
$$;

REVOKE ALL ON FUNCTION validar_oauth_code_publico(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validar_oauth_code_publico(TEXT, TEXT) TO escolar_runtime;

/*
DOCUMENTAÇÃO DE DECISÕES DE SEGURANÇA E RLS POR TABELA:

1. Tabelas de Autenticação / Pré-Sessão:
- `users`: RLS ativado. No login (`auth.rs`), a busca por email resolve o tenant via slug primeiro; em seguida, a conexão define `app.current_tenant` através de `acquire_tenant(&state.pool, tenant.id)` antes de consultar a tabela. Para fluxos de refresh onde o tenant_id não é previamente conhecido, utiliza-se a função SECURITY DEFINER `validar_refresh_token_publico`.
- `refresh_tokens`: RLS ativado com política padrão `tenant_id = get_current_tenant()`. Leitura pré-autenticação para refresh de sessão utiliza a função SECURITY DEFINER `validar_refresh_token_publico`. Revogações e inserções utilizam conexões com tenant resolvido.
- `revoked_tokens`: RLS ativado com política padrão. Inserções no logout utilizam a conexão do tenant ativo via `TenantDb`.
- `oauth_authorization_codes`: RLS ativado. Emissão de código (`oauth_authorize`) utiliza `TenantDb`. Troca de código por token (`oauth_token`) utiliza a função SECURITY DEFINER `validar_oauth_code_publico` para identificação prévia do tenant_id.

2. Tabelas do Middleware e Configurações:
- `tenant_feature_flags`: RLS ativado. `check_feature_flag` (`backend/src/middleware/feature_flag.rs`) utiliza `acquire_tenant(&state.pool, active_tenant.0)` que define `app.current_tenant` antes de consultar a tabela.
- `tenant_cora_config` / `tenant_bank_integrations`: RLS ativado. Webhooks da Cora (`backend/src/handlers/webhooks_cora.rs`) utilizam `acquire_tenant(&state.pool, tenant_id)` via rota parametrizada `/webhooks/cora/:tenant_id`.

3. Tabelas de Auditoria e Logs:
- `audit_logs`, `regua_cobranca_logs`, `analise_evasao_logs`, `nfse_emissoes`, `notificacoes_disparos_logs`, `perimetro_acessos_logs`, `lms_grade_sync_logs`: RLS ativado. Todas as gravações ocorrem no contexto de um tenant ativo ou através de conexões com `app.current_tenant` configurado.

4. Tabelas Negociais/Domínio (Secretaria, Acadêmico, Financeiro, Nutrição, CRM, Regulatório):
- `salas`, `diarios_classe`, `lms_configs`, `lgpd_termos`, `conciliacao_bancaria`, `plano_contas`, `turma_alunos`, `projetos_educacionais`, `cardapios`, `restricoes_alimentares_aluno`, `funcionarios`, `fornecedores`, `mensagens_agenda`, `rotina_diaria_infantil`, `ocorrencias_aluno`, `responsaveis_alunos`, `perimetro_credenciais`, `scorm_tracking`, `atendimento_protocolos`, `simulados_tri`, `simulados_itens`, `simulados_respostas`, `disciplinas`, `turma_disciplinas`, `turma_professores`, `horarios_turma`, `pratos`, `cardapio_recorrencias`, `push_subscriptions`: RLS ativado com política fail-closed. O acesso requer conexão via `TenantDb` ou `acquire_tenant`.

5. Tabelas Globais (Sem `tenant_id` - RLS não aplicável):
- `tenants`: Tabela global de cadastro e resolução de escolas por slug.
- `opensec_security_rules`: Tabela global de regras de segurança e WAF/IDS da plataforma.
- `whatsapp_webhook_logs`: Tabela global de auditoria de webhooks brutos do WhatsApp antes do roteamento por tenant.
*/
