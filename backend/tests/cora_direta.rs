use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    response::Json,
    routing::post,
    Router,
};
use escolar_backend::{
    config::{development_signing_material, AppState, Config, CoraMode, EmailMode},
    handlers::auth::generate_jwt,
    realtime::MessageHub,
    routes::create_router,
};
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::{Arc, Mutex};
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

#[derive(Clone, Default)]
struct SimState {
    create_count: Arc<Mutex<u32>>,
    pay_count: Arc<Mutex<u32>>,
}

impl SimState {
    fn inc_create(&self) {
        *self.create_count.lock().unwrap() += 1;
    }
    fn inc_pay(&self) {
        *self.pay_count.lock().unwrap() += 1;
    }
    fn creates(&self) -> u32 {
        *self.create_count.lock().unwrap()
    }
    fn pays(&self) -> u32 {
        *self.pay_count.lock().unwrap()
    }
}

async fn sim_token() -> Json<Value> {
    Json(json!({
        "access_token": "sim_token_123",
        "token_type": "Bearer",
        "expires_in": 86400
    }))
}

async fn sim_create_invoice(State(state): State<SimState>, body: String) -> Json<Value> {
    state.inc_create();
    let _ = body;
    Json(json!({
        "id": "cora_inv_sim_001",
        "status": "OPEN",
        "payment_options": {
            "bank_slip": {
                "url": "https://boletos.cora.test/001",
                "digitable": "00190000090320204700900018262179991970000001000"
            }
        },
        "pix": {
            "emv": "00020101021226830014br.gov.bcb.pix2561qrcode-h.cora.com.br/v1/cobv/sim001"
        }
    }))
}

async fn sim_pay(State(state): State<SimState>) -> Json<Value> {
    state.inc_pay();
    Json(json!({"status":"IN_PAYMENT"}))
}

async fn start_simulator() -> (String, SimState) {
    let state = SimState::default();
    let app = Router::new()
        .route("/token", post(sim_token))
        .route("/v2/invoices", post(sim_create_invoice))
        .route("/v2/invoices/pay", post(sim_pay))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    (format!("http://127.0.0.1:{port}"), state)
}

#[tokio::test]
async fn test_cora_direta_emissao_simulacao_webhook_isolamento() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de cora_direta ignorado.");
        return;
    };

    let (sim_url, sim_state) = start_simulator().await;

    let db_name = format!("escolar_cora_direta_{}", Uuid::new_v4().simple());
    let admin = PgPoolOptions::new()
        .max_connections(2)
        .connect(&admin_url)
        .await
        .expect("conexão administrativa");

    sqlx::query(&format!("CREATE DATABASE {db_name}"))
        .execute(&admin)
        .await
        .expect("criação do database descartável");

    let test_pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(&database_url_for(&admin_url, &db_name))
        .await
        .expect("conexão do database de teste");

    let result = run_checks(&test_pool, &sim_url, &sim_state).await;
    test_pool.close().await;
    drop_database(&admin, &db_name).await;

    result.expect("teste de integração Cora direta");
}

