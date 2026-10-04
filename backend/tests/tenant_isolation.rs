use axum::extract::{Json, State};
use chrono::{Duration, Utc};
use escolar_backend::config::{development_signing_material, AppState, Config};
use escolar_backend::handlers::auth::{
    hash_refresh_token, refresh_session, refresh_token_usable, RefreshDto,
};
use escolar_backend::handlers::financeiro::despesa_liquidada;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use uuid::Uuid;

fn database_url_for(admin_url: &str, name: &str) -> String {
    let (without_query, query) = match admin_url.split_once('?') {
        Some((url, query)) => (url, Some(query)),
        None => (admin_url, None),
    };
    let (base, _) = without_query
        .rsplit_once('/')
        .expect("ESCOLAR_TEST_DATABASE_URL precisa apontar para um database");
    match query {
        Some(query) => format!("{base}/{name}?{query}"),
        None => format!("{base}/{name}"),
    }
}

async fn drop_database(admin: &PgPool, name: &str) {
    let _ = sqlx::query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()")
        .bind(name)
        .execute(admin)
        .await;
    let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS {name}"))
        .execute(admin)
        .await;
}

#[tokio::test]
async fn tenant_isolation_refresh_estorno_e_fila() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de isolamento ignorado.");
        return;
    };

    let db_name = format!("escolar_isolation_{}", Uuid::new_v4().simple());
    let admin = PgPoolOptions::new()
        .max_connections(2)
        .connect(&admin_url)
        .await
        .expect("conexão administrativa");

    sqlx::query(&format!("CREATE DATABASE {db_name}"))
        .execute(&admin)
        .await
        .expect("criação do database descartável");

    let test_pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(&database_url_for(&admin_url, &db_name))
        .await
        .expect("conexão do database de teste");

    let result = run_checks(&test_pool).await;
    test_pool.close().await;
    drop_database(&admin, &db_name).await;
    result.expect("isolamento, refresh, estorno e fila");
}

