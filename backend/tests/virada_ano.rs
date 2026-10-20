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

    let db_name = format!("escolar_virada_{}", Uuid::new_v4().simple());
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
            app_secrets_key: None,
            itau_mode: escolar_backend::config::ItauMode::Mock,
            itau_sts_base_url: None,
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    }
}

fn auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

struct TestFixture {
    tenant_id: Uuid,
    gestor_id: Uuid,
    prof_id: Uuid,
    turma_id: Uuid,
    disciplina_id: Uuid,
    aluno_aprovado_id: Uuid,
    aluno_reprovado_id: Uuid,
    aluno_andamento_id: Uuid,
}

async fn seed_cenario(pool: &PgPool) -> TestFixture {
    let tenant_id = Uuid::new_v4();
    let gestor_id = Uuid::new_v4();
    let prof_id = Uuid::new_v4();
    let turma_id = Uuid::new_v4();
    let disciplina_id = Uuid::new_v4();
    let aluno_aprovado_id = Uuid::new_v4();
    let aluno_reprovado_id = Uuid::new_v4();
    let aluno_andamento_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola Modelo', $2)")
        .bind(tenant_id)
        .bind(format!("escola-{}", &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    for (id, name, email, role) in [
        (gestor_id, "Gestor", "gestor@test.com", "gestor"),
        (prof_id, "Professor", "prof@test.com", "professor"),
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

    // Turma 2026: 1º Ano A
    sqlx::query(
        r#"
        INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, serie, turno, status, capacidade_maxima)
        VALUES ($1, $2, '1º Ano A', 2026, 'fundamental_1', '1º Ano', 'matutino', 'ativo', 30)
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    // Disciplina
    sqlx::query(
        "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES ($1, $2, 'Matemática', 'MAT-1', 'ativo')",
    )
    .bind(disciplina_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    // Matriz Curricular
    sqlx::query(
        "INSERT INTO turma_disciplinas (id, tenant_id, turma_id, disciplina_id, carga_horaria_semanal, carga_horaria_anual) VALUES (gen_random_uuid(), $1, $2, $3, 4, 160)",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(disciplina_id)
    .execute(pool)
    .await
    .unwrap();

    // Atribuição Docente
    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id, ano_letivo) VALUES (gen_random_uuid(), $1, $2, $3, $4, 2026)",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(disciplina_id)
    .bind(prof_id)
    .execute(pool)
    .await
    .unwrap();

    // Alunos
    for (id, nome, cpf) in [
        (aluno_aprovado_id, "Alice Aprovada", "11111111101"),
        (aluno_reprovado_id, "Beto Reprovado", "11111111102"),
        (aluno_andamento_id, "Carlos Andamento", "11111111103"),
    ] {
        sqlx::query(
            r#"
            INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, status)
            VALUES ($1, $2, $3, $4, '2019-01-01', 'Resp', 'resp@test.com', '11999999999', 'ativo')
            "#,
        )
        .bind(id)
        .bind(tenant_id)
        .bind(nome)
        .bind(cpf)
        .execute(pool)
        .await
        .unwrap();

        // Enturmação ativa no ano 2026
        sqlx::query(
            "INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, status) VALUES (gen_random_uuid(), $1, $2, $3, 'ativo')",
        )
        .bind(tenant_id)
        .bind(turma_id)
        .bind(id)
        .execute(pool)
        .await
        .unwrap();

        // Contrato 2026
        sqlx::query(
            "INSERT INTO contratos (id, tenant_id, aluno_id, ano_letivo, valor_total, status) VALUES (gen_random_uuid(), $1, $2, 2026, 12000.0, 'assinado')",
        )
        .bind(tenant_id)
        .bind(id)
        .execute(pool)
        .await
        .unwrap();
    }

    // Lançamento de notas:
    // Alice Aprovada: 4 bimestres nota 8.5
    for bim in ["1_bimestre", "2_bimestre", "3_bimestre", "4_bimestre"] {
        sqlx::query(
            "INSERT INTO notas (id, tenant_id, aluno_id, disciplina_nome, periodo, nota) VALUES (gen_random_uuid(), $1, $2, 'Matemática', $3, 8.5)",
        )
        .bind(tenant_id)
        .bind(aluno_aprovado_id)
        .bind(bim)
        .execute(pool)
        .await
        .unwrap();
    }

    // Beto Reprovado: 4 bimestres nota 3.0
    for bim in ["1_bimestre", "2_bimestre", "3_bimestre", "4_bimestre"] {
        sqlx::query(
            "INSERT INTO notas (id, tenant_id, aluno_id, disciplina_nome, periodo, nota) VALUES (gen_random_uuid(), $1, $2, 'Matemática', $3, 3.0)",
        )
        .bind(tenant_id)
        .bind(aluno_reprovado_id)
        .bind(bim)
        .execute(pool)
        .await
        .unwrap();
    }

    // Carlos Andamento: apenas 1_bimestre nota 7.0
    sqlx::query(
        "INSERT INTO notas (id, tenant_id, aluno_id, disciplina_nome, periodo, nota) VALUES (gen_random_uuid(), $1, $2, 'Matemática', '1_bimestre', 7.0)",
    )
    .bind(tenant_id)
    .bind(aluno_andamento_id)
    .execute(pool)
    .await
    .unwrap();

    TestFixture {
        tenant_id,
        gestor_id,
        prof_id,
        turma_id,
        disciplina_id,
        aluno_aprovado_id,
        aluno_reprovado_id,
        aluno_andamento_id,
    }
}

#[tokio::test]
async fn test_previa_virada_ano() {
    let (admin, db_name, pool) = match setup_pool().await {
        Some(triple) => triple,
        None => return,
    };

    let f = seed_cenario(&pool).await;
    let state = app_state(pool.clone());
    let token = generate_jwt(
        f.gestor_id,
        f.tenant_id,
        "gestor",
        &state.config.jwt_private_pem,
    )
    .unwrap();

    let app = create_router(state);
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/secretaria/virada-ano/previa?ano_origem=2026&ano_destino=2027")
        .header("authorization", auth_header(&token))
        .header("x-tenant-id", f.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["ano_origem"], 2026);
    assert_eq!(json["ano_destino"], 2027);
    assert_eq!(json["ja_executada"], false);

    let turmas = json["turmas"].as_array().unwrap();
    assert_eq!(turmas.len(), 1);

    let t = &turmas[0];
    assert_eq!(t["turma_origem_nome"], "1º Ano A");
    assert_eq!(t["sugestao_proxima_serie"], "2º Ano");
    assert_eq!(t["sugestao_proxima_etapa"], "fundamental_1");
    assert_eq!(t["sugestao_nome_turma"], "2º Ano A");

    let alunos = t["alunos"].as_array().unwrap();
    assert_eq!(alunos.len(), 3);

    let alice = alunos
        .iter()
        .find(|a| a["aluno_id"] == f.aluno_aprovado_id.to_string())
        .unwrap();
    assert_eq!(alice["status_boletim"], "Aprovado");
    assert_eq!(alice["acao_sugerida"], "promover");

    let beto = alunos
        .iter()
        .find(|a| a["aluno_id"] == f.aluno_reprovado_id.to_string())
        .unwrap();
    assert_eq!(beto["status_boletim"], "Reprovado");
    assert_eq!(beto["acao_sugerida"], "reter");

    let carlos = alunos
        .iter()
        .find(|a| a["aluno_id"] == f.aluno_andamento_id.to_string())
        .unwrap();
    assert_eq!(carlos["status_boletim"], "Em andamento");
    assert_eq!(carlos["acao_sugerida"], "decidir");

    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn test_execucao_e_idempotencia_virada_ano() {
    let (admin, db_name, pool) = match setup_pool().await {
        Some(triple) => triple,
        None => return,
    };

    let f = seed_cenario(&pool).await;
    let state = app_state(pool.clone());
    let token = generate_jwt(
        f.gestor_id,
        f.tenant_id,
        "gestor",
        &state.config.jwt_private_pem,
    )
    .unwrap();

    let nova_turma_2_ano_id = Uuid::new_v4();

    let payload = serde_json::json!({
        "ano_origem": 2026,
        "ano_destino": 2027,
        "copiar_professores": true,
        "gerar_contratos": true,
        "turmas": [
            {
                "turma_origem_id": f.turma_id,
                "nova_turma": {
                    "id": nova_turma_2_ano_id,
                    "nome": "2º Ano A",
                    "serie": "2º Ano",
                    "etapa_ensino": "fundamental_1",
                    "turno": "matutino"
                }
            }
        ],
        "alunos": [
            {
                "aluno_id": f.aluno_aprovado_id,
                "acao": "promover"
            },
            {
                "aluno_id": f.aluno_reprovado_id,
                "acao": "reter"
            },
            {
                "aluno_id": f.aluno_andamento_id,
                "acao": "nao_rematricular"
            }
        ]
    });

    // Destino do ano anterior é recusado (reativaria a matrícula de 2026) e nada é gravado.
    let mut payload_errado = payload.clone();
    payload_errado["alunos"][1]["turma_destino_id"] = serde_json::json!(f.turma_id);
    let req_errado = Request::builder()
        .method("POST")
        .uri("/api/v1/secretaria/virada-ano/executar")
        .header("authorization", auth_header(&token))
        .header("x-tenant-id", f.tenant_id.to_string())
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload_errado).unwrap()))
        .unwrap();
    let res_errado = create_router(state.clone())
        .oneshot(req_errado)
        .await
        .unwrap();
    assert_eq!(res_errado.status(), StatusCode::BAD_REQUEST);

    let app = create_router(state.clone());
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/secretaria/virada-ano/executar")
        .header("authorization", auth_header(&token))
        .header("x-tenant-id", f.tenant_id.to_string())
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["sucesso"], true);
    assert_eq!(json["turmas_criadas"], 2); // 2º Ano A (promoção) e 1º Ano A de 2027 (retido)
    assert_eq!(json["alunos_promovidos"], 1);
    assert_eq!(json["alunos_retidos"], 1);
    assert_eq!(json["alunos_nao_rematriculados"], 1);
    assert_eq!(json["contratos_gerados"], 2); // Alice (promovida) e Beto (retido)

    // Verificações no banco de dados:
    // 1. Nova turma 2027 criada com matriz e professor
    let turma_2027_existe = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM turmas WHERE id = $1 AND ano_letivo = 2027 AND status = 'ativo')",
    )
    .bind(nova_turma_2_ano_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(turma_2027_existe);

    let matriz_copiada = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM turma_disciplinas WHERE turma_id = $1 AND disciplina_id = $2)",
    )
    .bind(nova_turma_2_ano_id)
    .bind(f.disciplina_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(matriz_copiada);

    let prof_copiado = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM turma_professores WHERE turma_id = $1 AND professor_id = $2 AND ano_letivo = 2027)",
    )
    .bind(nova_turma_2_ano_id)
    .bind(f.prof_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(prof_copiado);

    // 2. Enturmações antigas de 2026 concluídas (sem apagar)
    let status_antigo_alice = sqlx::query_scalar::<_, String>(
        "SELECT status FROM turma_alunos WHERE turma_id = $1 AND aluno_id = $2",
    )
    .bind(f.turma_id)
    .bind(f.aluno_aprovado_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status_antigo_alice, "concluido");

    // 3. Alice ativa na turma de 2027
    let status_novo_alice = sqlx::query_scalar::<_, String>(
        "SELECT status FROM turma_alunos WHERE turma_id = $1 AND aluno_id = $2",
    )
    .bind(nova_turma_2_ano_id)
    .bind(f.aluno_aprovado_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status_novo_alice, "ativo");

    // 3b. Beto (retido) refaz o 1º Ano numa turma de 2027, não na de 2026 nem no 2º Ano
    let (serie_beto, ano_beto) = sqlx::query_as::<_, (Option<String>, i32)>(
        r#"SELECT t.serie, t.ano_letivo FROM turma_alunos ta JOIN turmas t ON t.id = ta.turma_id
           WHERE ta.aluno_id = $1 AND ta.status = 'ativo'"#,
    )
    .bind(f.aluno_reprovado_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(serie_beto.as_deref(), Some("1º Ano"));
    assert_eq!(ano_beto, 2027);
    let status_antigo_beto = sqlx::query_scalar::<_, String>(
        "SELECT status FROM turma_alunos WHERE turma_id = $1 AND aluno_id = $2",
    )
    .bind(f.turma_id)
    .bind(f.aluno_reprovado_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status_antigo_beto, "concluido");

    // 4. Contrato 2027 gerado para Alice com status 'pendente_assinatura' e mesmo valor 12000.0
    let contrato_alice = sqlx::query_as::<_, (f64, String)>(
        "SELECT valor_total, status FROM contratos WHERE aluno_id = $1 AND ano_letivo = 2027",
    )
    .bind(f.aluno_aprovado_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(contrato_alice.0, 12000.0);
    assert_eq!(contrato_alice.1, "pendente_assinatura");

    // 5. Carlos (não rematriculado) não tem contrato de 2027 nem matrícula ativa
    let contrato_carlos_existe = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM contratos WHERE aluno_id = $1 AND ano_letivo = 2027)",
    )
    .bind(f.aluno_andamento_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(!contrato_carlos_existe);

    // ========================================================================
    // IDEMPOTÊNCIA: Executar de novo com os mesmos anos deve retornar 409
    // ========================================================================
    let app2 = create_router(state.clone());
    let req_repetida = Request::builder()
        .method("POST")
        .uri("/api/v1/secretaria/virada-ano/executar")
        .header("authorization", auth_header(&token))
        .header("x-tenant-id", f.tenant_id.to_string())
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();

    let res_repetida = app2.oneshot(req_repetida).await.unwrap();
    assert_eq!(res_repetida.status(), StatusCode::CONFLICT);

    let body_conflict = axum::body::to_bytes(res_repetida.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_conflict: serde_json::Value = serde_json::from_slice(&body_conflict).unwrap();
    assert!(json_conflict["error"]
        .as_str()
        .unwrap()
        .contains("já foi executada"));

    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn test_professor_403() {
    let (admin, db_name, pool) = match setup_pool().await {
        Some(triple) => triple,
        None => return,
    };

    let f = seed_cenario(&pool).await;
    let state = app_state(pool.clone());
    let token_prof = generate_jwt(
        f.prof_id,
        f.tenant_id,
        "professor",
        &state.config.jwt_private_pem,
    )
    .unwrap();

    // 1. GET Prévia como professor -> 403
    let app1 = create_router(state.clone());
    let req_get = Request::builder()
        .method("GET")
        .uri("/api/v1/secretaria/virada-ano/previa?ano_origem=2026&ano_destino=2027")
        .header("authorization", auth_header(&token_prof))
        .header("x-tenant-id", f.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();

    let res_get = app1.oneshot(req_get).await.unwrap();
    assert_eq!(res_get.status(), StatusCode::FORBIDDEN);

    // 2. POST Executar como professor -> 403
    let payload = serde_json::json!({
        "ano_origem": 2026,
        "ano_destino": 2027,
        "turmas": [],
        "alunos": []
    });

    let app2 = create_router(state.clone());
    let req_post = Request::builder()
        .method("POST")
        .uri("/api/v1/secretaria/virada-ano/executar")
        .header("authorization", auth_header(&token_prof))
        .header("x-tenant-id", f.tenant_id.to_string())
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();

    let res_post = app2.oneshot(req_post).await.unwrap();
    assert_eq!(res_post.status(), StatusCode::FORBIDDEN);

    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn test_isolamento_tenant() {
    let (admin, db_name, pool) = match setup_pool().await {
        Some(triple) => triple,
        None => return,
    };

    let _f = seed_cenario(&pool).await;

    // Criar Tenant B
    let tenant_b = Uuid::new_v4();
    let gestor_b = Uuid::new_v4();
    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola B', $2)")
        .bind(tenant_b)
        .bind(format!("escola-b-{}", &tenant_b.to_string()[..8]))
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Gestor B', 'gestor@b.test', 'hash', 'gestor')",
    )
    .bind(gestor_b)
    .bind(tenant_b)
    .execute(&pool)
    .await
    .unwrap();

    let state = app_state(pool.clone());
    let token_b =
        generate_jwt(gestor_b, tenant_b, "gestor", &state.config.jwt_private_pem).unwrap();

    // Gestor B busca prévia: não deve ver turmas do Tenant A!
    let app = create_router(state);
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/secretaria/virada-ano/previa?ano_origem=2026&ano_destino=2027")
        .header("authorization", auth_header(&token_b))
        .header("x-tenant-id", tenant_b.to_string())
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    let turmas = json["turmas"].as_array().unwrap();
    assert_eq!(turmas.len(), 0); // Vazio porque Tenant B não tem turmas em 2026

    drop_database(&admin, &db_name).await;
}
