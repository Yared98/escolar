use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
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

    let db_name = format!("escolar_recado_{}", Uuid::new_v4().simple());
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

fn app_state(pool: PgPool, material: &(String, String, String)) -> AppState {
    AppState {
        pool,
        config: Config {
            database_url: String::new(),
            jwt_private_pem: material.0.clone(),
            jwt_public_pem: material.1.clone(),
            jwt_public_x: material.2.clone(),
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
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    }
}

fn auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

struct SeedIds {
    tenant_id: Uuid,
    prof_turma_id: Uuid,
    prof_outro_id: Uuid,
    resp_id: Uuid,
    aluno_com_resp_id: Uuid,
    aluno_sem_resp_id: Uuid,
    aluno_ra_id: Uuid,
}

async fn seed_dados(pool: &PgPool) -> SeedIds {
    let tenant_id = Uuid::new_v4();
    let prof_turma_id = Uuid::new_v4();
    let prof_outro_id = Uuid::new_v4();
    let resp_id = Uuid::new_v4();
    let turma_id = Uuid::new_v4();
    let disciplina_id = Uuid::new_v4();
    let aluno_com_resp_id = Uuid::new_v4();
    let aluno_sem_resp_id = Uuid::new_v4();
    let aluno_ra_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola C16', $2)")
        .bind(tenant_id)
        .bind(format!("escola-c16-{}", &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    for (id, name, email, role) in [
        (prof_turma_id, "Prof Turma", "prof1@test.com", "professor"),
        (prof_outro_id, "Prof Outro", "prof2@test.com", "professor"),
        (resp_id, "Responsável Teste", "resp@test.com", "responsavel"),
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
        "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES ($1, $2, 'Português', 'POR-01', 'ativo')",
    )
    .bind(disciplina_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    // Atribui somente prof_turma_id na turma
    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(disciplina_id)
    .bind(prof_turma_id)
    .execute(pool)
    .await
    .unwrap();

    // 1. Aluno com responsavel_user_id direto
    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, responsavel_user_id, status) VALUES ($1, $2, 'Aluno Com Resp', '11111111111', '2012-01-01', 'Resp Com User', 'resp@test.com', '11999999999', $3, 'ativo')",
    )
    .bind(aluno_com_resp_id)
    .bind(tenant_id)
    .bind(resp_id)
    .execute(pool)
    .await
    .unwrap();

    // 2. Aluno sem responsável vinculado ao portal (sem responsavel_user_id)
    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, responsavel_user_id, status) VALUES ($1, $2, 'Aluno Sem Resp', '22222222222', '2012-02-02', 'Nome Apenas Na Ficha', 'ficha@test.com', '11888888888', NULL, 'ativo')",
    )
    .bind(aluno_sem_resp_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    // 3. Aluno vinculado via responsaveis_alunos (responsavel_user_id nulo no aluno)
    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, responsavel_user_id, status) VALUES ($1, $2, 'Aluno Via RA', '33333333333', '2012-03-03', 'Mãe Cadastrada', 'mae@test.com', '11777777777', NULL, 'ativo')",
    )
    .bind(aluno_ra_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO responsaveis_alunos (id, tenant_id, responsavel_user_id, aluno_id, parentesco) VALUES (gen_random_uuid(), $1, $2, $3, 'Mãe')",
    )
    .bind(tenant_id)
    .bind(resp_id)
    .bind(aluno_ra_id)
    .execute(pool)
    .await
    .unwrap();

    // Enturma todos os 3 na turma
    for a_id in [aluno_com_resp_id, aluno_sem_resp_id, aluno_ra_id] {
        sqlx::query(
            "INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, status) VALUES (gen_random_uuid(), $1, $2, $3, 'ativo')",
        )
        .bind(tenant_id)
        .bind(turma_id)
        .bind(a_id)
        .execute(pool)
        .await
        .unwrap();
    }

    SeedIds {
        tenant_id,
        prof_turma_id,
        prof_outro_id,
        resp_id,
        aluno_com_resp_id,
        aluno_sem_resp_id,
        aluno_ra_id,
    }
}

