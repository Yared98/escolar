use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::NaiveDate;
use escolar_backend::config::{development_signing_material, AppState, Config};
use escolar_backend::handlers::auth::generate_jwt;
use escolar_backend::routes::create_router;
use serde_json::Value;
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

    let db_name = format!("escolar_frequencia_{}", Uuid::new_v4().simple());
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
struct SeedTenantData {
    tenant_id: Uuid,
    gestor_id: Uuid,
    prof_a_id: Uuid,
    prof_b_id: Uuid,
    turma_1_id: Uuid,
    turma_2_id: Uuid,
    disciplina_id: Uuid,
    aluno_1_id: Uuid,
    aluno_2_id: Uuid,
}

async fn seed_test_tenant(pool: &PgPool, prefix: &str) -> SeedTenantData {
    let tenant_id = Uuid::new_v4();
    let gestor_id = Uuid::new_v4();
    let prof_a_id = Uuid::new_v4();
    let prof_b_id = Uuid::new_v4();
    let turma_1_id = Uuid::new_v4();
    let turma_2_id = Uuid::new_v4();
    let disciplina_id = Uuid::new_v4();
    let aluno_1_id = Uuid::new_v4();
    let aluno_2_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)")
        .bind(tenant_id)
        .bind(format!("Escola {prefix}"))
        .bind(format!("escola-{}-{}", prefix, &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    for (id, name, email, role) in [
        (
            gestor_id,
            format!("Gestor {prefix}"),
            format!("gestor@{}test.com", prefix),
            "gestor",
        ),
        (
            prof_a_id,
            format!("Prof A {prefix}"),
            format!("profa@{}test.com", prefix),
            "professor",
        ),
        (
            prof_b_id,
            format!("Prof B {prefix}"),
            format!("profb@{}test.com", prefix),
            "professor",
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

    for (tid, nome) in [(turma_1_id, "6º Ano A"), (turma_2_id, "7º Ano B")] {
        sqlx::query(
            "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, $3, 2026, 'fundamental_2', 'matutino', 'ativo')",
        )
        .bind(tid)
        .bind(tenant_id)
        .bind(nome)
        .execute(pool)
        .await
        .unwrap();
    }

    sqlx::query(
        "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES ($1, $2, 'Matemática', 'MAT-01', 'ativo')",
    )
    .bind(disciplina_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    // Prof A atribuído na Turma 1
    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id, ano_letivo) VALUES (gen_random_uuid(), $1, $2, $3, $4, 2026)",
    )
    .bind(tenant_id)
    .bind(turma_1_id)
    .bind(disciplina_id)
    .bind(prof_a_id)
    .execute(pool)
    .await
    .unwrap();

    // Prof B atribuído na Turma 2
    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id, ano_letivo) VALUES (gen_random_uuid(), $1, $2, $3, $4, 2026)",
    )
    .bind(tenant_id)
    .bind(turma_2_id)
    .bind(disciplina_id)
    .bind(prof_b_id)
    .execute(pool)
    .await
    .unwrap();

    // Alunos matriculados na Turma 1
    for (id, nome, cpf, num) in [
        (
            aluno_1_id,
            "Lucas Silva",
            format!("1111111111{}", &prefix[..1]),
            1,
        ),
        (
            aluno_2_id,
            "Mariana Costa",
            format!("2222222222{}", &prefix[..1]),
            2,
        ),
    ] {
        sqlx::query(
            r#"
            INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, status)
            VALUES ($1, $2, $3, $4, '2012-05-10', 'Responsavel', 'resp@test.com', '11999999999', 'ativo')
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
            "INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, numero_chamada, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ativo')",
        )
        .bind(tenant_id)
        .bind(turma_1_id)
        .bind(id)
        .bind(num)
        .execute(pool)
        .await
        .unwrap();
    }

    SeedTenantData {
        tenant_id,
        gestor_id,
        prof_a_id,
        prof_b_id,
        turma_1_id,
        turma_2_id,
        disciplina_id,
        aluno_1_id,
        aluno_2_id,
    }
}

async fn criar_diario_com_presencas(
    pool: &PgPool,
    tenant_id: Uuid,
    turma_id: Uuid,
    prof_id: Uuid,
    disc_id: Option<Uuid>,
    data_aula: NaiveDate,
    presencas: &[(Uuid, bool, Option<&str>)],
) -> Uuid {
    let diario_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO diarios_classe (id, tenant_id, turma_id, professor_id, disciplina_id, data_aula, conteudo_ministrado, observacao)
        VALUES ($1, $2, $3, $4, $5, $6, 'Conteúdo ministrado da aula', '')
        "#,
    )
    .bind(diario_id)
    .bind(tenant_id)
    .bind(turma_id)
    .bind(prof_id)
    .bind(disc_id)
    .bind(data_aula)
    .execute(pool)
    .await
    .unwrap();

    for (aluno_id, presente, just) in presencas {
        sqlx::query(
            r#"
            INSERT INTO presencas (id, tenant_id, diario_id, aluno_id, presente, justificativa)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
            "#,
        )
        .bind(tenant_id)
        .bind(diario_id)
        .bind(aluno_id)
        .bind(presente)
        .bind(just)
        .execute(pool)
        .await
        .unwrap();
    }

    diario_id
}

