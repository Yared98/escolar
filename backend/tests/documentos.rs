use axum::body::Body;
use axum::http::{Request, StatusCode};
use escolar_backend::config::{development_signing_material, AppState, Config};
use escolar_backend::handlers::auth::generate_jwt;
use escolar_backend::routes::create_router;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tower::ServiceExt;
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
    let _ = sqlx::query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    )
    .bind(name)
    .execute(admin)
    .await;
    let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS {name}"))
        .execute(admin)
        .await;
}

async fn setup_pool() -> Option<(PgPool, String, PgPool)> {
    let admin_url = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())?;

    let db_name = format!("escolar_documentos_{}", Uuid::new_v4().simple());
    let admin = match PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&admin_url)
        .await
    {
        Ok(pool) => pool,
        Err(e) => {
            eprintln!("Não foi possível conectar ao Postgres de teste ({e}); teste ignorado.");
            return None;
        }
    };

    if let Err(e) = sqlx::query(&format!("CREATE DATABASE {db_name}"))
        .execute(&admin)
        .await
    {
        eprintln!("Falha ao criar database de teste ({e}); teste ignorado.");
        return None;
    }

    let pool = match PgPoolOptions::new()
        .max_connections(4)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url_for(&admin_url, &db_name))
        .await
    {
        Ok(pool) => pool,
        Err(e) => {
            eprintln!("Falha ao conectar no database de teste ({e}); teste ignorado.");
            let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS {db_name}"))
                .execute(&admin)
                .await;
            return None;
        }
    };

    if let Err(e) = sqlx::migrate!("./migrations").run(&pool).await {
        eprintln!("Falha ao rodar migrations de teste ({e}); teste ignorado.");
        let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS {db_name}"))
            .execute(&admin)
            .await;
        return None;
    }

    Some((admin, db_name, pool))
}

fn app_state(pool: PgPool) -> AppState {
    let (private_pem, public_pem, public_x) = development_signing_material();
    AppState {
        pool,
        config: Config {
            database_url: String::new(),
            jwt_private_pem: private_pem,
            jwt_public_pem: public_pem,
            jwt_public_x: public_x,
            port: 8000,
            allowed_origins: "http://localhost:3000".into(),
            environment: "test".into(),
            trusted_proxy: false,
            rate_limit_public_rpm: 60,
            account_lock_max_attempts: 5,
            account_lock_window_minutes: 15,
            cora_mode: escolar_backend::config::CoraMode::Mock,
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    }
}

fn auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

async fn seed_tenant_a(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
    let tenant_id = Uuid::new_v4();
    let secretaria_id = Uuid::new_v4();
    let professor_id = Uuid::new_v4();
    let turma_id = Uuid::new_v4();
    let aluno_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO tenants (id, name, slug, cnpj) VALUES ($1, 'Escola Modelo A', $2, '12.345.678/0001-90')",
    )
    .bind(tenant_id)
    .bind(format!("escola-a-{}", &tenant_id.to_string()[..8]))
    .execute(pool)
    .await
    .unwrap();

    for (id, name, email, role) in [
        (
            secretaria_id,
            "Secretaria A",
            "secretaria@a.test",
            "secretaria",
        ),
        (professor_id, "Professor A", "prof@a.test", "professor"),
    ] {
        sqlx::query(
            "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'hash', $5)",
        )
        .bind(id)
        .bind(tenant_id)
        .bind(name)
        .bind(email)
        .bind(role)
        .execute(pool)
        .await
        .unwrap();
    }

    sqlx::query(
        "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, '1º Ano A', 2026, 'fundamental_1', 'matutino', 'ativo')",
    )
    .bind(turma_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel)
        VALUES ($1, $2, 'Maria Eduarda Silva', '11111111111', '2015-03-10', 'Ana Silva', 'ana@a.test', '11999999999')
        "#,
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, numero_chamada, status) VALUES (gen_random_uuid(), $1, $2, $3, 1, 'ativo')",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(aluno_id)
    .execute(pool)
    .await
    .unwrap();

    // Nota para histórico escolar
    sqlx::query(
        "INSERT INTO notas (id, tenant_id, aluno_id, disciplina_nome, nota, periodo) VALUES (gen_random_uuid(), $1, $2, 'Matemática', 8.5, '1_bimestre')",
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .execute(pool)
    .await
    .unwrap();

    // Frequência: 2 aulas, 1 presença
    let diario1 = Uuid::new_v4();
    let diario2 = Uuid::new_v4();
    for (d_id, presente) in [(diario1, true), (diario2, false)] {
        sqlx::query(
            "INSERT INTO diarios_classe (id, tenant_id, turma_id, professor_id, data_aula, conteudo_ministrado) VALUES ($1, $2, $3, $4, '2026-04-10', 'Aula teste')",
        )
        .bind(d_id)
        .bind(tenant_id)
        .bind(turma_id)
        .bind(professor_id)
        .execute(pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO presencas (id, tenant_id, diario_id, aluno_id, presente) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
        )
        .bind(tenant_id)
        .bind(d_id)
        .bind(aluno_id)
        .bind(presente)
        .execute(pool)
        .await
        .unwrap();
    }

    (tenant_id, secretaria_id, professor_id, turma_id, aluno_id)
}