#[tokio::test]
async fn test_recado_professor_para_familia_com_validacao_de_turma() {
    let (admin, db_name, pool) = match setup_pool().await {
        Some(ctx) => ctx,
        None => return,
    };

    let seeds = seed_dados(&pool).await;
    let material = development_signing_material();
    let app = create_router(app_state(pool.clone(), &material));

    let token_prof_turma = generate_jwt(
        seeds.prof_turma_id,
        seeds.tenant_id,
        "professor",
        &material.0,
    )
    .unwrap();

    let token_prof_outro = generate_jwt(
        seeds.prof_outro_id,
        seeds.tenant_id,
        "professor",
        &material.0,
    )
    .unwrap();

    // Caso 1: Professor da turma envia recado endereçando pelo aluno_id (aluno_com_resp)
    {
        let payload = json!({
            "aluno_id": seeds.aluno_com_resp_id,
            "canal": "responsavel",
            "titulo": "Recado sobre Aluno Com Resp",
            "conteudo": "Favor conferir a tarefa de casa."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", seeds.tenant_id.to_string())
            .header("Authorization", auth_header(&token_prof_turma))
            .header("Content-Type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        let status = resp.status();
        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let text = String::from_utf8_lossy(&body);
        assert_eq!(status, StatusCode::OK, "Body: {text}");
        let json_resp: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(
            json_resp["destinatario_id"].as_str().unwrap(),
            seeds.resp_id.to_string()
        );
        assert_eq!(json_resp["canal"].as_str().unwrap(), "responsavel");
        assert!(json_resp["thread_id"].as_str().is_some());
    }

    // Caso 2: Professor da turma envia recado para aluno vinculado via responsaveis_alunos
    {
        let payload = json!({
            "aluno_id": seeds.aluno_ra_id,
            "canal": "responsavel",
            "titulo": "Recado sobre Aluno Via RA",
            "conteudo": "Parabéns pela dedicação nas aulas."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", seeds.tenant_id.to_string())
            .header("Authorization", auth_header(&token_prof_turma))
            .header("Content-Type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let json_resp: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(
            json_resp["destinatario_id"].as_str().unwrap(),
            seeds.resp_id.to_string()
        );
    }

    // Caso 3: Professor que NÃO leciona para o aluno tenta enviar recado -> HTTP 403 Forbidden
    {
        let payload = json!({
            "aluno_id": seeds.aluno_com_resp_id,
            "canal": "responsavel",
            "titulo": "Tentativa indevida",
            "conteudo": "Professor sem turma tentando enviar."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", seeds.tenant_id.to_string())
            .header("Authorization", auth_header(&token_prof_outro))
            .header("Content-Type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    // Caso 4: Aluno sem responsável cadastrado -> HTTP 400 Bad Request
    {
        let payload = json!({
            "aluno_id": seeds.aluno_sem_resp_id,
            "canal": "responsavel",
            "titulo": "Recado para aluno sem resp",
            "conteudo": "Mensagem para aluno sem família no portal."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", seeds.tenant_id.to_string())
            .header("Authorization", auth_header(&token_prof_turma))
            .header("Content-Type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let json_resp: Value = serde_json::from_slice(&body).unwrap();
        assert!(json_resp["error"]
            .as_str()
            .unwrap()
            .contains("não possui responsável"));
    }

    // Caso 5: Professor que não leciona para a família tenta falar diretamente via destinatario_id
    {
        let payload = json!({
            "destinatario_id": seeds.resp_id,
            "canal": "responsavel",
            "titulo": "Tentativa direta",
            "conteudo": "Mensagem direta sem ter filho do responsável na turma."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", seeds.tenant_id.to_string())
            .header("Authorization", auth_header(&token_prof_outro))
            .header("Content-Type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    drop_database(&admin, &db_name).await;
}
