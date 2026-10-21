use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, Request, StatusCode},
    response::Json,
    routing::{get, post, put},
    Router,
};
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::{Arc, Mutex};
use tower::ServiceExt;
use uuid::Uuid;

use escolar_backend::{
    config::{
        development_signing_material, AppState, ChaveMestra, Config, CoraMode, EmailMode, ItauMode,
    },
    handlers::auth::generate_jwt,
    middleware::security::IpRateLimiter,
    realtime::MessageHub,
    routes::create_router,
    services::secrets::{self, TipoSegredo},
};

const TEST_SECRETS_HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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
struct SimulatorState {
    last_webhook_body: Arc<Mutex<Option<Value>>>,
    webhook_headers: Arc<Mutex<Vec<String>>>,
    webhook_chave: Arc<Mutex<Option<String>>>,
    pix_respostas: Arc<Mutex<std::collections::HashMap<String, (StatusCode, Value)>>>,
    consulta_count: Arc<Mutex<u32>>,
}

async fn sim_oauth_token() -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "access_token": "sim_sts_token_pix_valido_999",
            "token_type": "Bearer",
            "expires_in": 300
        })),
    )
}

async fn sim_cadastrar_webhook_pix(
    State(state): State<SimulatorState>,
    Path(chave): Path<String>,
    headers: header::HeaderMap,
    Json(payload): Json<Value>,
) -> (StatusCode, Json<Value>) {
    if let Some(apikey) = headers.get("x-itau-apikey").and_then(|h| h.to_str().ok()) {
        state
            .webhook_headers
            .lock()
            .unwrap()
            .push(apikey.to_string());
    }
    *state.webhook_chave.lock().unwrap() = Some(chave);
    *state.last_webhook_body.lock().unwrap() = Some(payload);
    (StatusCode::OK, Json(json!({ "status": "sucesso" })))
}

async fn sim_consultar_pix(
    State(state): State<SimulatorState>,
    Path(e2eid): Path<String>,
) -> (StatusCode, Json<Value>) {
    *state.consulta_count.lock().unwrap() += 1;
    let mapa = state.pix_respostas.lock().unwrap();
    if let Some((status, corpo)) = mapa.get(&e2eid) {
        (*status, Json(corpo.clone()))
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "pix não encontrado" })),
        )
    }
}

async fn start_simulator() -> (String, SimulatorState) {
    let state = SimulatorState::default();

    let app = Router::new()
        .route("/as/token.oauth2", post(sim_oauth_token))
        .route("/api/oauth/token", post(sim_oauth_token))
        .route("/webhook/:chave", put(sim_cadastrar_webhook_pix))
        .route(
            "/regulatorio-pix/v2/webhook/:chave",
            put(sim_cadastrar_webhook_pix),
        )
        .route("/pix/:e2eid", get(sim_consultar_pix))
        .route("/regulatorio-pix/v2/pix/:e2eid", get(sim_consultar_pix))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    (format!("http://127.0.0.1:{port}"), state)
}