async fn run_checks(pool: &PgPool) -> Result<(), String> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| format!("migrations: {e}"))?;

    // 1. Verificação automatizada de cobertura total RLS (pg_class e pg_attribute)
    let missing_rls: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT c.relname::text
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = c.oid
                AND a.attname = 'tenant_id'
                AND NOT a.attisdropped
          )
          AND (c.relrowsecurity = false OR c.relforcerowsecurity = false)
        ORDER BY c.relname ASC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if !missing_rls.is_empty() {
        return Err(format!(
            "As seguintes tabelas com tenant_id não possuem RLS habilitado e forçado (relrowsecurity e relforcerowsecurity): {:?}",
            missing_rls
        ));
    }

    let missing_policy: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT c.relname::text
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = c.oid
                AND a.attname = 'tenant_id'
                AND NOT a.attisdropped
          )
          AND NOT EXISTS (
              SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public'
                AND p.tablename = c.relname
                AND p.roles @> ARRAY['escolar_runtime']::name[]
          )
        ORDER BY c.relname ASC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if !missing_policy.is_empty() {
        return Err(format!(
            "As seguintes tabelas com tenant_id não possuem política RLS para escolar_runtime: {:?}",
            missing_policy
        ));
    }

    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();
    let user_a = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola A', $2), ($3, 'Escola B', $4)",
    )
    .bind(tenant_a)
    .bind(format!("escola-a-{}", &tenant_a.to_string()[..8]))
    .bind(tenant_b)
    .bind(format!("escola-b-{}", &tenant_b.to_string()[..8]))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel)
        VALUES ($1, $2, 'Aluno A', '11111111111', '2015-01-01', 'Resp A', 'a@escola.test', '11900000001'),
               ($3, $4, 'Aluno B', '22222222222', '2015-01-01', 'Resp B', 'b@escola.test', '11900000002')
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(tenant_a)
    .bind(Uuid::new_v4())
    .bind(tenant_b)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    {
        let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;
        sqlx::query("SET ROLE escolar_runtime")
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
        sqlx::query("SELECT set_config('app.current_tenant', $1, false)")
            .bind(tenant_a.to_string())
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;

        let visible: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM alunos")
            .fetch_one(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
        let leaked: i64 =
            sqlx::query_scalar("SELECT COUNT(*)::bigint FROM alunos WHERE nome = 'Aluno B'")
                .fetch_one(&mut *conn)
                .await
                .map_err(|e| e.to_string())?;
        if visible != 1 || leaked != 0 {
            return Err(format!(
                "RLS com tenant A retornou {visible} linhas e {leaked} do tenant B"
            ));
        }

        sqlx::query("SELECT set_config('app.current_tenant', '', false)")
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
        let without_tenant: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM alunos")
            .fetch_one(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
        if without_tenant != 0 {
            return Err(format!("RLS sem tenant retornou {without_tenant} linhas"));
        }

        sqlx::query("RESET ROLE")
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
    }

    // 2. Teste dinâmico de isolamento multi-tenant em todas as tabelas com tenant_id
    {
        let tables_with_tenant: Vec<String> = sqlx::query_scalar(
            r#"
            SELECT c.relname::text
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind = 'r'
              AND EXISTS (
                  SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = c.oid
                    AND a.attname = 'tenant_id'
                    AND NOT a.attisdropped
              )
            ORDER BY c.relname ASC
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        // Garantir que as 62 tabelas com tenant_id estejam presentes no schema
        if tables_with_tenant.len() != 62 {
            return Err(format!(
                "Esperado 62 tabelas com tenant_id no schema public, encontrado {}",
                tables_with_tenant.len()
            ));
        }

        // Criar dependências mãe para FKs antes de inserir nas 61 tabelas
        let user_b = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'User B', $3, 'hash', 'gestor')",
        )
        .bind(user_b)
        .bind(tenant_b)
        .bind(format!("user-b-{}@escola.test", &user_b.to_string()[..8]))
        .execute(pool)
        .await
        .map_err(|e| format!("FK init users: {e}"))?;

        let aluno_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel)
            VALUES ($1, $2, 'Aluno Base B', '33333333333', '2015-01-01', 'Resp Base B', 'respb@escola.test', '11900000003')
            "#,
        )
        .bind(aluno_b_id)
        .bind(tenant_b)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init alunos: {e}"))?;

        let turma_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno)
            VALUES ($1, $2, 'Turma B', 2026, 'fundamental_1', 'matutino')
            "#,
        )
        .bind(turma_b_id)
        .bind(tenant_b)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init turmas: {e}"))?;

        let disciplina_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO disciplinas (id, tenant_id, nome, codigo)
            VALUES ($1, $2, 'Matemática B', 'MAT-B')
            "#,
        )
        .bind(disciplina_b_id)
        .bind(tenant_b)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init disciplinas: {e}"))?;

        let contrato_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO contratos (id, tenant_id, aluno_id, ano_letivo, valor_total, status)
            VALUES ($1, $2, $3, 2026, 12000.0, 'ativo')
            "#,
        )
        .bind(contrato_b_id)
        .bind(tenant_b)
        .bind(aluno_b_id)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init contratos: {e}"))?;

        let despesa_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO despesas (id, tenant_id, descricao, categoria, valor, data_vencimento, status)
            VALUES ($1, $2, 'Despesa B', 'outros', 500.0, CURRENT_DATE, 'pendente')
            "#,
        )
        .bind(despesa_b_id)
        .bind(tenant_b)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init despesas: {e}"))?;

        let lead_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO leads (id, tenant_id, nome, email, telefone, canal_aquisicao, estagio_funil)
            VALUES ($1, $2, 'Lead B', 'leadb@test.com', '11988888888', 'site', 'novo_lead')
            "#,
        )
        .bind(lead_b_id)
        .bind(tenant_b)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init leads: {e}"))?;

        let simulado_tri_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO simulados_tri (id, tenant_id, titulo, disciplina, data_aplicacao)
            VALUES ($1, $2, 'Simulado B', 'matematica', CURRENT_DATE)
            "#,
        )
        .bind(simulado_tri_b_id)
        .bind(tenant_b)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init simulados_tri: {e}"))?;

        let simulado_item_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO simulados_itens (id, tenant_id, simulado_id, numero_item, parametro_a, parametro_b, parametro_c, gabarito_correto)
            VALUES ($1, $2, $3, 1, 1.0, 0.0, 0.2, 'A')
            "#,
        )
        .bind(simulado_item_b_id)
        .bind(tenant_b)
        .bind(simulado_tri_b_id)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init simulados_itens: {e}"))?;

        let prato_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO pratos (id, tenant_id, titulo, descricao_ingredientes)
            VALUES ($1, $2, 'Prato B FK', 'Ingredientes B FK')
            "#,
        )
        .bind(prato_b_id)
        .bind(tenant_b)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init pratos: {e}"))?;

        let cardapio_b_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO cardapios (id, tenant_id, semana_ano, data_dia, tipo_refeicao, titulo_menu, descricao_ingredientes, nutricionista_responsavel)
            VALUES ($1, $2, '2026-W40', CURRENT_DATE, 'almoco', 'Almoço B', 'Menu B', 'Nutri B')
            "#,
        )
        .bind(cardapio_b_id)
        .bind(tenant_b)
        .execute(pool)
        .await
        .map_err(|e| format!("FK init cardapios: {e}"))?;

        // Inserir registro do Tenant B em TODAS as 61 tabelas com tenant_id
        for tbl in &tables_with_tenant {
            let insert_sql = match tbl.as_str() {
                "alunos" => format!("INSERT INTO {tbl} (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel) VALUES ($1, $2, 'Aluno Test B', '44444444444', '2015-01-01', 'Resp Test B', 'resptestb@escola.test', '11900000004') ON CONFLICT DO NOTHING"),
                "analise_evasao_logs" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, score_risco_evasao, fator_principal) VALUES ($1, $2, '{aluno_b_id}', 92.5, 'inadimplencia')"),
                "atendimento_protocolos" => format!("INSERT INTO {tbl} (id, tenant_id, protocolo, telefone_contato, assunto, status) VALUES ($1, $2, 'PROT-B-001', '11999999999', 'Dúvida B', 'finalizado')"),
                "audit_logs" => format!("INSERT INTO {tbl} (id, tenant_id, user_id, acao, entidade) VALUES ($1, $2, '{user_b}', 'TEST_ACTION', 'test_entity')"),
                "autorizacoes_medicamento" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, responsavel_id, medicamento, dosagem, horario_aplicacao, data_inicio, data_fim) VALUES ($1, $2, '{aluno_b_id}', '{user_b}', 'Dipirona', '5ml', '14:00', CURRENT_DATE, CURRENT_DATE)"),
                "autorizados_retirada" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, nome, rg_cpf, grau_parentesco, autorizado_por) VALUES ($1, $2, '{aluno_b_id}', 'Tio B', '55555555555', 'Tio', '{user_b}')"),
                "cardapio_recorrencias" => format!("INSERT INTO {tbl} (id, tenant_id, prato_id, tipo_refeicao, dias_semana, data_inicio, data_fim, nutricionista_responsavel) VALUES ($1, $2, '{prato_b_id}', 'almoco', ARRAY[1]::smallint[], CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'Nutri B')"),
                "cardapios" => format!("INSERT INTO {tbl} (id, tenant_id, semana_ano, data_dia, tipo_refeicao, titulo_menu, descricao_ingredientes, nutricionista_responsavel) VALUES ($1, $2, '2026-W40', CURRENT_DATE + INTERVAL '1 day', 'jantar', 'Jantar B', 'Desc Jantar B', 'Nutri B') ON CONFLICT DO NOTHING"),
                "conciliacao_bancaria" => format!("INSERT INTO {tbl} (id, tenant_id, banco, data_transacao, descricao, valor, tipo, status_conciliacao) VALUES ($1, $2, 'Banco B', CURRENT_DATE, 'Extrato B', 100.0, 'credito', 'pendente')"),
                "contratos" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, ano_letivo, valor_total, status) VALUES ($1, $2, '{aluno_b_id}', 2027, 13000.0, 'rascunho') ON CONFLICT DO NOTHING"),
                "despesas" => format!("INSERT INTO {tbl} (id, tenant_id, descricao, categoria, valor, data_vencimento, status) VALUES ($1, $2, 'Despesa Extra B', 'outros', 250.0, CURRENT_DATE, 'pendente') ON CONFLICT DO NOTHING"),
                "diarios_classe" => format!("INSERT INTO {tbl} (id, tenant_id, turma_id, professor_id, data_aula, conteudo_ministrado) VALUES ($1, $2, '{turma_b_id}', '{user_b}', CURRENT_DATE, 'Conteúdo B')"),
                "diplomas_digitais" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, curso_nome, xml_diplomado, xml_documentacao, hash_xades) VALUES ($1, $2, '{aluno_b_id}', 'Curso B', '<xml/>', '<xml/>', 'hashb123')"),
                "disciplinas" => format!("INSERT INTO {tbl} (id, tenant_id, nome, codigo) VALUES ($1, $2, 'Física B', 'FIS-B') ON CONFLICT DO NOTHING"),
                "eventos_calendario" => format!("INSERT INTO {tbl} (id, tenant_id, titulo, data_inicio, data_fim, tipo, criado_por) VALUES ($1, $2, 'Evento B', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', 'outro', '{user_b}')"),
                "eventos_rsvps" => {
                    let ev_id = Uuid::new_v4();
                    sqlx::query(&format!("INSERT INTO eventos_calendario (id, tenant_id, titulo, data_inicio, data_fim, tipo, criado_por) VALUES ('{ev_id}', '{tenant_b}', 'Ev RSVP B', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', 'outro', '{user_b}')"))
                        .execute(pool).await.map_err(|e| e.to_string())?;
                    format!("INSERT INTO {tbl} (id, tenant_id, evento_id, usuario_id, status) VALUES ($1, $2, '{ev_id}', '{user_b}', 'confirmado')")
                },
                "faturas" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status) VALUES ($1, $2, '{aluno_b_id}', 'Fatura B', 1000.0, CURRENT_DATE, 'pendente')"),
                "fornecedores" => format!("INSERT INTO {tbl} (id, tenant_id, razao_social, cnpj, ramo_atividade, email, telefone) VALUES ($1, $2, 'Fornecedor B LTDA', '12345678000199', 'Alimentos', 'forn@b.com', '11966666666')"),
                "funcionarios" => format!("INSERT INTO {tbl} (id, tenant_id, user_id, nome, cpf, cargo, departamento, data_admissao) VALUES ($1, $2, '{user_b}', 'Func B', '66666666666', 'Professor', 'Pedagógico', CURRENT_DATE)"),
                "grupos_familiares" => format!("INSERT INTO {tbl} (id, tenant_id, responsavel_financeiro_id, nome_familia) VALUES ($1, $2, '{user_b}', 'Família B')"),
                "horarios_turma" => format!("INSERT INTO {tbl} (id, tenant_id, turma_id, disciplina_id, professor_id, dia_semana, hora_inicio, hora_fim) VALUES ($1, $2, '{turma_b_id}', '{disciplina_b_id}', '{user_b}', 1, '07:30', '08:20')"),
                "lead_interacoes" => format!("INSERT INTO {tbl} (id, tenant_id, lead_id, tipo, descricao) VALUES ($1, $2, '{lead_b_id}', 'whatsapp', 'Interação B')"),
                "leads" => format!("INSERT INTO {tbl} (id, tenant_id, nome, email, telefone, canal_aquisicao, estagio_funil) VALUES ($1, $2, 'Lead Test B', 'leadtestb@test.com', '11955555555', 'site', 'novo_lead') ON CONFLICT DO NOTHING"),
                "lgpd_termos" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, consentimento_responsavel) VALUES ($1, $2, '{aluno_b_id}', true)"),
                "login_attempts" => format!("INSERT INTO {tbl} (id, tenant_id, email, ip, success) VALUES ($1, $2, 'userb@test.com', '127.0.0.1', false)"),
                "lms_configs" => format!("INSERT INTO {tbl} (id, tenant_id, lms_type, client_id, platform_url) VALUES ($1, $2, 'moodle', 'client_b_123', 'https://moodle.b.com') ON CONFLICT DO NOTHING"),
                "lms_grade_sync_logs" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, disciplina_nome, atividade_nome, nota) VALUES ($1, $2, '{aluno_b_id}', 'Matemática', 'Prova 1', 8.5)"),
                "mensagens_agenda" => format!("INSERT INTO {tbl} (id, tenant_id, remetente_id, destinatario_id, canal, titulo, conteudo) VALUES ($1, $2, '{user_b}', '{user_b}', 'comunicado', 'Msg B', 'Texto B')"),
                "nfse_emissoes" => {
                    let fat_id = Uuid::new_v4();
                    sqlx::query(&format!("INSERT INTO faturas (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status) VALUES ('{fat_id}', '{tenant_b}', '{aluno_b_id}', 'Fat NFSE B', 1000.0, CURRENT_DATE, 'pago')"))
                        .execute(pool).await.map_err(|e| e.to_string())?;
                    format!("INSERT INTO {tbl} (id, tenant_id, fatura_id, valor_servico, status) VALUES ($1, $2, '{fat_id}', 1000.0, 'processando')")
                },
                "notas" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, disciplina_nome, nota, periodo) VALUES ($1, $2, '{aluno_b_id}', 'Matemática B', 9.5, '1_bimestre')"),
                "notificacoes_disparos_logs" => format!("INSERT INTO {tbl} (id, tenant_id, canal, destino, status_envio) VALUES ($1, $2, 'push', 'destb@test.com', 'enviado')"),
                "notificacoes_sistema" => format!("INSERT INTO {tbl} (id, tenant_id, modulo, titulo, mensagem, canal_disparo) VALUES ($1, $2, 'geral', 'Notif B', 'Mensagem B', 'push_pwa')"),
                "oauth_authorization_codes" => format!("INSERT INTO {tbl} (id, tenant_id, user_id, client_id, code, redirect_uri, code_challenge, code_challenge_method, expires_at) VALUES ($1, $2, '{user_b}', 'client_b', 'code_b_123', 'https://redirect.b.com', 'chal_b', 'S256', NOW() + INTERVAL '10 minutes')"),
                "ocorrencias_aluno" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, professor_id, tipo_ocorrencia, descricao) VALUES ($1, $2, '{aluno_b_id}', '{user_b}', 'disciplinar', 'Ocorrência B')"),
                "perimetro_acessos_logs" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, tipo_identificador, codigo) VALUES ($1, $2, '{aluno_b_id}', 'rfid', 'RFID-B-001')"),
                "perimetro_credenciais" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, codigo) VALUES ($1, $2, '{aluno_b_id}', 'RFID-B-001')"),
                "plano_contas" => format!("INSERT INTO {tbl} (id, tenant_id, codigo, descricao, tipo) VALUES ($1, $2, '1.01.B', 'Receitas B', 'receita')"),
                "portfolio_infantil" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, professor_id, titulo, descricao) VALUES ($1, $2, '{aluno_b_id}', '{user_b}', 'Portfólio B', 'Atividade B')"),
                "pratos" => format!("INSERT INTO {tbl} (id, tenant_id, titulo, descricao_ingredientes) VALUES ($1, $2, 'Prato B', 'Ingredientes B')"),
                "presencas" => {
                    let diario_id = Uuid::new_v4();
                    sqlx::query(&format!("INSERT INTO diarios_classe (id, tenant_id, turma_id, professor_id, data_aula, conteudo_ministrado) VALUES ('{diario_id}', '{tenant_b}', '{turma_b_id}', '{user_b}', CURRENT_DATE, 'Aula Pres B')"))
                        .execute(pool).await.map_err(|e| e.to_string())?;
                    format!("INSERT INTO {tbl} (id, tenant_id, diario_id, aluno_id, presente) VALUES ($1, $2, '{diario_id}', '{aluno_b_id}', true)")
                },
                "projetos_educacionais" => format!("INSERT INTO {tbl} (id, tenant_id, turma_id, titulo, objetivo, data_inicio, data_fim) VALUES ($1, $2, '{turma_b_id}', 'Projeto B', 'Objetivo B', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')"),
                "prontuarios" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id) VALUES ($1, $2, '{aluno_b_id}')"),
                "push_subscriptions" => format!("INSERT INTO {tbl} (id, tenant_id, user_id, endpoint, p256dh, auth) VALUES ($1, $2, '{user_b}', 'https://push.b.com/endpoint', 'p256dhb', 'authb')"),
                "refresh_tokens" => format!("INSERT INTO {tbl} (id, tenant_id, user_id, token_hash, expires_at) VALUES ($1, $2, '{user_b}', 'tokenhash_b_1234567890123456789012345678901234567890123456789012', NOW() + INTERVAL '7 days')"),
                "regua_cobranca_logs" => {
                    let fat_id = Uuid::new_v4();
                    sqlx::query(&format!("INSERT INTO faturas (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status) VALUES ('{fat_id}', '{tenant_b}', '{aluno_b_id}', 'Fat Regua B', 1000.0, CURRENT_DATE, 'pendente')"))
                        .execute(pool).await.map_err(|e| e.to_string())?;
                    format!("INSERT INTO {tbl} (id, tenant_id, fatura_id, canal, tipo_evento) VALUES ($1, $2, '{fat_id}', 'email', 'aviso_vencimento')")
                },
                "responsaveis_alunos" => format!("INSERT INTO {tbl} (id, tenant_id, responsavel_user_id, aluno_id) VALUES ($1, $2, '{user_b}', '{aluno_b_id}')"),
                "restricoes_alimentares_aluno" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, tipo_restricao) VALUES ($1, $2, '{aluno_b_id}', 'Alergia')"),
                "revoked_tokens" => format!("INSERT INTO {tbl} (id, tenant_id, token_hash, expires_at) VALUES ($1, $2, 'revoked_b_123', NOW() + INTERVAL '1 day')"),
                "rotina_diaria_infantil" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, data, refeicao_status, sono_minutos, fraldas_trocas, humor) VALUES ($1, $2, '{aluno_b_id}', CURRENT_DATE, 'excelente', 60, 3, 'alegre')"),
                "salas" => format!("INSERT INTO {tbl} (id, tenant_id, nome, capacidade) VALUES ($1, $2, 'Sala B101', 30)"),
                "scorm_tracking" => format!("INSERT INTO {tbl} (id, tenant_id, aluno_id, package_id) VALUES ($1, $2, '{aluno_b_id}', 'scorm_b_1')"),
                "simulados_itens" => format!("INSERT INTO {tbl} (id, tenant_id, simulado_id, numero_item, parametro_a, parametro_b, parametro_c, gabarito_correto) VALUES ($1, $2, '{simulado_tri_b_id}', 2, 1.1, 0.1, 0.2, 'B') ON CONFLICT DO NOTHING"),
                "simulados_respostas" => format!("INSERT INTO {tbl} (id, tenant_id, simulado_id, aluno_id, respostas_marcadas) VALUES ($1, $2, '{simulado_tri_b_id}', '{aluno_b_id}', '[{{\"numero\": 1, \"resposta\": \"A\"}}]'::jsonb)"),
                "simulados_tri" => format!("INSERT INTO {tbl} (id, tenant_id, titulo, disciplina, data_aplicacao) VALUES ($1, $2, 'Simulado B2', 'ciencias', CURRENT_DATE) ON CONFLICT DO NOTHING"),
                "tenant_bank_integrations" => format!("INSERT INTO {tbl} (id, tenant_id, gateway_name, client_id, client_secret) VALUES ($1, $2, 'cora', 'client_b', 'secret_b')"),
                "tenant_cora_config" => format!("INSERT INTO {tbl} (tenant_id, client_id, client_secret) VALUES ($2, 'cora_client_b', 'cora_secret_b') ON CONFLICT DO NOTHING"),
                "tenant_feature_flags" => format!("INSERT INTO {tbl} (tenant_id, feature_name, is_enabled) VALUES ($2, 'modulo_nutricao', true) ON CONFLICT DO NOTHING"),
                "turma_alunos" => format!("INSERT INTO {tbl} (id, tenant_id, turma_id, aluno_id) VALUES ($1, $2, '{turma_b_id}', '{aluno_b_id}')"),
                "turma_disciplinas" => format!("INSERT INTO {tbl} (id, tenant_id, turma_id, disciplina_id, carga_horaria_semanal) VALUES ($1, $2, '{turma_b_id}', '{disciplina_b_id}', 4)"),
                "turma_professores" => format!("INSERT INTO {tbl} (id, tenant_id, turma_id, disciplina_id, professor_id) VALUES ($1, $2, '{turma_b_id}', '{disciplina_b_id}', '{user_b}')"),
                "turmas" => format!("INSERT INTO {tbl} (id, tenant_id, nome, ano_letivo, etapa_ensino, turno) VALUES ($1, $2, 'Turma B2', 2026, 'fundamental_2', 'vespertino') ON CONFLICT DO NOTHING"),
                "users" => format!("INSERT INTO {tbl} (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'User B2', 'userb2@escola.test', 'hash', 'professor') ON CONFLICT DO NOTHING"),
                _ => return Err(format!("Tabela {tbl} não possui SQL de inserção mapeado no teste de isolamento")),
            };

            let row_id = Uuid::new_v4();
            sqlx::query(&insert_sql)
                .bind(row_id)
                .bind(tenant_b)
                .execute(pool)
                .await
                .map_err(|e| {
                    format!("Falha ao inserir registro do Tenant B na tabela {tbl}: {e}")
                })?;
        }

        // Testar leitura com RLS ativo: Tenant A consulta todas as 61 tabelas
        let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;
        sqlx::query("SET ROLE escolar_runtime")
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;

        for tbl in &tables_with_tenant {
            // 1. Confirmar via conexão admin que o Tenant B possui pelo menos 1 registro na tabela
            let count_b: i64 = sqlx::query_scalar(&format!(
                "SELECT COUNT(*)::bigint FROM {tbl} WHERE tenant_id = $1"
            ))
            .bind(tenant_b)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Falha ao verificar registro prévio no admin para {tbl}: {e}"))?;

            if count_b == 0 {
                return Err(format!("Teste INVÁLIDO: tabela '{tbl}' não possui nenhum registro inserido para o Tenant B!"));
            }

            // 2. Sob a conexão do Tenant A (com RLS escolar_runtime ativo), tentar enxergar dados do Tenant B
            sqlx::query("SELECT set_config('app.current_tenant', $1, false)")
                .bind(tenant_a.to_string())
                .execute(&mut *conn)
                .await
                .map_err(|e| e.to_string())?;

            let query = format!("SELECT COUNT(*)::bigint FROM {tbl} WHERE tenant_id = $1");
            let leaked: i64 = sqlx::query_scalar(&query)
                .bind(tenant_b)
                .fetch_one(&mut *conn)
                .await
                .map_err(|e| format!("Falha ao consultar {tbl} sob tenant A: {e}"))?;

            if leaked != 0 {
                return Err(format!("Vazamento RLS na tabela '{tbl}': tenant A enxergou {leaked} linhas do tenant B"));
            }
        }

        // 3. Teste de escrita cruzada (INSERT com tenant_id diferente)
        // Conectado como escolar_runtime com app.current_tenant = tenant_a, tentar fazer INSERT com tenant_id = tenant_b
        sqlx::query("SELECT set_config('app.current_tenant', $1, false)")
            .bind(tenant_a.to_string())
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;

        let sample_tables = vec![
            ("users", format!("INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ('{}', '{}', 'Cross User', 'cross@test.com', 'hash', 'gestor')", Uuid::new_v4(), tenant_b)),
            ("alunos", format!("INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel) VALUES ('{}', '{}', 'Cross Aluno', '99999999999', '2015-01-01', 'Resp', 'resp@test.com', '11999999999')", Uuid::new_v4(), tenant_b)),
            ("faturas", format!("INSERT INTO faturas (id, tenant_id, aluno_id, contrato_id, descricao, valor, data_vencimento, status) VALUES ('{}', '{}', '{}', '{}', 'Fatura Teste', 100.0, CURRENT_DATE, 'pendente')", Uuid::new_v4(), tenant_b, aluno_b_id, contrato_b_id)),
            ("mensagens_agenda", format!("INSERT INTO mensagens_agenda (id, tenant_id, remetente_id, destinatario_id, canal, titulo, conteudo) VALUES ('{}', '{}', '{}', '{}', 'comunicado', 'Cross Msg', 'Content')", Uuid::new_v4(), tenant_b, user_b, user_b)),
            ("refresh_tokens", format!("INSERT INTO refresh_tokens (id, tenant_id, user_id, token_hash, expires_at) VALUES ('{}', '{}', '{}', 'crosstokenhash12345678901234567890123456789012345678901234567890', NOW() + INTERVAL '1 day')", Uuid::new_v4(), tenant_b, user_b)),
        ];

        for (tbl, insert_query) in sample_tables {
            let res = sqlx::query(&insert_query).execute(&mut *conn).await;
            match res {
                Ok(_) => {
                    return Err(format!(
                        "FALHA DE SEGURANÇA: INSERT cruzado na tabela '{tbl}' com tenant_id do Tenant B foi ACEITO sob contexto do Tenant A!"
                    ));
                }
                Err(sqlx::Error::Database(err)) if err.code().as_deref() == Some("42501") => {
                    // Bloqueado corretamente pelo RLS WITH CHECK (error 42501: insufficient_privilege / rls_policy_violation)
                }
                Err(e) => {
                    return Err(format!(
                        "INSERT cruzado na tabela '{tbl}' falhou por motivo genérico em vez de RLS violation (42501): {e}"
                    ));
                }
            }
        }

        sqlx::query("RESET ROLE")
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
    }

    // 3. Teste de validação pública de código OAuth com RLS ativo
    {
        let oauth_user_id = Uuid::new_v4();
        let oauth_tenant_id = Uuid::new_v4();
        let oauth_code = format!("authcode_test_{}", Uuid::new_v4().simple());
        let client_id = "test_client_sso";

        sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola OAuth', $2)")
            .bind(oauth_tenant_id)
            .bind(format!(
                "escola-oauth-{}",
                &oauth_tenant_id.to_string()[..8]
            ))
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

        sqlx::query(
            "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'OAuth User', $3, 'hash', 'aluno')",
        )
        .bind(oauth_user_id)
        .bind(oauth_tenant_id)
        .bind(format!("oauth-user-{}@escola.test", &oauth_user_id.to_string()[..8]))
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            r#"
            INSERT INTO oauth_authorization_codes (
                id, tenant_id, user_id, client_id, code, redirect_uri, code_challenge, code_challenge_method, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, 'https://client.example.com/cb', 'challenge123', 'S256', NOW() + INTERVAL '10 minutes')
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(oauth_tenant_id)
        .bind(oauth_user_id)
        .bind(client_id)
        .bind(&oauth_code)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

        let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;
        sqlx::query("SET ROLE escolar_runtime")
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;

        // Chamar a função SECURITY DEFINER validar_oauth_code_publico sem app.current_tenant configurado
        let code_record = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String, String, String, bool, chrono::DateTime<Utc>)>(
            "SELECT id, tenant_id, user_id, client_id, redirect_uri, code_challenge, used, expires_at FROM validar_oauth_code_publico($1, $2)",
        )
        .bind(&oauth_code)
        .bind(client_id)
        .fetch_optional(&mut *conn)
        .await
        .map_err(|e| format!("Falha ao chamar validar_oauth_code_publico sob escolar_runtime: {e}"))?;

        let record = code_record.ok_or_else(|| {
            "validar_oauth_code_publico não encontrou o código OAuth inserido".to_string()
        })?;
        if record.1 != oauth_tenant_id || record.2 != oauth_user_id {
            return Err(
                "validar_oauth_code_publico retornou tenant_id ou user_id divergente".into(),
            );
        }

        sqlx::query("RESET ROLE")
            .execute(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
    }

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Gestor', $3, 'hash', 'gestor')",
    )
    .bind(user_a)
    .bind(tenant_a)
    .bind(format!("gestor-{user_a}@escola.test"))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let raw_refresh = "revoked-refresh-token-value";
    let refresh_hash = hash_refresh_token(raw_refresh);
    let expires_at = Utc::now() + Duration::days(7);
    sqlx::query("INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, expires_at, revoked_at) VALUES ($1, $2, $3, $4, NOW())")
        .bind(tenant_a)
        .bind(user_a)
        .bind(&refresh_hash)
        .bind(expires_at)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    let revoked: Option<chrono::DateTime<Utc>> =
        sqlx::query_scalar("SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1")
            .bind(&refresh_hash)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
    if refresh_token_usable(revoked, expires_at, Utc::now()) {
        return Err("refresh revogado foi considerado utilizável".into());
    }

    let (private_pem, public_pem, public_x) = development_signing_material();
    let state = AppState {
        pool: pool.clone(),
        config: Config {
            database_url: String::new(),
            jwt_private_pem: private_pem,
            jwt_public_pem: public_pem,
            jwt_public_x: public_x,
            port: 8000,
            allowed_origins: "*".into(),
            environment: "test".into(),
            trusted_proxy: false,
            rate_limit_public_rpm: 60,
            account_lock_max_attempts: 5,
            account_lock_window_minutes: 15,
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    };
    if refresh_session(
        State(state),
        Json(RefreshDto {
            refresh_token: raw_refresh.to_string(),
        }),
    )
    .await
    .is_ok()
    {
        return Err("refresh revogado gerou novo access token".into());
    }
    let tokens_after: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM refresh_tokens WHERE user_id = $1")
            .bind(user_a)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
    if tokens_after != 1 {
        return Err("refresh revogado gerou token adicional".into());
    }

    let despesa_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO despesas (id, tenant_id, descricao, categoria, valor, data_vencimento, status)
        VALUES ($1, $2, 'Folha', 'folha_pagamento', 100.0, CURRENT_DATE, 'pago')
        "#,
    )
    .bind(despesa_id)
    .bind(tenant_a)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let status: String = sqlx::query_scalar("SELECT status FROM despesas WHERE id = $1")
        .bind(despesa_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    if !despesa_liquidada(&status) {
        return Err("despesa paga deveria ser liquidada e não excluída".into());
    }

    sqlx::query(
        r#"
        INSERT INTO despesas (
            tenant_id, descricao, categoria, valor, data_vencimento, data_pagamento,
            status, tipo, estorno_de
        )
        VALUES ($1, 'Estorno: Folha', 'folha_pagamento', -100.0, CURRENT_DATE, CURRENT_DATE, 'estornada', 'pontual', $2)
        "#,
    )
    .bind(tenant_a)
    .bind(despesa_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    sqlx::query("UPDATE despesas SET status = 'estornada' WHERE id = $1")
        .bind(despesa_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    let still_there: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM despesas WHERE id = $1")
        .bind(despesa_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    let estorno_status: String = sqlx::query_scalar("SELECT status FROM despesas WHERE id = $1")
        .bind(despesa_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    if still_there != 1 || estorno_status != "estornada" {
        return Err(format!(
            "estorno não preservou a despesa ({still_there}, {estorno_status})"
        ));
    }

    let notificacao_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO notificacoes_sistema (id, tenant_id, modulo, titulo, mensagem, canal_disparo, lida)
        VALUES ($1, $2, 'financeiro', 'Cobrança', 'Mensalidade', 'push_pwa', false)
        "#,
    )
    .bind(notificacao_id)
    .bind(tenant_a)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let claimed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM claim_notificacoes_pendentes(10) WHERE id = $1",
    )
    .bind(notificacao_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    if claimed != 1 {
        return Err("fila não reservou a notificação pendente".into());
    }

    let (lida, processamento): (bool, String) =
        sqlx::query_as("SELECT lida, status_processamento FROM notificacoes_sistema WHERE id = $1")
            .bind(notificacao_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
    if lida || processamento != "processando" {
        return Err(format!(
            "reserva alterou leitura ({lida}) ou status {processamento}"
        ));
    }

    sqlx::query("SELECT concluir_notificacao($1, $2, 'enviada')")
        .bind(notificacao_id)
        .bind(tenant_a)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    let (lida_final, status_final): (bool, String) =
        sqlx::query_as("SELECT lida, status_processamento FROM notificacoes_sistema WHERE id = $1")
            .bind(notificacao_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
    if lida_final || status_final != "enviada" {
        return Err(format!(
            "conclusão marcou lida={lida_final} status={status_final}"
        ));
    }

    Ok(())
}
