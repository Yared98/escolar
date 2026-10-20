use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::NaiveDate;
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

    let db_name = format!("escolar_professor_{}", Uuid::new_v4().simple());
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
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    }
}

fn auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

async fn seed_tenant_a(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid) {
    let tenant_id = Uuid::new_v4();
    let prof_id = Uuid::new_v4();
    let prof_outro_id = Uuid::new_v4();
    let gestor_id = Uuid::new_v4();
    let turma_id = Uuid::new_v4();
    let disciplina_id = Uuid::new_v4();
    let aluno_id = Uuid::new_v4();
    let aluno2_id = Uuid::new_v4();

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

    // Professor A é atribuído à turma+disciplina; professor_outro não.
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

    for (id, nome, cpf) in [
        (aluno_id, "Aluno 1", "11111111111"),
        (aluno2_id, "Aluno 2", "22222222222"),
    ] {
        sqlx::query(
            r#"
            INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel)
            VALUES ($1, $2, $3, $4, '2012-01-01', 'Resp', 'resp@test.com', '11999999999')
            "#,
        )
        .bind(id)
        .bind(tenant_id)
        .bind(nome)
        .bind(cpf)
        .execute(pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, numero_chamada) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
        )
        .bind(tenant_id)
        .bind(turma_id)
        .bind(id)
        .bind(if id == aluno_id { 1 } else { 2 })
        .execute(pool)
        .await
        .unwrap();
    }

    (
        tenant_id,
        prof_id,
        prof_outro_id,
        gestor_id,
        turma_id,
        disciplina_id,
        aluno_id,
        aluno2_id,
    )
}

async fn seed_tenant_b(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let tenant_id = Uuid::new_v4();
    let prof_b_id = Uuid::new_v4();
    let turma_b_id = Uuid::new_v4();

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

    (tenant_id, prof_b_id, turma_b_id)
}

#[tokio::test]
async fn professor_lanca_notas_propria_turma_e_isolamento() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de professor ignorado.");
        return;
    };

    let (tenant_a, prof_a, prof_outro, _gestor_a, turma_a, disciplina_a, aluno_a1, _aluno_a2) =
        seed_tenant_a(&pool).await;
    let (tenant_b, prof_b, _turma_b) = seed_tenant_b(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);

    let token_prof_a = generate_jwt(
        prof_a,
        tenant_a,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof A");
    let token_prof_outro = generate_jwt(
        prof_outro,
        tenant_a,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof outro");
    let token_prof_b = generate_jwt(
        prof_b,
        tenant_b,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof B");

    // 1. Professor A lança nota na própria turma (200)
    let body = serde_json::json!({
        "turma_id": turma_a,
        "disciplina_id": disciplina_a,
        "periodo": "1_bimestre",
        "notas": [
            { "aluno_id": aluno_a1, "nota": 8.5 },
        ]
    });
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/notas/lote")
        .header("Authorization", auth_header(&token_prof_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 2. Professor de outra turma do mesmo tenant tenta lançar (403)
    let req2 = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/notas/lote")
        .header("Authorization", auth_header(&token_prof_outro))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();
    let res2 = app.clone().oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::FORBIDDEN);

    // 3. Professor do tenant B não consegue ler notas do tenant A (isolamento → 200 com lista vazia)
    let req3 = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/academico/notas?turma_id={turma_a}&disciplina_id={disciplina_a}&periodo=1_bimestre"
        ))
        .header("Authorization", auth_header(&token_prof_b))
        .header("X-Tenant-ID", tenant_b.to_string())
        .body(Body::empty())
        .unwrap();
    // O RLS esconde as atribuições do tenant A, então o professor B não tem vínculo com a turma: 403.
    let res3 = app.clone().oneshot(req3).await.unwrap();
    assert_eq!(res3.status(), StatusCode::FORBIDDEN);

    // 4. Professor A consegue ler as notas que lançou
    let req4 = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/academico/notas?turma_id={turma_a}&disciplina_id={disciplina_a}&periodo=1_bimestre"
        ))
        .header("Authorization", auth_header(&token_prof_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let res4 = app.clone().oneshot(req4).await.unwrap();
    assert_eq!(res4.status(), StatusCode::OK);
    let bytes4 = axum::body::to_bytes(res4.into_body(), usize::MAX)
        .await
        .unwrap();
    let lista4: Vec<serde_json::Value> = serde_json::from_slice(&bytes4).unwrap();
    let encontrado = lista4
        .iter()
        .find(|v| v["aluno_id"] == aluno_a1.to_string());
    assert!(encontrado.is_some());
    assert_eq!(encontrado.unwrap()["nota"], 8.5);

    // 5. minhas-turmas do professor A retorna a turma atribuída
    let req5 = Request::builder()
        .method("GET")
        .uri("/api/v1/professor/minhas-turmas")
        .header("Authorization", auth_header(&token_prof_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let res5 = app.clone().oneshot(req5).await.unwrap();
    assert_eq!(res5.status(), StatusCode::OK);

    // 6. aulas do dia: sem aula cadastrada, retorna vazio
    let hoje = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap(); // segunda
    let req6 = Request::builder()
        .method("GET")
        .uri(&format!("/api/v1/professor/aulas?data={hoje}"))
        .header("Authorization", auth_header(&token_prof_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let res6 = app.oneshot(req6).await.unwrap();
    assert_eq!(res6.status(), StatusCode::OK);

    pool.close().await;
    drop_database(&admin, &db_name).await;
}