#[tokio::test]
async fn test_webhook_itau_pix_suite_completa() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de webhook Pix Itaú ignorado.");
        return;
    };

    let (sim_url, sim_state) = start_simulator().await;
    std::env::set_var("ITAU_API_BASE_URL", &sim_url);
    std::env::set_var("ITAU_STS_BASE_URL", &sim_url);

    let db_name = format!("escolar_itau_pix_{}", Uuid::new_v4().simple());
    let admin = PgPoolOptions::new()
        .max_connections(2)
        .connect(&admin_url)
        .await
        .expect("conexão administrativa");

    sqlx::query(&format!("CREATE DATABASE {db_name}"))
        .execute(&admin)
        .await
        .expect("criação do database de teste");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url_for(&admin_url, &db_name))
        .await
        .expect("conexão com o database de teste");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("execução das migrations");

    let (jwt_private, jwt_public, jwt_x) = development_signing_material();
    let chave_mestra = ChaveMestra::from_hex(TEST_SECRETS_HEX).expect("chave de teste válida");

    let config = Config {
        itau_renovacao_automatica: false,
        database_url: database_url_for(&admin_url, &db_name),
        jwt_private_pem: jwt_private.clone(),
        jwt_public_pem: jwt_public,
        jwt_public_x: jwt_x,
        port: 8000,
        allowed_origins: "http://localhost:3000".to_string(),
        environment: "test".to_string(),
        trusted_proxy: false,
        rate_limit_public_rpm: 1000,
        account_lock_max_attempts: 10,
        account_lock_window_minutes: 15,
        cora_mode: CoraMode::Mock,
        cora_client_id: None,
        cora_cert_file: None,
        cora_key_file: None,
        cora_base_url: None,
        email_mode: EmailMode::Simulado,
        app_public_url: "http://localhost:3000".to_string(),
        app_secrets_key: Some(chave_mestra.clone()),
        itau_mode: ItauMode::Sandbox,
        itau_sts_base_url: Some(sim_url.clone()),
    };

    let state = AppState {
        pool: pool.clone(),
        config: config.clone(),
        message_hub: MessageHub::default(),
        ip_rate_limiter: IpRateLimiter::default(),
    };

    let app = create_router(state.clone());

    // Setup Tenant A e Tenant B
    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();
    let admin_user_a = Uuid::new_v4();
    let admin_user_b = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola Pix Alpha', $2), ($3, 'Escola Pix Beta', $4)",
    )
    .bind(tenant_a)
    .bind(format!("alpha-pix-{}", &tenant_a.to_string()[..8]))
    .bind(tenant_b)
    .bind(format!("beta-pix-{}", &tenant_b.to_string()[..8]))
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Admin A', $3, 'hash', 'admin'), ($4, $5, 'Admin B', $6, 'hash', 'admin')",
    )
    .bind(admin_user_a)
    .bind(tenant_a)
    .bind(format!("admin-{}@alpha-pix.com", &tenant_a.to_string()[..8]))
    .bind(admin_user_b)
    .bind(tenant_b)
    .bind(format!("admin-{}@beta-pix.com", &tenant_b.to_string()[..8]))
    .execute(&pool)
    .await
    .unwrap();

    let token_admin_a = generate_jwt(admin_user_a, tenant_a, "admin", &jwt_private).unwrap();
    let _token_admin_b = generate_jwt(admin_user_b, tenant_b, "admin", &jwt_private).unwrap();

    // 1. Configuração do Tenant A
    let mut conn_a = escolar_backend::db::acquire_tenant(&pool, tenant_a)
        .await
        .unwrap();
    sqlx::query(
        r#"
        INSERT INTO tenant_itau_config
            (tenant_id, agencia, conta, dac, id_beneficiario, chave_pix, ativo)
        VALUES ($1, '1500', '0005206', '1', '150000052061', '12345678000190', true)
        "#,
    )
    .bind(tenant_a)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    secrets::salvar(
        &mut conn_a,
        &chave_mestra,
        tenant_a,
        "itau",
        TipoSegredo::ClientId,
        b"client_id_pix_a",
        Some(admin_user_a),
    )
    .await
    .unwrap();

    secrets::salvar(
        &mut conn_a,
        &chave_mestra,
        tenant_a,
        "itau",
        TipoSegredo::ClientSecret,
        b"client_secret_pix_a",
        Some(admin_user_a),
    )
    .await
    .unwrap();

    // Configuração do Tenant B
    let mut conn_b = escolar_backend::db::acquire_tenant(&pool, tenant_b)
        .await
        .unwrap();
    sqlx::query(
        r#"
        INSERT INTO tenant_itau_config
            (tenant_id, agencia, conta, dac, id_beneficiario, chave_pix, ativo)
        VALUES ($1, '2000', '0007890', '2', '200000078902', '98765432000199', true)
        "#,
    )
    .bind(tenant_b)
    .execute(&mut *conn_b)
    .await
    .unwrap();

    secrets::salvar(
        &mut conn_b,
        &chave_mestra,
        tenant_b,
        "itau",
        TipoSegredo::ClientId,
        b"client_id_pix_b",
        Some(admin_user_b),
    )
    .await
    .unwrap();

    secrets::salvar(
        &mut conn_b,
        &chave_mestra,
        tenant_b,
        "itau",
        TipoSegredo::ClientSecret,
        b"client_secret_pix_b",
        Some(admin_user_b),
    )
    .await
    .unwrap();

    // Alunos e faturas
    let aluno_a_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel) VALUES ($1, $2, 'Aluno Pix A', '11122233344', '2015-05-10', 'Resp Test', 'resp@test.com', '11999999999')",
    )
    .bind(aluno_a_id)
    .bind(tenant_a)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    // Fatura A1: 150.00, gateway_txid = BL_TXID_001
    let fatura_a1_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, gateway_txid)
        VALUES ($1, $2, $3, 'Mensalidade Pix A1', 150.00, CURRENT_DATE + 5, 'pendente', 'itau', 'BL_TXID_001')
        "#,
    )
    .bind(fatura_a1_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    // Fatura A2: 200.00, gateway_txid = BL_TXID_002
    let fatura_a2_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, gateway_txid)
        VALUES ($1, $2, $3, 'Mensalidade Pix A2', 200.00, CURRENT_DATE + 5, 'pendente', 'itau', 'BL_TXID_002')
        "#,
    )
    .bind(fatura_a2_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    // Fatura A3 (valor divergente): 300.00, gateway_txid = BL_TXID_003
    let fatura_a3_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, gateway_txid)
        VALUES ($1, $2, $3, 'Mensalidade Pix A3', 300.00, CURRENT_DATE + 5, 'pendente', 'itau', 'BL_TXID_003')
        "#,
    )
    .bind(fatura_a3_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    // Fatura A4 (txid da consulta prevalece): 100.00, gateway_txid = BL_TXID_CONSULTA
    let fatura_a4_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, gateway_txid)
        VALUES ($1, $2, $3, 'Mensalidade Pix A4', 100.00, CURRENT_DATE + 5, 'pendente', 'itau', 'BL_TXID_CONSULTA')
        "#,
    )
    .bind(fatura_a4_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    // =========================================================================
    // CENÁRIO 1: Cadastro de Webhook Pix
    // =========================================================================
    // 1.1 Sem ITAU_WEBHOOK_BASE_URL -> deve falhar 400
    std::env::remove_var("ITAU_WEBHOOK_BASE_URL");
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/tenant/integrations/itau/webhooks/pix")
        .header("Authorization", format!("Bearer {token_admin_a}"))
        .header("x-tenant-id", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

    // 1.2 Com ITAU_WEBHOOK_BASE_URL -> sucesso 200
    std::env::set_var("ITAU_WEBHOOK_BASE_URL", "https://escola.com.br");

    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/tenant/integrations/itau/webhooks/pix")
        .header("Authorization", format!("Bearer {token_admin_a}"))
        .header("x-tenant-id", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    let resp_status = resp.status();
    let _ = axum::body::to_bytes(resp.into_body(), 1024 * 64)
        .await
        .unwrap();
    assert_eq!(resp_status, StatusCode::OK);

    // Verificar se o simulador recebeu PUT /webhook/{chave} com URL sem /pix
    let chave_chamada = sim_state.webhook_chave.lock().unwrap().clone();
    assert_eq!(chave_chamada, Some("12345678000190".to_string()));

    let last_cad = sim_state.last_webhook_body.lock().unwrap().clone();
    assert!(last_cad.is_some());
    let cad_body = last_cad.unwrap();
    let expected_url = format!("https://escola.com.br/webhooks/itau/{tenant_a}");
    assert_eq!(cad_body["webhookUrl"], expected_url);

    // Verificar se GET /tenant/integrations/itau agora informa webhook_pix_registrado_em
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/tenant/integrations/itau")
        .header("Authorization", format!("Bearer {token_admin_a}"))
        .header("x-tenant-id", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    let resp_status = resp.status();
    let bytes = axum::body::to_bytes(resp.into_body(), 1024 * 64)
        .await
        .unwrap();
    println!(
        "RESP: status={}, body={}",
        resp_status,
        String::from_utf8_lossy(&bytes)
    );
    let estado: Value = serde_json::from_slice(&bytes).unwrap();
    assert!(
        estado["webhook_pix_registrado_em"].is_string(),
        "webhook_pix_registrado_em deve estar preenchido"
    );

    // Verificar audit_log do cadastro
    let audit_cad: Option<(String,)> = sqlx::query_as(
        "SELECT acao FROM audit_logs WHERE tenant_id = $1 AND acao = 'itau_webhook_pix_cadastrado'",
    )
    .bind(tenant_a)
    .fetch_optional(&pool)
    .await
    .unwrap();
    assert!(audit_cad.is_some());

    // =========================================================================
    // CENÁRIO 2: Recepção pública do webhook Pix
    // =========================================================================
    let e2eid_1 = "E1234567820261020120000000000001"; // 32 caracteres alfanuméricos
    let payload_aviso_1 = json!({
        "pix": [
            {
                "endToEndId": e2eid_1,
                "txid": "BL_TXID_001",
                "valor": "150.00",
                "horario": "2026-10-20T12:00:00Z"
            }
        ]
    });

    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/pix"))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_1).unwrap()))
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    let resp_status = resp.status();
    let _ = axum::body::to_bytes(resp.into_body(), 1024 * 64)
        .await
        .unwrap();
    assert_eq!(resp_status, StatusCode::OK);

    // Verificar que gravou em gateway_avisos com tipo='pix' e status='pendente'
    let aviso_row: Option<(String, String, String)> = sqlx::query_as(
        "SELECT tipo, status, event_id FROM gateway_avisos WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_1)
    .fetch_optional(&pool)
    .await
    .unwrap();

    assert_eq!(
        aviso_row,
        Some((
            "pix".to_string(),
            "pendente".to_string(),
            e2eid_1.to_string()
        ))
    );

    // Repetição do mesmo aviso não duplica (idempotência)
    let req_repeat = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/pix"))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_1).unwrap()))
        .unwrap();

    let resp_repeat = app.clone().oneshot(req_repeat).await.unwrap();
    assert_eq!(resp_repeat.status(), StatusCode::OK);

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM gateway_avisos WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_1)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 1);

    // Aviso com e2eid inválido (tamanho != 32) é ignorado e não grava
    let req_invalid = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/pix"))
        .header("Content-Type", "application/json")
        .body(Body::from(
            json!({
                "pix": [
                    { "endToEndId": "invalido_curto", "valor": "50.00" }
                ]
            })
            .to_string(),
        ))
        .unwrap();

    let resp_invalid = app.clone().oneshot(req_invalid).await.unwrap();
    assert_eq!(resp_invalid.status(), StatusCode::OK);

    let invalid_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM gateway_avisos WHERE tenant_id = $1 AND event_id = 'invalido_curto'",
    )
    .bind(tenant_a)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(invalid_count, 0);

    // Tenant inexistente ou inativo responde 200 sem gravar
    let tenant_fantasma = Uuid::new_v4();
    let req_fantasma = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_fantasma}/pix"))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_1).unwrap()))
        .unwrap();

    let resp_fantasma = app.clone().oneshot(req_fantasma).await.unwrap();
    assert_eq!(resp_fantasma.status(), StatusCode::OK);

    // =========================================================================
    // CENÁRIO 3: Processamento e confirmação com baixa da fatura A1
    // =========================================================================
    // Configurar simulador para retornar consulta positiva do e2eid_1
    sim_state.pix_respostas.lock().unwrap().insert(
        e2eid_1.to_string(),
        (
            StatusCode::OK,
            json!({
                "endToEndId": e2eid_1,
                "txid": "BL_TXID_001",
                "valor": "150.00",
                "horario": "2026-10-20T12:00:00Z"
            }),
        ),
    );

    // Forçar proxima_tentativa_em para agora
    sqlx::query(
        "UPDATE gateway_avisos SET proxima_tentativa_em = NOW() - INTERVAL '1 second' WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_1)
    .execute(&pool)
    .await
    .unwrap();

    // Executar ciclo de processamento
    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    // Fatura A1 deve estar paga
    let status_fatura_a1: String =
        sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1 AND tenant_id = $2")
            .bind(fatura_a1_id)
            .bind(tenant_a)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status_fatura_a1, "pago");

    // webhook_events gravado
    let we_row: Option<(String,)> = sqlx::query_as(
        "SELECT gateway_name FROM webhook_events WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_1)
    .fetch_optional(&pool)
    .await
    .unwrap();
    assert_eq!(we_row, Some(("itau".to_string(),)));

    // audit_logs gravado com 'itau_baixa_pix'
    let audit_baixa: Option<(String,)> = sqlx::query_as(
        "SELECT acao FROM audit_logs WHERE tenant_id = $1 AND acao = 'itau_baixa_pix' AND entidade_id = $2",
    )
    .bind(tenant_a)
    .bind(fatura_a1_id.to_string())
    .fetch_optional(&pool)
    .await
    .unwrap();
    assert!(audit_baixa.is_some());

    // gateway_avisos deve estar 'confirmado'
    let status_aviso_1: String = sqlx::query_scalar(
        "SELECT status FROM gateway_avisos WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_1)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status_aviso_1, "confirmado");

    // =========================================================================
    // CENÁRIO 4: Consulta 404 continua pendente com tentativa, depois confirma -> baixa
    // =========================================================================
    let e2eid_2 = "E1234567820261020120000000000002";
    let payload_aviso_2 = json!({
        "pix": [
            {
                "endToEndId": e2eid_2,
                "txid": "BL_TXID_002",
                "valor": "200.00"
            }
        ]
    });

    // Enviar webhook
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/pix"))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_2).unwrap()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    let resp_status = resp.status();
    let _ = axum::body::to_bytes(resp.into_body(), 1024 * 64)
        .await
        .unwrap();
    assert_eq!(resp_status, StatusCode::OK);

    // O simulador NÃO tem e2eid_2 cadastrado -> retornará 404
    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    // Fatura A2 continua pendente
    let status_fatura_a2: String =
        sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1 AND tenant_id = $2")
            .bind(fatura_a2_id)
            .bind(tenant_a)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status_fatura_a2, "pendente");

    // Aviso continua pendente, tentativas = 1
    let (status_aviso_2, tentativas_2): (String, i32) = sqlx::query_as(
        "SELECT status, tentativas FROM gateway_avisos WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_2)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status_aviso_2, "pendente");
    assert_eq!(tentativas_2, 1);

    // Agora o simulador passa a confirmar o pagamento de e2eid_2
    sim_state.pix_respostas.lock().unwrap().insert(
        e2eid_2.to_string(),
        (
            StatusCode::OK,
            json!({
                "endToEndId": e2eid_2,
                "txid": "BL_TXID_002",
                "valor": "200.00"
            }),
        ),
    );

    // Forçar proxima_tentativa_em para agora
    sqlx::query(
        "UPDATE gateway_avisos SET proxima_tentativa_em = NOW() - INTERVAL '1 minute' WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_2)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    // Reprocessar
    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    // Fatura A2 agora está paga
    let status_fatura_a2_pos: String =
        sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1 AND tenant_id = $2")
            .bind(fatura_a2_id)
            .bind(tenant_a)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status_fatura_a2_pos, "pago");

    let status_aviso_2_pos: String = sqlx::query_scalar(
        "SELECT status FROM gateway_avisos WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_2)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status_aviso_2_pos, "confirmado");

    // =========================================================================
    // CENÁRIO 5: txid do aviso diferente da consulta -> vale o da consulta
    // =========================================================================
    let e2eid_4 = "E1234567820261020120000000000004";
    // Aviso vem com txid divergente/errado
    let payload_aviso_4 = json!({
        "pix": [
            {
                "endToEndId": e2eid_4,
                "txid": "BL_TXID_AVISO_ERRADO_999",
                "valor": "100.00"
            }
        ]
    });

    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/pix"))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_4).unwrap()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    let resp_status = resp.status();
    let _ = axum::body::to_bytes(resp.into_body(), 1024 * 64)
        .await
        .unwrap();
    assert_eq!(resp_status, StatusCode::OK);

    // Consulta no simulador retorna o txid correto (BL_TXID_CONSULTA) que bate com fatura_a4
    sim_state.pix_respostas.lock().unwrap().insert(
        e2eid_4.to_string(),
        (
            StatusCode::OK,
            json!({
                "endToEndId": e2eid_4,
                "txid": "BL_TXID_CONSULTA",
                "valor": "100.00"
            }),
        ),
    );

    sqlx::query(
        "UPDATE gateway_avisos SET proxima_tentativa_em = NOW() - INTERVAL '1 second' WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_4)
    .execute(&pool)
    .await
    .unwrap();

    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    // Fatura A4 foi localizada pelo txid da consulta e baixada com sucesso
    let status_fatura_a4: String =
        sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1 AND tenant_id = $2")
            .bind(fatura_a4_id)
            .bind(tenant_a)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status_fatura_a4, "pago");

    // =========================================================================
    // CENÁRIO 6: Valor menor -> divergente sem baixa
    // =========================================================================
    let e2eid_3 = "E1234567820261020120000000000003";
    let payload_aviso_3 = json!({
        "pix": [
            {
                "endToEndId": e2eid_3,
                "txid": "BL_TXID_003",
                "valor": "300.00"
            }
        ]
    });

    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/pix"))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_3).unwrap()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    let resp_status = resp.status();
    let _ = axum::body::to_bytes(resp.into_body(), 1024 * 64)
        .await
        .unwrap();
    assert_eq!(resp_status, StatusCode::OK);

    // Consulta retorna valor 150.00 (fatura é 300.00)
    sim_state.pix_respostas.lock().unwrap().insert(
        e2eid_3.to_string(),
        (
            StatusCode::OK,
            json!({
                "endToEndId": e2eid_3,
                "txid": "BL_TXID_003",
                "valor": "150.00"
            }),
        ),
    );

    sqlx::query(
        "UPDATE gateway_avisos SET proxima_tentativa_em = NOW() - INTERVAL '1 second' WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_3)
    .execute(&pool)
    .await
    .unwrap();

    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    // Fatura A3 continua pendente (não baixa)
    let status_fatura_a3: String =
        sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1 AND tenant_id = $2")
            .bind(fatura_a3_id)
            .bind(tenant_a)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status_fatura_a3, "pendente");

    // Aviso foi descartado
    let status_aviso_3: String = sqlx::query_scalar(
        "SELECT status FROM gateway_avisos WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_a)
    .bind(e2eid_3)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status_aviso_3, "descartado");

    // Audit log registra webhook_valor_divergente
    let audit_div: Option<(String,)> = sqlx::query_as(
        "SELECT acao FROM audit_logs WHERE tenant_id = $1 AND acao = 'webhook_valor_divergente' AND entidade_id = $2",
    )
    .bind(tenant_a)
    .bind(fatura_a3_id.to_string())
    .fetch_optional(&pool)
    .await
    .unwrap();
    assert!(audit_div.is_some());

    // =========================================================================
    // CENÁRIO 7: Isolamento multi-tenant
    // =========================================================================
    // Criar fatura no Tenant A e tentar notificar na rota do Tenant B
    let fatura_iso_a = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, gateway_txid)
        VALUES ($1, $2, $3, 'Mensalidade Iso A', 50.00, CURRENT_DATE + 5, 'pendente', 'itau', 'BL_TXID_ISO')
        "#,
    )
    .bind(fatura_iso_a)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    let e2eid_iso = "E1234567820261020120000000000099";
    let payload_iso = json!({
        "pix": [
            {
                "endToEndId": e2eid_iso,
                "txid": "BL_TXID_ISO",
                "valor": "50.00"
            }
        ]
    });

    // Enviar na rota do Tenant B
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_b}/pix"))
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&payload_iso).unwrap()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    let resp_status = resp.status();
    let _ = axum::body::to_bytes(resp.into_body(), 1024 * 64)
        .await
        .unwrap();
    assert_eq!(resp_status, StatusCode::OK);

    // Consulta no simulador retorna BL_TXID_ISO
    sim_state.pix_respostas.lock().unwrap().insert(
        e2eid_iso.to_string(),
        (
            StatusCode::OK,
            json!({
                "endToEndId": e2eid_iso,
                "txid": "BL_TXID_ISO",
                "valor": "50.00"
            }),
        ),
    );

    sqlx::query(
        "UPDATE gateway_avisos SET proxima_tentativa_em = NOW() - INTERVAL '1 second' WHERE tenant_id = $1 AND event_id = $2",
    )
    .bind(tenant_b)
    .bind(e2eid_iso)
    .execute(&pool)
    .await
    .unwrap();

    // Processar pendentes do Tenant B
    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_b)
        .await
        .unwrap();

    // A fatura do Tenant A NÃO pode ter sido baixada pelo webhook do Tenant B!
    let status_iso_a: String =
        sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1 AND tenant_id = $2")
            .bind(fatura_iso_a)
            .bind(tenant_a)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status_iso_a, "pendente");

    // Limpeza
    drop_database(&admin, &db_name).await;
}
