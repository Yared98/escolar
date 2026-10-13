use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use axum::Router;
use escolar_backend::config::{development_signing_material, AppState, Config};
use escolar_backend::handlers::auth::generate_jwt;
use escolar_backend::routes::create_router;
use serde_json::{json, Value};
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

    let db_name = format!("escolar_ocorrencias_{}", Uuid::new_v4().simple());
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
            cora_client_id: None,
            cora_cert_file: None,
            cora_key_file: None,
            cora_base_url: None,

            email_mode: escolar_backend::config::EmailMode::Simulado,
            app_public_url: "http://localhost:3000".to_string(),
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    }
}

fn auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

/// Cria tenant A com dois professores (um com atribuição e um sem), gestor,
/// secretaria, aluno próprio e aluno de outra família.
#[allow(clippy::type_complexity)]
async fn seed_tenant_a(
    pool: &PgPool,
) -> (
    Uuid,
    Uuid,
    Uuid,
    Uuid,
    Uuid,
    Uuid,
    Uuid,
    Uuid,
    Uuid,
    Uuid,
    Uuid,
) {
    let tenant_id = Uuid::new_v4();
    let prof_id = Uuid::new_v4();
    let prof_outro_id = Uuid::new_v4();
    let gestor_id = Uuid::new_v4();
    let secretaria_id = Uuid::new_v4();
    let responsavel_id = Uuid::new_v4();
    let responsavel_outro_id = Uuid::new_v4();
    let turma_id = Uuid::new_v4();
    let disciplina_id = Uuid::new_v4();
    let aluno_id = Uuid::new_v4();
    let aluno_outro_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola A', $2)")
        .bind(tenant_id)
        .bind(format!("escola-a-{}", &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    for (id, name, email, role) in [
        (prof_id, "Prof A", "prof@a.test", "professor"),
        (prof_outro_id, "Prof Outro", "profoutro@a.test", "professor"),
        (gestor_id, "Gestor A", "gestor@a.test", "gestor"),
        (secretaria_id, "Secretaria A", "sec@a.test", "secretaria"),
        (responsavel_id, "Resp A", "resp@a.test", "responsavel"),
        (
            responsavel_outro_id,
            "Resp Outro",
            "respoutro@a.test",
            "responsavel",
        ),
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
        "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, '6º Ano A', 2026, 'fundamental_2', 'matutino', 'ativo')",
    )
    .bind(turma_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES ($1, $2, 'Matemática', 'MAT-01', 'ativo')",
    )
    .bind(disciplina_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turma_disciplinas (id, tenant_id, turma_id, disciplina_id) VALUES (gen_random_uuid(), $1, $2, $3)",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(disciplina_id)
    .execute(pool)
    .await
    .unwrap();

    // Atribuição do professor A na turma.
    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(disciplina_id)
    .bind(prof_id)
    .execute(pool)
    .await
    .unwrap();

    for (aluno, responsavel, nome, cpf) in [
        (aluno_id, responsavel_id, "Aluno 1", "11111111111"),
        (
            aluno_outro_id,
            responsavel_outro_id,
            "Aluno 2",
            "22222222222",
        ),
    ] {
        sqlx::query(
            r#"
            INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, responsavel_user_id, status)
            VALUES ($1, $2, $3, $4, '2012-01-01', 'Resp', $5, '11999999999', $6, 'ativo')
            "#,
        )
        .bind(aluno)
        .bind(tenant_id)
        .bind(nome)
        .bind(cpf)
        .bind(format!("{cpf}@test.com"))
        .bind(responsavel)
        .execute(pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, numero_chamada, status) VALUES (gen_random_uuid(), $1, $2, $3, 1, 'ativo')",
        )
        .bind(tenant_id)
        .bind(turma_id)
        .bind(aluno)
        .execute(pool)
        .await
        .unwrap();
    }

    (
        tenant_id,
        prof_id,
        prof_outro_id,
        gestor_id,
        secretaria_id,
        responsavel_id,
        responsavel_outro_id,
        turma_id,
        disciplina_id,
        aluno_id,
        aluno_outro_id,
    )
}

async fn seed_tenant_b(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid) {
    let tenant_id = Uuid::new_v4();
    let prof_b_id = Uuid::new_v4();
    let turma_b_id = Uuid::new_v4();
    let aluno_b_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola B', $2)")
        .bind(tenant_id)
        .bind(format!("escola-b-{}", &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Prof B', 'prof@b.test', 'hash', 'professor')",
    )
    .bind(prof_b_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, 'Turma B', 2026, 'fundamental_1', 'matutino', 'ativo')",
    )
    .bind(turma_b_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES (gen_random_uuid(), $1, 'Português', 'PORT-01', 'ativo')",
    )
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id)
        SELECT gen_random_uuid(), $1, $2, d.id, $3 FROM disciplinas d
        WHERE d.tenant_id = $1
        "#,
    )
    .bind(tenant_id)
    .bind(turma_b_id)
    .bind(prof_b_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, status)
        VALUES ($1, $2, 'Aluno B', '33333333333', '2012-02-02', 'Resp', 'respb@test.com', '11999999999', 'ativo')
        "#,
    )
    .bind(aluno_b_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, numero_chamada, status) VALUES (gen_random_uuid(), $1, $2, $3, 1, 'ativo')",
    )
    .bind(tenant_id)
    .bind(turma_b_id)
    .bind(aluno_b_id)
    .execute(pool)
    .await
    .unwrap();

    (tenant_id, prof_b_id, turma_b_id, aluno_b_id)
}

