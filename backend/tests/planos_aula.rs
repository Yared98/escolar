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

    let db_name = format!("escolar_planos_{}", Uuid::new_v4().simple());
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

#[allow(dead_code)]
struct TestContextA {
    tenant_id: Uuid,
    prof1_id: Uuid,
    prof2_id: Uuid,
    gestor_id: Uuid,
    turma1_id: Uuid,
    turma2_id: Uuid,
    disciplina1_id: Uuid,
    disciplina2_id: Uuid,
}

async fn seed_tenant_a(pool: &PgPool) -> TestContextA {
    let tenant_id = Uuid::new_v4();
    let prof1_id = Uuid::new_v4();
    let prof2_id = Uuid::new_v4();
    let gestor_id = Uuid::new_v4();
    let turma1_id = Uuid::new_v4();
    let turma2_id = Uuid::new_v4();
    let disciplina1_id = Uuid::new_v4();
    let disciplina2_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola A', $2)")
        .bind(tenant_id)
        .bind(format!("escola-a-{}", &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    for (id, name, email, role) in [
        (prof1_id, "Prof 1", "prof1@a.test", "professor"),
        (prof2_id, "Prof 2", "prof2@a.test", "professor"),
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

    // Turmas
    sqlx::query(
        "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, '6º Ano A', 2026, 'fundamental_2', 'matutino', 'ativo')",
    )
    .bind(turma1_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, '7º Ano B', 2026, 'fundamental_2', 'vespertino', 'ativo')",
    )
    .bind(turma2_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    // Disciplinas
    sqlx::query(
        "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES ($1, $2, 'Matemática', 'MAT-01', 'ativo')",
    )
    .bind(disciplina1_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES ($1, $2, 'História', 'HIS-01', 'ativo')",
    )
    .bind(disciplina2_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    // Atribuições: prof1 em turma1+disciplina1; prof2 em turma2+disciplina2
    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(turma1_id)
    .bind(disciplina1_id)
    .bind(prof1_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(turma2_id)
    .bind(disciplina2_id)
    .bind(prof2_id)
    .execute(pool)
    .await
    .unwrap();

    TestContextA {
        tenant_id,
        prof1_id,
        prof2_id,
        gestor_id,
        turma1_id,
        turma2_id,
        disciplina1_id,
        disciplina2_id,
    }
}

async fn seed_tenant_b(pool: &PgPool) -> (Uuid, Uuid, Uuid, Uuid) {
    let tenant_id = Uuid::new_v4();
    let gestor_id = Uuid::new_v4();
    let turma_id = Uuid::new_v4();
    let disciplina_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola B', $2)")
        .bind(tenant_id)
        .bind(format!("escola-b-{}", &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Gestor B', 'gestor@b.test', 'hash', 'gestor')",
    )
    .bind(gestor_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, 'Turma B', 2026, 'fundamental_1', 'matutino', 'ativo')",
    )
    .bind(turma_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES ($1, $2, 'Ciências B', 'CIE-B', 'ativo')",
    )
    .bind(disciplina_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    (tenant_id, gestor_id, turma_id, disciplina_id)
}

#[tokio::test]
async fn test_fluxo_planos_aula() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        return;
    };

    let ctx = seed_tenant_a(&pool).await;
    let (tenant_b, gestor_b_id, _turma_b_id, _disc_b_id) = seed_tenant_b(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state.clone());

    let token_prof1 = generate_jwt(
        ctx.prof1_id,
        ctx.tenant_id,
        "professor".into(),
        &state.config.jwt_private_pem,
    )
    .unwrap();

    let token_prof2 = generate_jwt(
        ctx.prof2_id,
        ctx.tenant_id,
        "professor".into(),
        &state.config.jwt_private_pem,
    )
    .unwrap();

    let token_gestor_a = generate_jwt(
        ctx.gestor_id,
        ctx.tenant_id,
        "gestor".into(),
        &state.config.jwt_private_pem,
    )
    .unwrap();

    let token_gestor_b = generate_jwt(
        gestor_b_id,
        tenant_b,
        "gestor".into(),
        &state.config.jwt_private_pem,
    )
    .unwrap();

    // 1. Professor 1 salva o próprio plano para turma1 + disciplina1
    // Passa uma quarta-feira (2026-10-14); deve normalizar para a segunda-feira (2026-10-12)
    let body_plano = serde_json::json!({
        "turma_id": ctx.turma1_id,
        "disciplina_id": ctx.disciplina1_id,
        "semana_inicio": "2026-10-14",
        "objetivos": "Compreender operações fundamentais com frações.",
        "conteudos": "Soma e subtração com denominadores diferentes.",
        "habilidades_bncc": ["EF06MA07", "EF06MA08"],
        "atividades": "Resolução de exercícios e desafios em duplas.",
        "avaliacao": "Avaliação formativa durante as atividades."
    });

    let req_salvar = Request::builder()
        .method("PUT")
        .uri("/api/v1/planos-aula")
        .header("Authorization", auth_header(&token_prof1))
        .header("X-Tenant-ID", ctx.tenant_id.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_plano.to_string()))
        .unwrap();

    let res_salvar = app.clone().oneshot(req_salvar).await.unwrap();
    assert_eq!(res_salvar.status(), StatusCode::OK);

    let plano_salvo: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(res_salvar.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();

    assert_eq!(plano_salvo["semana_inicio"], "2026-10-12");
    assert_eq!(
        plano_salvo["objetivos"],
        "Compreender operações fundamentais com frações."
    );
    assert_eq!(plano_salvo["habilidades_bncc"][0], "EF06MA07");
    assert_eq!(plano_salvo["disciplina_nome"], "Matemática");
    let plano_id = plano_salvo["id"].as_str().unwrap().to_string();

    // 2. Consulta de planos com normalização de data
    // Passando sexta-feira (2026-10-16), normaliza para a mesma segunda (2026-10-12)
    let req_consultar = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/planos-aula?turma_id={}&disciplina_id={}&semana=2026-10-16",
            ctx.turma1_id, ctx.disciplina1_id
        ))
        .header("Authorization", auth_header(&token_prof1))
        .header("X-Tenant-ID", ctx.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();

    let res_consultar = app.clone().oneshot(req_consultar).await.unwrap();
    assert_eq!(res_consultar.status(), StatusCode::OK);

    let planos: Vec<serde_json::Value> = serde_json::from_slice(
        &axum::body::to_bytes(res_consultar.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(planos.len(), 1);
    assert_eq!(planos[0]["id"], plano_id);

    // 3. 403: Professor 2 tenta salvar plano em turma/disciplina alheia (turma1 + disciplina1)
    let body_alheio = serde_json::json!({
        "turma_id": ctx.turma1_id,
        "disciplina_id": ctx.disciplina1_id,
        "semana_inicio": "2026-10-12",
        "objetivos": "Tentativa indevida de sobrescrever",
        "conteudos": "Invasão de atribuição",
        "habilidades_bncc": [],
        "atividades": "Nada",
        "avaliacao": null
    });

    let req_alheio = Request::builder()
        .method("PUT")
        .uri("/api/v1/planos-aula")
        .header("Authorization", auth_header(&token_prof2))
        .header("X-Tenant-ID", ctx.tenant_id.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_alheio.to_string()))
        .unwrap();

    let res_alheio = app.clone().oneshot(req_alheio).await.unwrap();
    assert_eq!(res_alheio.status(), StatusCode::FORBIDDEN);

    // 4. Coordenação comenta o plano
    let body_comentario = serde_json::json!({
        "comentario": "Excelente planejamento. Sugiro integrar material concreto na atividade em duplas."
    });

    let req_comentar = Request::builder()
        .method("PUT")
        .uri(&format!("/api/v1/planos-aula/{plano_id}/comentario"))
        .header("Authorization", auth_header(&token_gestor_a))
        .header("X-Tenant-ID", ctx.tenant_id.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_comentario.to_string()))
        .unwrap();

    let res_comentar = app.clone().oneshot(req_comentar).await.unwrap();
    assert_eq!(res_comentar.status(), StatusCode::OK);

    let plano_comentado: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(res_comentar.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        plano_comentado["comentario_coordenacao"],
        "Excelente planejamento. Sugiro integrar material concreto na atividade em duplas."
    );

    // 5. Professor tenta comentar o plano (não permitido, só coordenação/gestão)
    let req_prof_comentar = Request::builder()
        .method("PUT")
        .uri(&format!("/api/v1/planos-aula/{plano_id}/comentario"))
        .header("Authorization", auth_header(&token_prof1))
        .header("X-Tenant-ID", ctx.tenant_id.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_comentario.to_string()))
        .unwrap();

    let res_prof_comentar = app.clone().oneshot(req_prof_comentar).await.unwrap();
    assert_eq!(res_prof_comentar.status(), StatusCode::FORBIDDEN);

    // 6. Isolamento multi-tenant
    // Gestor de B tenta ler planos da turma do Tenant A
    let req_isolamento_get = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/planos-aula?turma_id={}&semana=2026-10-12",
            ctx.turma1_id
        ))
        .header("Authorization", auth_header(&token_gestor_b))
        .header("X-Tenant-ID", tenant_b.to_string())
        .body(Body::empty())
        .unwrap();

    let res_isolamento_get = app.clone().oneshot(req_isolamento_get).await.unwrap();
    assert_eq!(res_isolamento_get.status(), StatusCode::OK);
    let planos_b: Vec<serde_json::Value> = serde_json::from_slice(
        &axum::body::to_bytes(res_isolamento_get.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(planos_b.len(), 0);

    // Gestor de B tenta comentar no plano de Tenant A (deve retornar 404 por isolamento)
    let req_isolamento_put = Request::builder()
        .method("PUT")
        .uri(&format!("/api/v1/planos-aula/{plano_id}/comentario"))
        .header("Authorization", auth_header(&token_gestor_b))
        .header("X-Tenant-ID", tenant_b.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_comentario.to_string()))
        .unwrap();

    let res_isolamento_put = app.clone().oneshot(req_isolamento_put).await.unwrap();
    assert_eq!(res_isolamento_put.status(), StatusCode::NOT_FOUND);

    pool.close().await;
    drop_database(&admin, &db_name).await;
}