async fn run_checks(pool: &PgPool, sim_url: &str, sim_state: &SimState) -> Result<(), String> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| format!("migrations: {e}"))?;

    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();
    let gestor_a = Uuid::new_v4();
    let financeiro_a = Uuid::new_v4();
    let professor_a = Uuid::new_v4();
    let responsavel_a = Uuid::new_v4();
    let aluno_a = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO tenants (id, name, slug, status) VALUES ($1, 'Escola A', $2, 'active'), ($3, 'Escola B', $4, 'active')",
    )
    .bind(tenant_a)
    .bind(format!("escola-a-{}", Uuid::new_v4().simple()))
    .bind(tenant_b)
    .bind(format!("escola-b-{}", Uuid::new_v4().simple()))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    for (id, role) in [
        (gestor_a, "gestor"),
        (financeiro_a, "financeiro"),
        (professor_a, "professor"),
        (responsavel_a, "responsavel"),
    ] {
        sqlx::query(
            "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'hash', $5)",
        )
        .bind(id)
        .bind(tenant_a)
        .bind(format!("User {role}"))
        .bind(format!("{role}@escola-a.test"))
        .bind(role)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    sqlx::query(
        "INSERT INTO tenant_bank_integrations (tenant_id, gateway_name, client_id, client_secret, webhook_secret, is_active) VALUES ($1, 'cora', 'cora_client', 'cora_secret', 'wh_secret_a', true)"
    )
    .bind(tenant_a)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel, nome_responsavel_financeiro, cpf_responsavel_financeiro, email_responsavel_financeiro) VALUES ($1, $2, 'Aluno A', '11122233344', '2015-05-05', 'Resp A', 'resp@a.test', '11999999999', 'Resp Fin A', '11122233344', 'fin@a.test')"
    )
    .bind(aluno_a)
    .bind(tenant_a)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let fatura_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO faturas (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, metodo_pagamento) VALUES ($1, $2, $3, 'Mensalidade Cora', 150.0, CURRENT_DATE + INTERVAL '5 days', 'pendente', 'boleto')"
    )
    .bind(fatura_id)
    .bind(tenant_a)
    .bind(aluno_a)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let (private_pem, public_pem, public_x) = development_signing_material();
    let mut config = Config {
        port: 8000,
        database_url: "postgres://localhost/test".to_string(),
        jwt_private_pem: private_pem.clone(),
        jwt_public_pem: public_pem.clone(),
        jwt_public_x: public_x,
        allowed_origins: "http://localhost:3000".to_string(),
        environment: "development".to_string(),
        trusted_proxy: false,
        rate_limit_public_rpm: 60,
        account_lock_max_attempts: 5,
        account_lock_window_minutes: 15,
        cora_mode: CoraMode::Sandbox,
        cora_client_id: Some("sim_client".to_string()),
        cora_cert_file: None,
        cora_key_file: None,
        cora_base_url: Some(sim_url.to_string()),
        email_mode: EmailMode::Simulado,
        app_public_url: "http://localhost:3000".to_string(),
    };

    let app_state = AppState {
        pool: pool.clone(),
        config: config.clone(),
        message_hub: MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::new(),
    };

    let router = create_router(app_state);

    let token_gestor = generate_jwt(gestor_a, tenant_a, "gestor", &private_pem)
        .map_err(|e| format!("gerar jwt gestor: {e}"))?;

    // 1. Emissão grava gateway_invoice_id
    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_id}/cora"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Authorization", format!("Bearer {token_gestor}"))
        .header("Content-Type", "application/json")
        .body(Body::from("{}"))
        .map_err(|e| e.to_string())?;

    let response = router
        .clone()
        .oneshot(req)
        .await
        .map_err(|e| e.to_string())?;
    let status_emissao = response.status();
    if status_emissao != StatusCode::OK {
        let bytes = axum::body::to_bytes(response.into_body(), 1024 * 64)
            .await
            .unwrap_or_default();
        return Err(format!(
            "Status esperado 200 na emissão, recebeu {}: {}",
            status_emissao,
            String::from_utf8_lossy(&bytes)
        ));
    }

    let body_bytes = axum::body::to_bytes(response.into_body(), 1024 * 64)
        .await
        .map_err(|e| e.to_string())?;
    let fatura_json: Value = serde_json::from_slice(&body_bytes).map_err(|e| e.to_string())?;
    assert_eq!(
        fatura_json["gateway_name"].as_str(),
        Some("cora"),
        "gateway_name deve ser 'cora'"
    );
    assert_eq!(
        fatura_json["gateway_invoice_id"].as_str(),
        Some("cora_inv_sim_001"),
        "gateway_invoice_id deve vir do simulador"
    );

    // 2. Segunda chamada não duplica (mesma Idempotency-Key)
    let req2 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_id}/cora"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Authorization", format!("Bearer {token_gestor}"))
        .header("Content-Type", "application/json")
        .body(Body::from("{}"))
        .map_err(|e| e.to_string())?;

    let response2 = router
        .clone()
        .oneshot(req2)
        .await
        .map_err(|e| e.to_string())?;
    if response2.status() != StatusCode::OK {
        return Err(format!(
            "Status esperado 200 na segunda emissão, recebeu {}",
            response2.status()
        ));
    }
    assert_eq!(
        sim_state.creates(),
        1,
        "Simulador deve ter recebido apenas 1 chamada de emissão"
    );

    // 3. Professor e família não podem emitir (403)
    for (uid, role) in [(professor_a, "professor"), (responsavel_a, "responsavel")] {
        let token = generate_jwt(uid, tenant_a, role, &private_pem).map_err(|e| e.to_string())?;
        let req = Request::builder()
            .method("POST")
            .uri(format!("/api/v1/financeiro/faturas/{fatura_id}/cora"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header("Authorization", format!("Bearer {token}"))
            .header("Content-Type", "application/json")
            .body(Body::from("{}"))
            .map_err(|e| e.to_string())?;
        let resp = router
            .clone()
            .oneshot(req)
            .await
            .map_err(|e| e.to_string())?;
        if resp.status() != StatusCode::FORBIDDEN {
            return Err(format!(
                "Esperado 403 para {role}, recebeu {}",
                resp.status()
            ));
        }
    }

    // 4. Isolamento entre escolas: gestor do tenant B não vê fatura A (404)
    let gestor_b = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Gestor B', 'gestor@b.test', 'hash', 'gestor')"
    )
    .bind(gestor_b)
    .bind(tenant_b)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    let token_b =
        generate_jwt(gestor_b, tenant_b, "gestor", &private_pem).map_err(|e| e.to_string())?;
    let req_b = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_id}/cora"))
        .header("X-Tenant-ID", tenant_b.to_string())
        .header("Authorization", format!("Bearer {token_b}"))
        .header("Content-Type", "application/json")
        .body(Body::from("{}"))
        .map_err(|e| e.to_string())?;
    let resp_b = router
        .clone()
        .oneshot(req_b)
        .await
        .map_err(|e| e.to_string())?;
    if resp_b.status() != StatusCode::NOT_FOUND {
        return Err(format!(
            "Esperado 404 por isolamento, recebeu {}",
            resp_b.status()
        ));
    }

    // 5. Simular pagamento (sandbox)
    let req_sim = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/v1/financeiro/faturas/{fatura_id}/cora/simular-pagamento"
        ))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Authorization", format!("Bearer {token_gestor}"))
        .header("Content-Type", "application/json")
        .body(Body::from("{}"))
        .map_err(|e| e.to_string())?;
    let resp_sim = router
        .clone()
        .oneshot(req_sim)
        .await
        .map_err(|e| e.to_string())?;
    if resp_sim.status() != StatusCode::OK {
        return Err(format!(
            "Esperado 200 na simulação, recebeu {}",
            resp_sim.status()
        ));
    }
    assert_eq!(sim_state.pays(), 1);

    // 6. Webhook da Cora baixa a fatura (usando token na query)
    let webhook_url = format!("/api/v1/webhooks/cora/{tenant_a}?token=wh_secret_a");
    let req_wh = Request::builder()
        .method("POST")
        .uri(webhook_url)
        .header("webhook-event-id", "evt_sim_paid_001")
        .header("webhook-event-type", "invoice.paid")
        .header("webhook-resource-id", "cora_inv_sim_001")
        .header("Content-Type", "application/json")
        .body(Body::empty())
        .map_err(|e| e.to_string())?;
    let resp_wh = router
        .clone()
        .oneshot(req_wh)
        .await
        .map_err(|e| e.to_string())?;
    if resp_wh.status() != StatusCode::OK {
        return Err(format!(
            "Esperado 200 no webhook, recebeu {}",
            resp_wh.status()
        ));
    }

    let status_fatura: (String,) = sqlx::query_as("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;
    assert_eq!(status_fatura.0, "pago", "Webhook deve ter baixado a fatura");

    // 7. Mock não chama o simulador
    config.cora_mode = CoraMode::Mock;
    let mock_state = AppState {
        pool: pool.clone(),
        config,
        message_hub: MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::new(),
    };
    let mock_router = create_router(mock_state);

    let fatura_mock = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO faturas (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, metodo_pagamento) VALUES ($1, $2, $3, 'Mensalidade Mock', 200.0, CURRENT_DATE + INTERVAL '5 days', 'pendente', 'boleto')"
    )
    .bind(fatura_mock)
    .bind(tenant_a)
    .bind(aluno_a)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let creates_before = sim_state.creates();
    let req_mock = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_mock}/cora"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Authorization", format!("Bearer {token_gestor}"))
        .header("Content-Type", "application/json")
        .body(Body::from("{}"))
        .map_err(|e| e.to_string())?;
    let resp_mock = mock_router
        .oneshot(req_mock)
        .await
        .map_err(|e| e.to_string())?;
    if resp_mock.status() != StatusCode::BAD_REQUEST {
        return Err(format!(
            "Esperado 400 em modo mock, recebeu {}",
            resp_mock.status()
        ));
    }
    assert_eq!(
        sim_state.creates(),
        creates_before,
        "Modo mock não deve chamar o simulador"
    );

    Ok(())
}