#[tokio::test]
async fn test_relatorio_frequencia_calculo_correto() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        return;
    };
    let state = app_state(pool.clone());
    let router = create_router(state);
    let s = seed_test_tenant(&pool, "a").await;

    // Semeia 4 diários em outubro/2026 para Turma 1
    // Aula 1: 2026-10-05 (ambos presentes)
    criar_diario_com_presencas(
        &pool,
        s.tenant_id,
        s.turma_1_id,
        s.prof_a_id,
        Some(s.disciplina_id),
        NaiveDate::from_ymd_opt(2026, 10, 5).unwrap(),
        &[(s.aluno_1_id, true, None), (s.aluno_2_id, true, None)],
    )
    .await;

    // Aula 2: 2026-10-12 (ambos presentes)
    criar_diario_com_presencas(
        &pool,
        s.tenant_id,
        s.turma_1_id,
        s.prof_a_id,
        Some(s.disciplina_id),
        NaiveDate::from_ymd_opt(2026, 10, 12).unwrap(),
        &[(s.aluno_1_id, true, None), (s.aluno_2_id, true, None)],
    )
    .await;

    // Aula 3: 2026-10-19 (Aluno 1 presente, Aluno 2 falta sem justificativa)
    criar_diario_com_presencas(
        &pool,
        s.tenant_id,
        s.turma_1_id,
        s.prof_a_id,
        Some(s.disciplina_id),
        NaiveDate::from_ymd_opt(2026, 10, 19).unwrap(),
        &[(s.aluno_1_id, true, None), (s.aluno_2_id, false, None)],
    )
    .await;

    // Aula 4: 2026-10-26 (Aluno 1 falta justificada "Atestado médico", Aluno 2 falta sem justificativa)
    criar_diario_com_presencas(
        &pool,
        s.tenant_id,
        s.turma_1_id,
        s.prof_a_id,
        Some(s.disciplina_id),
        NaiveDate::from_ymd_opt(2026, 10, 26).unwrap(),
        &[
            (s.aluno_1_id, false, Some("Atestado médico")),
            (s.aluno_2_id, false, None),
        ],
    )
    .await;

    // Consulta como Gestor
    let token_gestor = generate_jwt(
        s.gestor_id,
        s.tenant_id,
        "gestor",
        &development_signing_material().0,
    )
    .unwrap();

    let uri = format!(
        "/api/v1/academico/frequencia?turma_id={}&mes=2026-10",
        s.turma_1_id
    );

    let req = Request::builder()
        .uri(&uri)
        .header("authorization", auth_header(&token_gestor))
        .header("x-tenant-id", s.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();

    let res = router.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    // Valida totais da turma
    let total_turma = &json["total_turma"];
    assert_eq!(total_turma["total_aulas"], 4);
    assert_eq!(total_turma["total_presencas"], 5); // 3 (aluno1) + 2 (aluno2)
    assert_eq!(total_turma["total_faltas"], 3); // 1 (aluno1) + 2 (aluno2)
    assert_eq!(total_turma["total_faltas_justificadas"], 1); // 1 (aluno1)
                                                             // percentual geral = 5 / 8 = 62.5%
    assert_eq!(total_turma["percentual_geral"], 62.5);

    // Valida aluno 1: 4 aulas, 3 presenças, 1 falta, 1 justificada -> 75.0%
    let alunos = json["alunos"].as_array().unwrap();
    assert_eq!(alunos.len(), 2);

    let a1 = alunos
        .iter()
        .find(|a| a["aluno_id"] == s.aluno_1_id.to_string())
        .unwrap();
    assert_eq!(a1["aulas"], 4);
    assert_eq!(a1["presencas"], 3);
    assert_eq!(a1["faltas"], 1);
    assert_eq!(a1["faltas_justificadas"], 1);
    assert_eq!(a1["percentual"], 75.0);

    // Valida aluno 2: 4 aulas, 2 presenças, 2 faltas, 0 justificadas -> 50.0%
    let a2 = alunos
        .iter()
        .find(|a| a["aluno_id"] == s.aluno_2_id.to_string())
        .unwrap();
    assert_eq!(a2["aulas"], 4);
    assert_eq!(a2["presencas"], 2);
    assert_eq!(a2["faltas"], 2);
    assert_eq!(a2["faltas_justificadas"], 0);
    assert_eq!(a2["percentual"], 50.0);

    // Consulta com filtro de disciplina
    let uri_disc = format!(
        "/api/v1/academico/frequencia?turma_id={}&mes=2026-10&disciplina_id={}",
        s.turma_1_id, s.disciplina_id
    );
    let req_disc = Request::builder()
        .uri(&uri_disc)
        .header("authorization", auth_header(&token_gestor))
        .header("x-tenant-id", s.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();

    let res_disc = router.clone().oneshot(req_disc).await.unwrap();
    assert_eq!(res_disc.status(), StatusCode::OK);

    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn test_professor_outra_turma_403() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        return;
    };
    let state = app_state(pool.clone());
    let router = create_router(state);
    let s = seed_test_tenant(&pool, "b").await;

    let token_prof_a = generate_jwt(
        s.prof_a_id,
        s.tenant_id,
        "professor",
        &development_signing_material().0,
    )
    .unwrap();

    let token_prof_b = generate_jwt(
        s.prof_b_id,
        s.tenant_id,
        "professor",
        &development_signing_material().0,
    )
    .unwrap();

    let uri_turma_1 = format!(
        "/api/v1/academico/frequencia?turma_id={}&mes=2026-10",
        s.turma_1_id
    );

    // Prof A leciona na Turma 1 -> 200 OK
    let req_ok = Request::builder()
        .uri(&uri_turma_1)
        .header("authorization", auth_header(&token_prof_a))
        .header("x-tenant-id", s.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();
    let res_ok = router.clone().oneshot(req_ok).await.unwrap();
    assert_eq!(res_ok.status(), StatusCode::OK);

    // Prof B NÃO leciona na Turma 1 -> 403 Forbidden
    let req_forbidden = Request::builder()
        .uri(&uri_turma_1)
        .header("authorization", auth_header(&token_prof_b))
        .header("x-tenant-id", s.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();
    let res_forbidden = router.clone().oneshot(req_forbidden).await.unwrap();
    assert_eq!(res_forbidden.status(), StatusCode::FORBIDDEN);

    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn test_isolamento_multi_tenant_frequencia() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        return;
    };
    let state = app_state(pool.clone());
    let router = create_router(state);

    let escola_1 = seed_test_tenant(&pool, "e1").await;
    let escola_2 = seed_test_tenant(&pool, "e2").await;

    let token_escola_1 = generate_jwt(
        escola_1.gestor_id,
        escola_1.tenant_id,
        "gestor",
        &development_signing_material().0,
    )
    .unwrap();

    // Tentar acessar turma da Escola 2 usando credenciais e tenant da Escola 1 -> 404 (turma não existe no tenant 1)
    let uri_cross = format!(
        "/api/v1/academico/frequencia?turma_id={}&mes=2026-10",
        escola_2.turma_1_id
    );
    let req_cross = Request::builder()
        .uri(&uri_cross)
        .header("authorization", auth_header(&token_escola_1))
        .header("x-tenant-id", escola_1.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();
    let res_cross = router.clone().oneshot(req_cross).await.unwrap();
    assert_eq!(res_cross.status(), StatusCode::NOT_FOUND);

    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn test_alertas_frequencia_abaixo_75() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        return;
    };
    let state = app_state(pool.clone());
    let router = create_router(state);
    let s = seed_test_tenant(&pool, "c").await;

    // Cria diários no ano 2026:
    // Aluno 1 tem 75.0% (3 presenças / 4 aulas) -> NÃO está em alerta
    // Aluno 2 tem 50.0% (2 presenças / 4 aulas) -> ESTÁ em alerta (< 75%)
    criar_diario_com_presencas(
        &pool,
        s.tenant_id,
        s.turma_1_id,
        s.prof_a_id,
        Some(s.disciplina_id),
        NaiveDate::from_ymd_opt(2026, 3, 10).unwrap(),
        &[(s.aluno_1_id, true, None), (s.aluno_2_id, true, None)],
    )
    .await;
    criar_diario_com_presencas(
        &pool,
        s.tenant_id,
        s.turma_1_id,
        s.prof_a_id,
        Some(s.disciplina_id),
        NaiveDate::from_ymd_opt(2026, 4, 10).unwrap(),
        &[(s.aluno_1_id, true, None), (s.aluno_2_id, true, None)],
    )
    .await;
    criar_diario_com_presencas(
        &pool,
        s.tenant_id,
        s.turma_1_id,
        s.prof_a_id,
        Some(s.disciplina_id),
        NaiveDate::from_ymd_opt(2026, 5, 10).unwrap(),
        &[(s.aluno_1_id, true, None), (s.aluno_2_id, false, None)],
    )
    .await;
    criar_diario_com_presencas(
        &pool,
        s.tenant_id,
        s.turma_1_id,
        s.prof_a_id,
        Some(s.disciplina_id),
        NaiveDate::from_ymd_opt(2026, 6, 10).unwrap(),
        &[
            (s.aluno_1_id, false, Some("Consulta")),
            (s.aluno_2_id, false, None),
        ],
    )
    .await;

    // Gestor consulta alertas
    let token_gestor = generate_jwt(
        s.gestor_id,
        s.tenant_id,
        "gestor",
        &development_signing_material().0,
    )
    .unwrap();

    let req = Request::builder()
        .uri("/api/v1/academico/frequencia/alertas")
        .header("authorization", auth_header(&token_gestor))
        .header("x-tenant-id", s.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();

    let res = router.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["total_alertas"], 1);
    let turmas = json["turmas"].as_array().unwrap();
    assert_eq!(turmas.len(), 1);
    assert_eq!(turmas[0]["turma_id"], s.turma_1_id.to_string());
    assert_eq!(turmas[0]["total_alunos_alerta"], 1);

    let alunos_alerta = turmas[0]["alunos"].as_array().unwrap();
    assert_eq!(alunos_alerta[0]["aluno_id"], s.aluno_2_id.to_string());
    assert_eq!(alunos_alerta[0]["percentual"], 50.0);

    // Professor B (que leciona na Turma 2, onde não há chamadas nem alertas)
    let token_prof_b = generate_jwt(
        s.prof_b_id,
        s.tenant_id,
        "professor",
        &development_signing_material().0,
    )
    .unwrap();

    let req_prof_b = Request::builder()
        .uri("/api/v1/academico/frequencia/alertas")
        .header("authorization", auth_header(&token_prof_b))
        .header("x-tenant-id", s.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();

    let res_prof_b = router.clone().oneshot(req_prof_b).await.unwrap();
    assert_eq!(res_prof_b.status(), StatusCode::OK);

    let body_b = axum::body::to_bytes(res_prof_b.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_b: Value = serde_json::from_slice(&body_b).unwrap();
    // Prof B só vê suas turmas (Turma 2), que tem 0 alertas
    assert_eq!(json_b["total_alertas"], 0);
    assert_eq!(json_b["turmas"].as_array().unwrap().len(), 0);

    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn test_frequencia_hoje_gestao_e_bloqueio_professor() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        return;
    };
    let state = app_state(pool.clone());
    let router = create_router(state);
    let s = seed_test_tenant(&pool, "d").await;

    let data_teste = NaiveDate::from_ymd_opt(2026, 10, 13).unwrap();

    // Cria chamada hoje para Turma 1: 1 presente, 1 ausente
    criar_diario_com_presencas(
        &pool,
        s.tenant_id,
        s.turma_1_id,
        s.prof_a_id,
        Some(s.disciplina_id),
        data_teste,
        &[(s.aluno_1_id, true, None), (s.aluno_2_id, false, None)],
    )
    .await;

    let token_gestor = generate_jwt(
        s.gestor_id,
        s.tenant_id,
        "gestor",
        &development_signing_material().0,
    )
    .unwrap();

    let uri = format!("/api/v1/academico/frequencia/hoje?data={data_teste}");

    // Gestão acessa com sucesso
    let req_gestao = Request::builder()
        .uri(&uri)
        .header("authorization", auth_header(&token_gestor))
        .header("x-tenant-id", s.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();

    let res_gestao = router.clone().oneshot(req_gestao).await.unwrap();
    assert_eq!(res_gestao.status(), StatusCode::OK);

    let body = axum::body::to_bytes(res_gestao.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["total_turmas_com_chamada"], 1);
    assert_eq!(json["total_presentes"], 1);
    assert_eq!(json["total_alunos"], 2);
    assert_eq!(json["percentual_geral"], 50.0);

    // Professor tenta acessar -> 403 Forbidden
    let token_prof = generate_jwt(
        s.prof_a_id,
        s.tenant_id,
        "professor",
        &development_signing_material().0,
    )
    .unwrap();

    let req_prof = Request::builder()
        .uri(&uri)
        .header("authorization", auth_header(&token_prof))
        .header("x-tenant-id", s.tenant_id.to_string())
        .body(Body::empty())
        .unwrap();

    let res_prof = router.clone().oneshot(req_prof).await.unwrap();
    assert_eq!(res_prof.status(), StatusCode::FORBIDDEN);

    drop_database(&admin, &db_name).await;
}