/// Executa uma requisicação contra o app de teste.
async fn chamar(
    app: &Router,
    method: Method,
    uri: &str,
    token: &str,
    tenant: Uuid,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("Authorization", auth_header(token))
        .header("X-Tenant-ID", tenant.to_string());
    let body = match body {
        Some(payload) => {
            builder = builder.header("Content-Type", "application/json");
            Body::from(payload.to_string())
        }
        None => Body::empty(),
    };
    let res = app
        .clone()
        .oneshot(builder.body(body).unwrap())
        .await
        .unwrap();

    let status = res.status();
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let payload: Value = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(&bytes).unwrap_or(json!({}))
    };
    (status, payload)
}

#[tokio::test]
async fn ocorrencias_do_fundamental_vinculo_papel_e_isolamento() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de ocorrências ignorado.");
        return;
    };

    let (
        tenant_a,
        prof_a,
        prof_outro,
        gestor_a,
        secretaria_a,
        responsavel_a,
        responsavel_outro,
        turma_a,
        _disciplina_a,
        aluno_a,
        aluno_outro,
    ) = seed_tenant_a(&pool).await;
    let (tenant_b, prof_b, turma_b, aluno_b) = seed_tenant_b(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);

    let material = development_signing_material();
    let token = |id: Uuid, role: &str| {
        generate_jwt(id, tenant_a, role, &material.0).expect("token de teste")
    };
    let token_prof_a = token(prof_a, "professor");
    let token_prof_outro = token(prof_outro, "professor");
    let token_gestor = token(gestor_a, "gestor");
    let token_secretaria = token(secretaria_a, "secretaria");
    let token_responsavel = token(responsavel_a, "responsavel");
    let token_responsavel_outro = token(responsavel_outro, "responsavel");
    let token_prof_b =
        generate_jwt(prof_b, tenant_b, "professor", &material.0).expect("token prof B");

    let corpo = json!({
        "aluno_id": aluno_a,
        "turma_id": turma_a,
        "tipo_ocorrencia": "comportamento",
        "descricao": "Interrompeu a aula repetidamente.",
        "notificado_responsavel": true
    });

    // 1. Professor com atribuição na turma registra a ocorrência (200).
    let (status, criada) = chamar(
        &app,
        Method::POST,
        "/api/v1/agenda/ocorrencias",
        &token_prof_a,
        tenant_a,
        Some(corpo.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "professor atribuído deve registrar");
    let ocorrencia_id = criada["id"].as_str().expect("id da ocorrência");
    assert_eq!(criada["tipo_ocorrencia"], "comportamento");
    assert_eq!(criada["notificado_responsavel"], true);
    assert_eq!(criada["lido_pelo_responsavel"], false);

    // 2. Professor sem vínculo com a turma do aluno recebe 403.
    let (status, _) = chamar(
        &app,
        Method::POST,
        "/api/v1/agenda/ocorrencias",
        &token_prof_outro,
        tenant_a,
        Some(corpo.clone()),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "professor sem vínculo leva 403"
    );

    // 3. Gestor e secretaria registram (200) — antes só admin e professor podiam.
    for tok in [&token_gestor, &token_secretaria] {
        let (status, _) = chamar(
            &app,
            Method::POST,
            "/api/v1/agenda/ocorrencias",
            tok,
            tenant_a,
            Some(corpo.clone()),
        )
        .await;
        assert_eq!(
            status,
            StatusCode::OK,
            "gestão e secretaria devem registrar"
        );
    }

    // 4. Elogio e saúde sempre avisam a família, mesmo com a opção desmarcada.
    for tipo in ["elogio", "saude"] {
        let (status, criada) = chamar(
            &app,
            Method::POST,
            "/api/v1/agenda/ocorrencias",
            &token_prof_a,
            tenant_a,
            Some(json!({
                "aluno_id": aluno_a,
                "turma_id": turma_a,
                "tipo_ocorrencia": tipo,
                "descricao": "Registro automático do teste.",
                "notificado_responsavel": false
            })),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            criada["notificado_responsavel"], true,
            "{tipo} deve sempre avisar a família"
        );
    }

    // 5. Tipo desconhecido é rejeitado (400).
    let (status, _) = chamar(
        &app,
        Method::POST,
        "/api/v1/agenda/ocorrencias",
        &token_prof_a,
        tenant_a,
        Some(json!({
            "aluno_id": aluno_a,
            "turma_id": turma_a,
            "tipo_ocorrencia": "grita",
            "descricao": "Teste de tipo inválido."
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // 6. Descrição vazia é rejeitada (400).
    let (status, _) = chamar(
        &app,
        Method::POST,
        "/api/v1/agenda/ocorrencias",
        &token_prof_a,
        tenant_a,
        Some(json!({
            "aluno_id": aluno_a,
            "turma_id": turma_a,
            "tipo_ocorrencia": "atraso",
            "descricao": "   "
        })),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // 7. Responsável lê as ocorrências do próprio filho (200).
    let (status, lista) = chamar(
        &app,
        Method::GET,
        &format!("/api/v1/agenda/ocorrencias/{aluno_a}"),
        &token_responsavel,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let itens = lista.as_array().expect("lista de ocorrências");
    assert!(itens.len() >= 5, "esperava as ocorrências registradas");
    assert!(itens.iter().any(|o| o["id"] == ocorrencia_id));
    // Mais recente primeiro.
    assert!(
        itens[0]["created_at"].as_str() >= itens[itens.len() - 1]["created_at"].as_str(),
        "a lista deve vir da mais recente para a mais antiga"
    );

    // 8. Responsável de outro aluno não acessa (403).
    let (status, _) = chamar(
        &app,
        Method::GET,
        &format!("/api/v1/agenda/ocorrencias/{aluno_outro}"),
        &token_responsavel,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let _ = token_responsavel_outro;

    // 9. Outro tenant não vê as ocorrências da escola A (403).
    let (status, _) = chamar(
        &app,
        Method::GET,
        &format!("/api/v1/agenda/ocorrencias/{aluno_a}"),
        &token_prof_b,
        tenant_b,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // 10. Professor de outra turma não lista ocorrências da turma (403).
    let (status, _) = chamar(
        &app,
        Method::GET,
        &format!("/api/v1/agenda/ocorrencias?turma_id={turma_a}"),
        &token_prof_outro,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // 11. Professor atribuído lista as ocorrências da turma no dia (200).
    let hoje = (chrono::Utc::now() - chrono::Duration::hours(3)).date_naive();
    let amanha = hoje + chrono::Duration::days(1);
    let (status, lista) = chamar(
        &app,
        Method::GET,
        &format!("/api/v1/agenda/ocorrencias?turma_id={turma_a}&data={hoje}"),
        &token_prof_a,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let itens = lista.as_array().expect("lista da turma");
    assert_eq!(itens.len(), 5, "as cinco ocorrências foram gravadas hoje");
    assert!(itens.iter().all(|o| o["aluno_id"] == aluno_a.to_string()));

    // Sem data: devolve todas as ocorrências da turma.
    let (status, lista) = chamar(
        &app,
        Method::GET,
        &format!("/api/v1/agenda/ocorrencias?turma_id={turma_a}"),
        &token_gestor,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(lista.as_array().expect("lista").len(), 5);

    // 12. Filtro por outro dia devolve lista vazia.
    let (status, lista) = chamar(
        &app,
        Method::GET,
        &format!("/api/v1/agenda/ocorrencias?turma_id={turma_a}&data={amanha}"),
        &token_prof_a,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(
        lista.as_array().expect("lista").is_empty(),
        "não há ocorrência no outro dia"
    );

    // 13. Isolamento: a turma do outro tenant só devolve as ocorrências dela.
    let (status, _) = chamar(
        &app,
        Method::POST,
        "/api/v1/agenda/ocorrencias",
        &token_prof_b,
        tenant_b,
        Some(json!({
            "aluno_id": aluno_b,
            "turma_id": turma_b,
            "tipo_ocorrencia": "atraso",
            "descricao": "Chegou atrasado na Escola B."
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, lista) = chamar(
        &app,
        Method::GET,
        &format!("/api/v1/agenda/ocorrencias?turma_id={turma_b}"),
        &token_prof_b,
        tenant_b,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let itens_b = lista.as_array().expect("lista da escola B");
    assert_eq!(itens_b.len(), 1, "só a ocorrência da própria escola");
    assert_eq!(itens_b[0]["aluno_id"], aluno_b.to_string());
    assert!(
        !itens_b.iter().any(|o| o["aluno_id"] == aluno_a.to_string()),
        "ocorrência da escola A não pode vazar para a escola B"
    );

    pool.close().await;
    drop_database(&admin, &db_name).await;
}
