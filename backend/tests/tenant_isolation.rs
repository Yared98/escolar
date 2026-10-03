use axum::extract::{Json, State};
use chrono::{Duration, Utc};
use escolar_backend::config::{development_signing_material, AppState, Config};
use escolar_backend::handlers::auth::{hash_refresh_token, refresh_session, refresh_token_usable, RefreshDto};
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

    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();
    let user_a = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola A', $2), ($3, 'Escola B', $4)")
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
        let leaked: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM alunos WHERE nome = 'Aluno B'")
            .fetch_one(&mut *conn)
            .await
            .map_err(|e| e.to_string())?;
        if visible != 1 || leaked != 0 {
            return Err(format!("RLS com tenant A retornou {visible} linhas e {leaked} do tenant B"));
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

    let revoked: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
        "SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1",
    )
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
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
    };
    if refresh_session(State(state), Json(RefreshDto { refresh_token: raw_refresh.to_string() }))
        .await
        .is_ok()
    {
        return Err("refresh revogado gerou novo access token".into());
    }
    let tokens_after: i64 = sqlx::query_scalar("SELECT COUNT(*)::bigint FROM refresh_tokens WHERE user_id = $1")
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
        return Err(format!("estorno não preservou a despesa ({still_there}, {estorno_status})"));
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

    let (lida, processamento): (bool, String) = sqlx::query_as(
        "SELECT lida, status_processamento FROM notificacoes_sistema WHERE id = $1",
    )
    .bind(notificacao_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    if lida || processamento != "processando" {
        return Err(format!("reserva alterou leitura ({lida}) ou status {processamento}"));
    }

    sqlx::query("SELECT concluir_notificacao($1, $2, 'enviada')")
        .bind(notificacao_id)
        .bind(tenant_a)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    let (lida_final, status_final): (bool, String) = sqlx::query_as(
        "SELECT lida, status_processamento FROM notificacoes_sistema WHERE id = $1",
    )
    .bind(notificacao_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    if lida_final || status_final != "enviada" {
        return Err(format!("conclusão marcou lida={lida_final} status={status_final}"));
    }

    Ok(())
}
