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

    let db_name = format!("escolar_diario_por_aula_{}", Uuid::new_v4().simple());
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

async fn seed_turma_com_duas_disciplinas(
    pool: &PgPool,
) -> (Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid, Uuid) {
    let tenant_id = Uuid::new_v4();
    let prof_mat_id = Uuid::new_v4();
    let prof_port_id = Uuid::new_v4();
    let prof_sem_atrib_id = Uuid::new_v4();
    let gestor_id = Uuid::new_v4();
    let turma_id = Uuid::new_v4();
    let mat_id = Uuid::new_v4();
    let port_id = Uuid::new_v4();
    let aluno_id = Uuid::new_v4();
    let horario_mat_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola Diário', $2)")
        .bind(tenant_id)
        .bind(format!("escola-diario-{}", &tenant_id.to_string()[..8]))
        .execute(pool)
        .await
        .unwrap();

    for (id, name, email, role) in [
        (
            prof_mat_id,
            "Prof Matemática",
            "profmt@escola.test",
            "professor",
        ),
        (
            prof_port_id,
            "Prof Português",
            "profpt@escola.test",
            "professor",
        ),
        (
            prof_sem_atrib_id,
            "Prof Sem Atribuição",
            "profsem@escola.test",
            "professor",
        ),
        (gestor_id, "Gestor", "gestor@escola.test", "gestor"),
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
        "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, '7º Ano A', 2026, 'fundamental_2', 'matutino', 'ativo')",
    )
    .bind(turma_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    for (id, nome, codigo) in [
        (mat_id, "Matemática", "MAT-01"),
        (port_id, "Língua Portuguesa", "PORT-01"),
    ] {
        sqlx::query(
            "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES ($1, $2, $3, $4, 'ativo')",
        )
        .bind(id)
        .bind(tenant_id)
        .bind(nome)
        .bind(codigo)
        .execute(pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO turma_disciplinas (id, tenant_id, turma_id, disciplina_id) VALUES (gen_random_uuid(), $1, $2, $3)",
        )
        .bind(tenant_id)
        .bind(turma_id)
        .bind(id)
        .execute(pool)
        .await
        .unwrap();
    }

    // Atribuições: professor de Matemática e professor de Português.
    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(mat_id)
    .bind(prof_mat_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(port_id)
    .bind(prof_port_id)
    .execute(pool)
    .await
    .unwrap();

    // O professor de Matemática também leciona Português nesta turma,
    // para que "Meu dia" liste as duas aulas dele no mesmo dia.
    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(port_id)
    .bind(prof_mat_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel)
        VALUES ($1, $2, 'Aluno 1', '11111111111', '2011-01-01', 'Resp', 'resp@test.com', '11999999999')
        "#,
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, numero_chamada) VALUES (gen_random_uuid(), $1, $2, $3, 1)",
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(aluno_id)
    .execute(pool)
    .await
    .unwrap();

    // Horário de Matemática na segunda-feira para testar chamada_registrada.
    sqlx::query(
        "INSERT INTO horarios_turma (id, tenant_id, turma_id, disciplina_id, professor_id, dia_semana, hora_inicio, hora_fim) VALUES ($1, $2, $3, $4, $5, 1, '07:30', '08:20')",
    )
    .bind(horario_mat_id)
    .bind(tenant_id)
    .bind(turma_id)
    .bind(mat_id)
    .bind(prof_mat_id)
    .execute(pool)
    .await
    .unwrap();

    (
        tenant_id,
        prof_mat_id,
        prof_port_id,
        prof_sem_atrib_id,
        gestor_id,
        turma_id,
        mat_id,
        port_id,
        aluno_id,
        horario_mat_id,
    )
}

#[tokio::test]
async fn diario_por_disciplina_nao_sobrescreve_outra_disciplina() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de diário por aula ignorado.");
        return;
    };

    let (
        tenant,
        prof_mat,
        prof_port,
        _prof_sem,
        _gestor,
        turma,
        mat_id,
        port_id,
        aluno_id,
        _horario,
    ) = seed_turma_com_duas_disciplinas(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);

    let token_mat = generate_jwt(
        prof_mat,
        tenant,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof mat");
    let token_port = generate_jwt(
        prof_port,
        tenant,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof port");

    let data = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();

    // 1. Professor de Matemática lança chamada da própria disciplina.
    let body_mat = serde_json::json!({
        "turma_id": turma,
        "data_aula": data,
        "disciplina_id": mat_id,
        "conteudo_ministrado": "Funções",
        "presencas": [{ "aluno_id": aluno_id, "presente": true }]
    });
    let req_mat = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/diario/sync")
        .header("Authorization", auth_header(&token_mat))
        .header("X-Tenant-ID", tenant.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_mat.to_string()))
        .unwrap();
    let res_mat = app.clone().oneshot(req_mat).await.unwrap();
    assert_eq!(res_mat.status(), StatusCode::OK);

    // 2. Professor de Português lança chamada da própria disciplina no mesmo dia.
    let body_port = serde_json::json!({
        "turma_id": turma,
        "data_aula": data,
        "disciplina_id": port_id,
        "conteudo_ministrado": "Interpretação textual",
        "presencas": [{ "aluno_id": aluno_id, "presente": false }]
    });
    let req_port = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/diario/sync")
        .header("Authorization", auth_header(&token_port))
        .header("X-Tenant-ID", tenant.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_port.to_string()))
        .unwrap();
    let res_port = app.clone().oneshot(req_port).await.unwrap();
    assert_eq!(res_port.status(), StatusCode::OK);

    // 3. Consulta do diário de Matemática deve retornar conteúdo de Matemática e presença.
    let req_get_mat = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/academico/diario?turma_id={turma}&data_aula={data}&disciplina_id={mat_id}"
        ))
        .header("Authorization", auth_header(&token_mat))
        .header("X-Tenant-ID", tenant.to_string())
        .body(Body::empty())
        .unwrap();
    let res_get_mat = app.clone().oneshot(req_get_mat).await.unwrap();
    assert_eq!(res_get_mat.status(), StatusCode::OK);
    let mat_json: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(res_get_mat.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(mat_json["conteudo_ministrado"], "Funções");
    assert_eq!(mat_json["presencas"][0]["presente"], true);

    // 4. Consulta do diário de Português deve retornar conteúdo de Português e falta.
    let req_get_port = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/academico/diario?turma_id={turma}&data_aula={data}&disciplina_id={port_id}"
        ))
        .header("Authorization", auth_header(&token_port))
        .header("X-Tenant-ID", tenant.to_string())
        .body(Body::empty())
        .unwrap();
    let res_get_port = app.clone().oneshot(req_get_port).await.unwrap();
    assert_eq!(res_get_port.status(), StatusCode::OK);
    let port_json: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(res_get_port.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(port_json["conteudo_ministrado"], "Interpretação textual");
    assert_eq!(port_json["presencas"][0]["presente"], false);

    // 5. Listagem recente com filtro de disciplina.
    let req_recentes = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/academico/diario/recentes?turma_id={turma}&disciplina_id={mat_id}&limit=10"
        ))
        .header("Authorization", auth_header(&token_mat))
        .header("X-Tenant-ID", tenant.to_string())
        .body(Body::empty())
        .unwrap();
    let res_recentes = app.clone().oneshot(req_recentes).await.unwrap();
    assert_eq!(res_recentes.status(), StatusCode::OK);
    let recentes: Vec<serde_json::Value> = serde_json::from_slice(
        &axum::body::to_bytes(res_recentes.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(recentes.len(), 1);
    assert_eq!(recentes[0]["disciplina_nome"], "Matemática");

    // 6. Sem filtro de disciplina, os dois diários coexistem (nenhum sobrescreve o outro).
    let req_todos = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/academico/diario/recentes?turma_id={turma}&limit=10"
        ))
        .header("Authorization", auth_header(&token_mat))
        .header("X-Tenant-ID", tenant.to_string())
        .body(Body::empty())
        .unwrap();
    let res_todos = app.clone().oneshot(req_todos).await.unwrap();
    assert_eq!(res_todos.status(), StatusCode::OK);
    let todos: Vec<serde_json::Value> = serde_json::from_slice(
        &axum::body::to_bytes(res_todos.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(todos.len(), 2);

    pool.close().await;
    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn professor_sem_atribuicao_nao_grava_diario_por_disciplina() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de diário por aula ignorado.");
        return;
    };

    let (
        tenant,
        _prof_mat,
        _prof_port,
        prof_sem,
        _gestor,
        turma,
        mat_id,
        _port_id,
        aluno_id,
        _horario,
    ) = seed_turma_com_duas_disciplinas(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);

    let token_sem = generate_jwt(
        prof_sem,
        tenant,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof sem atribuição");

    let data = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
    let body = serde_json::json!({
        "turma_id": turma,
        "data_aula": data,
        "disciplina_id": mat_id,
        "conteudo_ministrado": "Funções",
        "presencas": [{ "aluno_id": aluno_id, "presente": true }]
    });
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/diario/sync")
        .header("Authorization", auth_header(&token_sem))
        .header("X-Tenant-ID", tenant.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();
    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);

    pool.close().await;
    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn aulas_do_dia_marca_chamada_por_disciplina() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de diário por aula ignorado.");
        return;
    };

    let (
        tenant,
        prof_mat,
        _prof_port,
        _prof_sem,
        _gestor,
        turma,
        mat_id,
        port_id,
        aluno_id,
        _horario,
    ) = seed_turma_com_duas_disciplinas(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);

    // O professor leciona as duas disciplinas da turma: "Meu dia" lista as duas aulas dele.
    let token_mat = generate_jwt(
        prof_mat,
        tenant,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof mat");

    let data = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();

    // Aula de Português na mesma turma e dia, para provar que a chamada de
    // Matemática não marca a aula de outra disciplina.
    sqlx::query(
        "INSERT INTO horarios_turma (id, tenant_id, turma_id, disciplina_id, professor_id, dia_semana, hora_inicio, hora_fim) VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, '08:30', '09:20')",
    )
    .bind(tenant)
    .bind(turma)
    .bind(port_id)
    .bind(prof_mat)
    .execute(&pool)
    .await
    .unwrap();

    // Antes da chamada, as aulas aparecem como pendentes.
    let req_antes = Request::builder()
        .method("GET")
        .uri(&format!("/api/v1/professor/aulas?data={data}"))
        .header("Authorization", auth_header(&token_mat))
        .header("X-Tenant-ID", tenant.to_string())
        .body(Body::empty())
        .unwrap();
    let res_antes = app.clone().oneshot(req_antes).await.unwrap();
    assert_eq!(res_antes.status(), StatusCode::OK);
    let aulas_antes: Vec<serde_json::Value> = serde_json::from_slice(
        &axum::body::to_bytes(res_antes.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(aulas_antes.len(), 2);
    for aula in &aulas_antes {
        assert_eq!(aula["chamada_registrada"], false);
    }

    // Lança chamada de Matemática.
    let body_mat = serde_json::json!({
        "turma_id": turma,
        "data_aula": data,
        "disciplina_id": mat_id,
        "conteudo_ministrado": "Funções",
        "presencas": [{ "aluno_id": aluno_id, "presente": true }]
    });
    let req_sync = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/diario/sync")
        .header("Authorization", auth_header(&token_mat))
        .header("X-Tenant-ID", tenant.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body_mat.to_string()))
        .unwrap();
    let res_sync = app.clone().oneshot(req_sync).await.unwrap();
    assert_eq!(res_sync.status(), StatusCode::OK);

    // Após a chamada, só a aula de Matemática aparece como feita;
    // a de Português continua pendente.
    let req_depois = Request::builder()
        .method("GET")
        .uri(&format!("/api/v1/professor/aulas?data={data}"))
        .header("Authorization", auth_header(&token_mat))
        .header("X-Tenant-ID", tenant.to_string())
        .body(Body::empty())
        .unwrap();
    let res_depois = app.clone().oneshot(req_depois).await.unwrap();
    assert_eq!(res_depois.status(), StatusCode::OK);
    let aulas_depois: Vec<serde_json::Value> = serde_json::from_slice(
        &axum::body::to_bytes(res_depois.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(aulas_depois.len(), 2);
    let aula_mat = aulas_depois
        .iter()
        .find(|a| a["disciplina_nome"] == "Matemática")
        .expect("aula de Matemática presente");
    let aula_port = aulas_depois
        .iter()
        .find(|a| a["disciplina_nome"] == "Língua Portuguesa")
        .expect("aula de Português presente");
    assert_eq!(aula_mat["chamada_registrada"], true);
    assert_eq!(aula_port["chamada_registrada"], false);

    pool.close().await;
    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn sync_diario_sem_disciplina_continua_funcionando() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de diário por aula ignorado.");
        return;
    };

    let (
        tenant,
        prof_mat,
        _prof_port,
        _prof_sem,
        _gestor,
        turma,
        _mat_id,
        _port_id,
        aluno_id,
        _horario,
    ) = seed_turma_com_duas_disciplinas(&pool).await;

    let state = app_state(pool.clone());
    let app = create_router(state);

    let token_mat = generate_jwt(
        prof_mat,
        tenant,
        "professor",
        &development_signing_material().0,
    )
    .expect("token prof mat");

    let data = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
    let body = serde_json::json!({
        "turma_id": turma,
        "data_aula": data,
        "conteudo_ministrado": "Dia sem disciplina",
        "presencas": [{ "aluno_id": aluno_id, "presente": true }]
    });
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/academico/diario/sync")
        .header("Authorization", auth_header(&token_mat))
        .header("X-Tenant-ID", tenant.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // Consulta sem disciplina deve retornar o diário do dia inteiro.
    let req_get = Request::builder()
        .method("GET")
        .uri(&format!(
            "/api/v1/academico/diario?turma_id={turma}&data_aula={data}"
        ))
        .header("Authorization", auth_header(&token_mat))
        .header("X-Tenant-ID", tenant.to_string())
        .body(Body::empty())
        .unwrap();
    let res_get = app.oneshot(req_get).await.unwrap();
    assert_eq!(res_get.status(), StatusCode::OK);
    let json: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(res_get.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(json["encontrado"], true);
    assert_eq!(json["conteudo_ministrado"], "Dia sem disciplina");
    assert!(json["disciplina_id"].is_null());

    pool.close().await;
    drop_database(&admin, &db_name).await;
}
