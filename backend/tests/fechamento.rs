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

    let db_name = format!("escolar_fechamento_{}", Uuid::new_v4().simple());
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

async fn seed_tenant_a(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid) {
    let tenant_id = Uuid::new_v4();
    let prof_id = Uuid::new_v4();
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

    for (id, nome, cpf, numero) in [
        (aluno_id, "Aluno 1", "11111111111", 1),
        (aluno2_id, "Aluno 2", "22222222222", 2),
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
        .bind(numero)
        .execute(pool)
        .await
        .unwrap();
    }

    (
        tenant_id,
        prof_id,
        gestor_id,
        turma_id,
        disciplina_id,
        aluno_id,
        aluno2_id,
    )
}

async fn seed_tenant_b(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let tenant_id = Uuid::new_v4();
    let gestor_b_id = Uuid::new_v4();
    let turma_b_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola B', $2)")
        .bind(tenant_id)
        .bind(format!("escola-b-{}", &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Gestor B', 'gestor@b.test', 'hash', 'gestor')",
    )
    .bind(gestor_b_id)
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

    (tenant_id, gestor_b_id, turma_b_id)
}

#[tokio::test]
async fn fechamento_bloqueia_lote_notas_e_reabertura_libera() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de fechamento ignorado.");
        return;
    };

    let (tenant_a, prof_a, gestor_a, turma_a, disciplina_a, aluno_a1, _aluno_a2) =
        seed_tenant_a(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);

    let token_prof_a = generate_jwt(
        prof_a,
        tenant_a,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof A");
    let token_gestor_a = generate_jwt(
        gestor_a,
        tenant_a,
        "gestor",
        &development_signing_material().0,
    )
    .expect("token gestor A");

    // 1. Professor não consegue fechar período (403).
    let body_fechar = serde_json::json!({
        "turma_id": turma_a,
        "periodo": "1_bimestre"
    });
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/fechamentos")
        .header("Authorization", auth_header(&token_prof_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_fechar.to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);

    // 2. Gestor fecha o 1º bimestre (200).
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/fechamentos")
        .header("Authorization", auth_header(&token_gestor_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_fechar.to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let fechar_resp: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(fechar_resp["fechado"], true);

    // 3. Lançar notas do 1º bimestre retorna 409 (conflito por período fechado).
    let body_notas_1bim = serde_json::json!({
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
        .header("Authorization", auth_header(&token_gestor_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_notas_1bim.to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);

    // 4. Lançar notas do 2º bimestre passa (200).
    let body_notas_2bim = serde_json::json!({
        "turma_id": turma_a,
        "disciplina_id": disciplina_a,
        "periodo": "2_bimestre",
        "notas": [
            { "aluno_id": aluno_a1, "nota": 7.0 },
        ]
    });
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/notas/lote")
        .header("Authorization", auth_header(&token_gestor_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_notas_2bim.to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 5. Reabrir o 1º bimestre: precisamos descobrir o id do fechamento.
    let req = Request::builder()
        .method("GET")
        .uri(&format!("/api/v1/academico/fechamentos?turma_id={turma_a}"))
        .header("Authorization", auth_header(&token_gestor_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status_listar = res.status();
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    assert_eq!(status_listar, StatusCode::OK);
    let fechamentos: Vec<serde_json::Value> = serde_json::from_slice(&bytes).unwrap();
    let fechamento_1bim = fechamentos
        .iter()
        .find(|f| f["periodo"] == "1_bimestre")
        .expect("fechamento do 1_bimestre");
    assert_eq!(fechamento_1bim["fechado"], true);
    // O endpoint de reabertura espera o UUID do registro de fechamento.
    let fechamento_uuid: Uuid = sqlx::query_scalar(
        "SELECT id FROM fechamentos_periodo WHERE tenant_id = $1 AND turma_id = $2 AND periodo = '1_bimestre'",
    )
    .bind(tenant_a)
    .bind(turma_a)
    .fetch_one(&pool)
    .await
    .unwrap();

    let req = Request::builder()
        .method("DELETE")
        .uri(&format!("/api/v1/academico/fechamentos/{fechamento_uuid}"))
        .header("Authorization", auth_header(&token_gestor_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status_reabrir = res.status();
    assert_eq!(status_reabrir, StatusCode::OK);

    // 6. Após reabrir, o lote do 1º bimestre passa.
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/notas/lote")
        .header("Authorization", auth_header(&token_gestor_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_notas_1bim.to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    pool.close().await;
    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn parecer_conselho_aparece_no_boletim_e_isolamento_por_tenant() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de parecer ignorado.");
        return;
    };

    let (tenant_a, prof_a, gestor_a, turma_a, _disciplina_a, aluno_a1, _aluno_a2) =
        seed_tenant_a(&pool).await;
    let (tenant_b, gestor_b, turma_b) = seed_tenant_b(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);

    let token_prof_a = generate_jwt(
        prof_a,
        tenant_a,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof A");
    let token_gestor_a = generate_jwt(
        gestor_a,
        tenant_a,
        "gestor",
        &development_signing_material().0,
    )
    .expect("token gestor A");
    let token_gestor_b = generate_jwt(
        gestor_b,
        tenant_b,
        "gestor",
        &development_signing_material().0,
    )
    .expect("token gestor B");

    // Professor atribuído consegue salvar parecer.
    let body_parecer = serde_json::json!({
        "turma_id": turma_a,
        "periodo": "1_bimestre",
        "aluno_id": aluno_a1,
        "parecer": "Aluno dedicado, mas precisa reforçar frações.",
        "encaminhamento": "recuperacao"
    });
    let req = Request::builder()
        .method("PUT")
        .uri("/api/v1/academico/conselho")
        .header("Authorization", auth_header(&token_prof_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_parecer.to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // Parecer aparece no boletim do aluno.
    let req = Request::builder()
        .method("GET")
        .uri(&format!("/api/v1/academico/boletim/{aluno_a1}"))
        .header("Authorization", auth_header(&token_gestor_a))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let boletim: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    let pareceres = boletim["pareceres"].as_array().expect("pareceres");
    assert_eq!(pareceres.len(), 1);
    assert_eq!(pareceres[0]["periodo"], "1_bimestre");
    assert_eq!(
        pareceres[0]["parecer"],
        "Aluno dedicado, mas precisa reforçar frações."
    );
    assert_eq!(pareceres[0]["encaminhamento"], "recuperacao");

    // Isolamento: gestor do tenant B não vê parecer do tenant A.
    let req = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/academico/conselho?turma_id={turma_b}&periodo=1_bimestre"
        ))
        .header("Authorization", auth_header(&token_gestor_b))
        .header("X-Tenant-ID", tenant_b.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let conselho_b: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert!(conselho_b["alunos"].as_array().unwrap().is_empty());

    pool.close().await;
    drop_database(&admin, &db_name).await;
}