async fn seed_tenant_b(pool: &PgPool) -> (Uuid, Uuid) {
    let tenant_id = Uuid::new_v4();
    let aluno_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola B', $2)")
        .bind(tenant_id)
        .bind(format!("escola-b-{}", &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        r#"
        INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel)
        VALUES ($1, $2, 'Aluno B', '22222222222', '2014-05-20', 'Resp B', 'resp@b.test', '11988888888')
        "#,
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    (tenant_id, aluno_id)
}

async fn emitir_documento_req(
    app: axum::Router,
    token: &str,
    tenant_id: Uuid,
    aluno_id: Uuid,
    tipo: &str,
) -> axum::response::Response {
    let req = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/secretaria/alunos/{aluno_id}/documento?tipo={tipo}"
        ))
        .header("Authorization", auth_header(token))
        .header("X-Tenant-ID", tenant_id.to_string())
        .body(Body::empty())
        .unwrap();
    app.oneshot(req).await.unwrap()
}

#[tokio::test]
async fn documentos_secretaria_emite_declaracao_proprio_tenant() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de documentos ignorado.");
        return;
    };

    let (tenant_a, secretaria_id, _professor_id, _turma_id, aluno_id) = seed_tenant_a(&pool).await;
    let (_tenant_b, aluno_b_id) = seed_tenant_b(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);
    let private_pem = development_signing_material().0;

    let token_secretaria = generate_jwt(secretaria_id, tenant_a, "secretaria", &private_pem)
        .expect("token secretaria");
    let token_professor = generate_jwt(
        Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap(),
        tenant_a,
        "professor",
        &private_pem,
    )
    .expect("token professor");

    // 1. Secretaria emite declaração de matrícula (200)
    let res = emitir_documento_req(
        app.clone(),
        &token_secretaria,
        tenant_a,
        aluno_id,
        "declaracao_matricula",
    )
    .await;
    assert_eq!(res.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let doc: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(doc["tipo"], "declaracao_matricula");
    assert_eq!(doc["escola"]["nome"], "Escola Modelo A");
    assert_eq!(doc["escola"]["cnpj"], "12.345.678/0001-90");
    assert!(doc["escola"]["endereco"].is_null());
    assert_eq!(doc["aluno"]["nome"], "Maria Eduarda Silva");
    assert_eq!(doc["aluno"]["cpf"], "11111111111");
    assert!(doc["aluno"]["matricula"].is_null());
    assert_eq!(doc["situacao_matricula"], "ativo");
    assert!(doc["turma"].is_object());
    assert_eq!(doc["turma"]["nome"], "1º Ano A");
    assert_eq!(doc["turma"]["ano_letivo"], 2026);
    assert!(doc["frequencia"].is_null());
    assert!(doc["historico"].is_null());
    assert!(doc["emitido_em"].is_string());
    assert_eq!(doc["codigo_verificacao"].as_str().unwrap().len(), 16);

    // 2. Audit gravado
    let audit: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM audit_logs WHERE tenant_id = $1 AND acao = 'DOCUMENTO_EMITIDO' AND entidade_id = $2",
    )
    .bind(tenant_a)
    .bind(aluno_id.to_string())
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audit, 1);

    // 3. Professor recebe 403
    let res_forbidden = emitir_documento_req(
        app.clone(),
        &token_professor,
        tenant_a,
        aluno_id,
        "declaracao_matricula",
    )
    .await;
    assert_eq!(res_forbidden.status(), StatusCode::FORBIDDEN);

    // 4. Aluno de outro tenant retorna 404
    let res_not_found = emitir_documento_req(
        app,
        &token_secretaria,
        tenant_a,
        aluno_b_id,
        "declaracao_matricula",
    )
    .await;
    assert_eq!(res_not_found.status(), StatusCode::NOT_FOUND);

    pool.close().await;
    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn documentos_frequencia_e_historico_retornam_dados() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de documentos ignorado.");
        return;
    };

    let (tenant_a, secretaria_id, _professor_id, _turma_id, aluno_id) = seed_tenant_a(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);
    let private_pem = development_signing_material().0;

    let token_secretaria = generate_jwt(secretaria_id, tenant_a, "secretaria", &private_pem)
        .expect("token secretaria");

    // Declaração de frequência
    let res = emitir_documento_req(
        app.clone(),
        &token_secretaria,
        tenant_a,
        aluno_id,
        "declaracao_frequencia",
    )
    .await;
    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let doc: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(doc["frequencia"]["total_aulas"], 2);
    assert_eq!(doc["frequencia"]["presencas"], 1);
    assert_eq!(doc["frequencia"]["percentual"], 50.0);

    // Histórico escolar
    let res = emitir_documento_req(app, &token_secretaria, tenant_a, aluno_id, "historico").await;
    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let doc: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    let historico = doc["historico"].as_array().unwrap();
    assert_eq!(historico.len(), 1);
    assert_eq!(historico[0]["disciplina"], "Matemática");
    assert_eq!(historico[0]["media"], 8.5);
    assert_eq!(historico[0]["notas"].as_array().unwrap().len(), 1);

    pool.close().await;
    drop_database(&admin, &db_name).await;
}
