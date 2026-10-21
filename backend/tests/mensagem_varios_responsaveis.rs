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

    let db_name = format!("escolar_c19_{}", Uuid::new_v4().simple());
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

            itau_renovacao_automatica: false,
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

#[tokio::test]
async fn test_mensagem_aluno_dois_responsaveis_duas_mensagens_e_threads() {
    let (admin, db_name, pool) = match setup_pool().await {
        Some(ctx) => ctx,
        None => return,
    };

    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();
    let prof_turma = Uuid::new_v4();
    let prof_outro = Uuid::new_v4();
    let prof_tenant_b = Uuid::new_v4();
    let resp_mae = Uuid::new_v4();
    let resp_pai = Uuid::new_v4();
    let resp_tenant_b = Uuid::new_v4();
    let turma_a = Uuid::new_v4();
    let turma_b = Uuid::new_v4();
    let disciplina_a = Uuid::new_v4();
    let aluno_dois_resp = Uuid::new_v4();
    let aluno_um_resp = Uuid::new_v4();
    let aluno_sem_resp = Uuid::new_v4();

    // Tenants
    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola A', $2)")
        .bind(tenant_a)
        .bind(format!("escola-a-{}", &tenant_a.to_string()[..8]))
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola B', $2)")
        .bind(tenant_b)
        .bind(format!("escola-b-{}", &tenant_b.to_string()[..8]))
        .execute(&pool)
        .await
        .unwrap();

    // Usuários Escola A
    for (id, name, email, role) in [
        (
            prof_turma,
            "Professora Rita",
            "rita@escola-a.com",
            "professor",
        ),
        (
            prof_outro,
            "Professor Marcos",
            "marcos@escola-a.com",
            "professor",
        ),
        (
            resp_mae,
            "Marina Silva",
            "marina@familia.com",
            "responsavel",
        ),
        (resp_pai, "Paulo Santos", "paulo@familia.com", "responsavel"),
    ] {
        sqlx::query(
            "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'hash', $5)",
        )
        .bind(id)
        .bind(tenant_a)
        .bind(name)
        .bind(email)
        .bind(role)
        .execute(&pool)
        .await
        .unwrap();
    }

    // Usuários Escola B (isolamento)
    for (id, name, email, role) in [
        (prof_tenant_b, "Prof B", "prof@escola-b.com", "professor"),
        (resp_tenant_b, "Resp B", "resp@escola-b.com", "responsavel"),
    ] {
        sqlx::query(
            "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'hash', $5)",
        )
        .bind(id)
        .bind(tenant_b)
        .bind(name)
        .bind(email)
        .bind(role)
        .execute(&pool)
        .await
        .unwrap();
    }

    // Turmas e Disciplinas Escola A
    sqlx::query(
        "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, '3º Ano B', 2026, 'fundamental_1', 'matutino', 'ativo')",
    )
    .bind(turma_a)
    .bind(tenant_a)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO disciplinas (id, tenant_id, nome, codigo, status) VALUES ($1, $2, 'Matemática', 'MAT-03', 'ativo')",
    )
    .bind(disciplina_a)
    .bind(tenant_a)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id) VALUES (gen_random_uuid(), $1, $2, $3, $4)",
    )
    .bind(tenant_a)
    .bind(turma_a)
    .bind(disciplina_a)
    .bind(prof_turma)
    .execute(&pool)
    .await
    .unwrap();

    // Turma Escola B
    sqlx::query(
        "INSERT INTO turmas (id, tenant_id, nome, ano_letivo, etapa_ensino, turno, status) VALUES ($1, $2, '1º Ano A', 2026, 'fundamental_1', 'matutino', 'ativo')",
    )
    .bind(turma_b)
    .bind(tenant_b)
    .execute(&pool)
    .await
    .unwrap();

    // 1. Aluno com DOIS responsáveis: Mãe como principal (responsavel_user_id) e Pai em responsaveis_alunos
    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, responsavel_user_id, status) VALUES ($1, $2, 'Enzo Silva Santos', '12345678901', '2017-05-10', 'Marina Silva', 'marina@familia.com', '11988887777', $3, 'ativo')",
    )
    .bind(aluno_dois_resp)
    .bind(tenant_a)
    .bind(resp_mae)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO responsaveis_alunos (id, tenant_id, responsavel_user_id, aluno_id, parentesco) VALUES (gen_random_uuid(), $1, $2, $3, 'Pai')",
    )
    .bind(tenant_a)
    .bind(resp_pai)
    .bind(aluno_dois_resp)
    .execute(&pool)
    .await
    .unwrap();

    // 2. Aluno com UM responsável
    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, responsavel_user_id, status) VALUES ($1, $2, 'Sofia Silva', '12345678902', '2017-06-11', 'Marina Silva', 'marina@familia.com', '11988887777', $3, 'ativo')",
    )
    .bind(aluno_um_resp)
    .bind(tenant_a)
    .bind(resp_mae)
    .execute(&pool)
    .await
    .unwrap();

    // 3. Aluno sem responsável com conta
    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, responsavel_user_id, status) VALUES ($1, $2, 'Sem Conta', '12345678903', '2017-07-12', 'Ficha Apenas', 'ficha@email.com', '11988886666', NULL, 'ativo')",
    )
    .bind(aluno_sem_resp)
    .bind(tenant_a)
    .execute(&pool)
    .await
    .unwrap();

    // Enturmação
    for a_id in [aluno_dois_resp, aluno_um_resp, aluno_sem_resp] {
        sqlx::query(
            "INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, status) VALUES (gen_random_uuid(), $1, $2, $3, 'ativo')",
        )
        .bind(tenant_a)
        .bind(turma_a)
        .bind(a_id)
        .execute(&pool)
        .await
        .unwrap();
    }

    let material = development_signing_material();
    let app = create_router(app_state(pool.clone(), &material));

    let token_prof = generate_jwt(prof_turma, tenant_a, "professor", &material.0).unwrap();
    let token_prof_outro = generate_jwt(prof_outro, tenant_a, "professor", &material.0).unwrap();
    let token_mae = generate_jwt(resp_mae, tenant_a, "responsavel", &material.0).unwrap();
    let token_pai = generate_jwt(resp_pai, tenant_a, "responsavel", &material.0).unwrap();

    // === CENÁRIO 1: Aluno com DOIS responsáveis -> duas mensagens criadas, threads distintos ===
    {
        let payload = json!({
            "aluno_id": aluno_dois_resp,
            "canal": "responsavel",
            "titulo": "Recado sobre Enzo Silva Santos",
            "conteudo": "Favor conferir o livro de leitura para amanhã."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", tenant_a.to_string())
            .header("Authorization", auth_header(&token_prof))
            .header("Content-Type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let json_resp: Value = serde_json::from_slice(&body).unwrap();

        // Primeira mensagem devolvida compatível
        assert_eq!(
            json_resp["destinatario_id"].as_str().unwrap(),
            resp_mae.to_string()
        );
        assert_eq!(json_resp["canal"].as_str().unwrap(), "responsavel");
        let thread_1 = json_resp["thread_id"].as_str().unwrap().to_string();

        // Campo destinatários com ambos os responsáveis
        let dests = json_resp["destinatarios"]
            .as_array()
            .expect("destinatarios deve ser array");
        assert_eq!(
            dests.len(),
            2,
            "Regra C19: ambos os responsáveis devem receber mensagem!"
        );
        assert_eq!(dests[0]["id"].as_str().unwrap(), resp_mae.to_string());
        assert_eq!(dests[0]["nome"].as_str().unwrap(), "Marina Silva");
        assert_eq!(dests[0]["thread_id"].as_str().unwrap(), thread_1);

        assert_eq!(dests[1]["id"].as_str().unwrap(), resp_pai.to_string());
        assert_eq!(dests[1]["nome"].as_str().unwrap(), "Paulo Santos");
        let thread_2 = dests[1]["thread_id"].as_str().unwrap().to_string();

        // Threads DEVEM ser distintos (conversas separadas para o pai e para a mãe)
        assert_ne!(
            thread_1, thread_2,
            "Cada responsável deve ter sua própria thread/conversa separada"
        );

        // Verifica no banco de dados que exatamente 2 mensagens foram gravadas
        let count_msgs: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM mensagens_agenda WHERE tenant_id = $1 AND remetente_id = $2 AND titulo = $3",
        )
        .bind(tenant_a)
        .bind(prof_turma)
        .bind("Recado sobre Enzo Silva Santos")
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            count_msgs, 2,
            "Devem existir exatamente 2 mensagens gravadas no banco"
        );

        // Verifica que ambos receberam notificações no sistema
        let notifs_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM notificacoes_sistema WHERE tenant_id = $1 AND destinatario_id IN ($2, $3)",
        )
        .bind(tenant_a)
        .bind(resp_mae)
        .bind(resp_pai)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(
            notifs_count, 2,
            "Ambos os responsáveis devem receber notificação no sino/push"
        );

        // === Visibilidade: Mãe vê APENAS a sua conversa ===
        let req_mae = Request::builder()
            .method(Method::GET)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", tenant_a.to_string())
            .header("Authorization", auth_header(&token_mae))
            .body(Body::empty())
            .unwrap();

        let resp_mae_list = app.clone().oneshot(req_mae).await.unwrap();
        assert_eq!(resp_mae_list.status(), StatusCode::OK);
        let body_mae = axum::body::to_bytes(resp_mae_list.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let msgs_mae: Vec<Value> = serde_json::from_slice(&body_mae).unwrap();
        assert_eq!(
            msgs_mae.len(),
            1,
            "Mãe deve enxergar apenas a sua própria conversa"
        );
        assert_eq!(
            msgs_mae[0]["destinatario_id"].as_str().unwrap(),
            resp_mae.to_string()
        );
        assert_eq!(msgs_mae[0]["thread_id"].as_str().unwrap(), thread_1);

        // === Visibilidade: Pai vê APENAS a sua conversa ===
        let req_pai = Request::builder()
            .method(Method::GET)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", tenant_a.to_string())
            .header("Authorization", auth_header(&token_pai))
            .body(Body::empty())
            .unwrap();

        let resp_pai_list = app.clone().oneshot(req_pai).await.unwrap();
        assert_eq!(resp_pai_list.status(), StatusCode::OK);
        let body_pai = axum::body::to_bytes(resp_pai_list.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let msgs_pai: Vec<Value> = serde_json::from_slice(&body_pai).unwrap();
        assert_eq!(
            msgs_pai.len(),
            1,
            "Pai deve enxergar apenas a sua própria conversa"
        );
        assert_eq!(
            msgs_pai[0]["destinatario_id"].as_str().unwrap(),
            resp_pai.to_string()
        );
        assert_eq!(msgs_pai[0]["thread_id"].as_str().unwrap(), thread_2);
    }

    // === CENÁRIO 2: Aluno com UM responsável -> apenas uma mensagem criada ===
    {
        let payload = json!({
            "aluno_id": aluno_um_resp,
            "canal": "responsavel",
            "titulo": "Recado sobre Sofia Silva",
            "conteudo": "Apresentação no sarau foi excelente."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", tenant_a.to_string())
            .header("Authorization", auth_header(&token_prof))
            .header("Content-Type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let json_resp: Value = serde_json::from_slice(&body).unwrap();
        let dests = json_resp["destinatarios"]
            .as_array()
            .expect("destinatarios array");
        assert_eq!(
            dests.len(),
            1,
            "Aluno com 1 responsável deve gerar 1 mensagem"
        );
        assert_eq!(dests[0]["id"].as_str().unwrap(), resp_mae.to_string());
    }

    // === CENÁRIO 3: Aluno sem responsável com conta -> 400 Bad Request ===
    {
        let payload = json!({
            "aluno_id": aluno_sem_resp,
            "canal": "responsavel",
            "titulo": "Recado para aluno sem conta",
            "conteudo": "Não deve enviar."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", tenant_a.to_string())
            .header("Authorization", auth_header(&token_prof))
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

    // === CENÁRIO 4: Professor de outra turma tenta enviar -> 403 Forbidden ===
    {
        let payload = json!({
            "aluno_id": aluno_dois_resp,
            "canal": "responsavel",
            "titulo": "Professor sem atribuição",
            "conteudo": "Tentativa não autorizada."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", tenant_a.to_string())
            .header("Authorization", auth_header(&token_prof_outro))
            .header("Content-Type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    // === CENÁRIO 5: Isolamento multi-tenant entre escolas ===
    {
        let token_b = generate_jwt(prof_tenant_b, tenant_b, "professor", &material.0).unwrap();

        // Professor da escola B tenta enviar recado para aluno da escola A
        let payload = json!({
            "aluno_id": aluno_dois_resp,
            "canal": "responsavel",
            "titulo": "Invasão cross-tenant",
            "conteudo": "Não deve funcionar."
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", tenant_b.to_string())
            .header("Authorization", auth_header(&token_b))
            .header("Content-Type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        // Não é permitido (403 ou 400 por não pertencer à turma daquele tenant)
        assert!(resp.status() == StatusCode::FORBIDDEN || resp.status() == StatusCode::BAD_REQUEST);

        // Usuário da escola B não enxerga nenhuma mensagem da escola A
        let token_resp_b =
            generate_jwt(resp_tenant_b, tenant_b, "responsavel", &material.0).unwrap();
        let req_resp_b = Request::builder()
            .method(Method::GET)
            .uri("/api/v1/agenda/mensagens")
            .header("X-Tenant-ID", tenant_b.to_string())
            .header("Authorization", auth_header(&token_resp_b))
            .body(Body::empty())
            .unwrap();

        let resp_b_list = app.clone().oneshot(req_resp_b).await.unwrap();
        assert_eq!(resp_b_list.status(), StatusCode::OK);
        let body_b = axum::body::to_bytes(resp_b_list.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let msgs_b: Vec<Value> = serde_json::from_slice(&body_b).unwrap();
        assert_eq!(
            msgs_b.len(),
            0,
            "Isolamento cross-tenant: Escola B não vê mensagens da Escola A"
        );
    }

    // === CENÁRIO 6: GET /secretaria/turmas/:turma_id/alunos com responsaveis_com_acesso ===
    {
        let req = Request::builder()
            .method(Method::GET)
            .uri(format!("/api/v1/secretaria/turmas/{turma_a}/alunos"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header("Authorization", auth_header(&token_prof))
            .body(Body::empty())
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let alunos: Vec<Value> = serde_json::from_slice(&body).unwrap();

        let enzo = alunos
            .iter()
            .find(|a| a["aluno_id"].as_str().unwrap() == aluno_dois_resp.to_string())
            .unwrap();
        let resp_enzo = enzo["responsaveis_com_acesso"]
            .as_array()
            .expect("responsaveis_com_acesso array");
        assert_eq!(
            resp_enzo.len(),
            2,
            "Enzo tem 2 responsáveis com acesso ao portal"
        );
        assert_eq!(resp_enzo[0]["nome"].as_str().unwrap(), "Marina Silva");
        assert_eq!(resp_enzo[1]["nome"].as_str().unwrap(), "Paulo Santos");

        let sofia = alunos
            .iter()
            .find(|a| a["aluno_id"].as_str().unwrap() == aluno_um_resp.to_string())
            .unwrap();
        let resp_sofia = sofia["responsaveis_com_acesso"]
            .as_array()
            .expect("responsaveis_com_acesso array");
        assert_eq!(
            resp_sofia.len(),
            1,
            "Sofia tem 1 responsável com acesso ao portal"
        );

        let sem_resp = alunos
            .iter()
            .find(|a| a["aluno_id"].as_str().unwrap() == aluno_sem_resp.to_string())
            .unwrap();
        let resp_sem = sem_resp["responsaveis_com_acesso"]
            .as_array()
            .expect("responsaveis_com_acesso array");
        assert_eq!(resp_sem.len(), 0, "Aluno sem conta tem array vazio");
    }

    drop_database(&admin, &db_name).await;
}
