use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, Request, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use base64::Engine;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::Digest;
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
    last_cadastro_body: Arc<Mutex<Option<Value>>>,
    cadastro_headers: Arc<Mutex<Vec<String>>>,
    situacao_boleto: Arc<Mutex<String>>,
    valor_pago_consulta: Arc<Mutex<Option<String>>>,
    consulta_count: Arc<Mutex<u32>>,
}

async fn sim_oauth_token() -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "access_token": "sim_sts_token_valido_999",
            "token_type": "Bearer",
            "expires_in": 300
        })),
    )
}

async fn sim_cadastrar_notificacao(
    State(state): State<SimulatorState>,
    headers: header::HeaderMap,
    Json(payload): Json<Value>,
) -> (StatusCode, Json<Value>) {
    if let Some(apikey) = headers.get("x-itau-apikey").and_then(|h| h.to_str().ok()) {
        state
            .cadastro_headers
            .lock()
            .unwrap()
            .push(apikey.to_string());
    }
    *state.last_cadastro_body.lock().unwrap() = Some(payload);
    (
        StatusCode::CREATED,
        Json(json!({
            "data": {
                "id_notificacao_boleto": "notif_sim_123",
                "status": "sucesso"
            }
        })),
    )
}

#[derive(Deserialize)]
struct ConsultaQuery {
    #[allow(dead_code)]
    id_beneficiario: Option<String>,
    nosso_numero: Option<String>,
}

async fn sim_consultar_boletos(
    State(state): State<SimulatorState>,
    Query(query): Query<ConsultaQuery>,
) -> (StatusCode, Json<Value>) {
    *state.consulta_count.lock().unwrap() += 1;
    let situacao = state.situacao_boleto.lock().unwrap().clone();
    let nosso_num = query.nosso_numero.unwrap_or_else(|| "00000001".to_string());
    let valor_pago = state.valor_pago_consulta.lock().unwrap().clone();

    let mut pagamento_arr = vec![];
    if let Some(vp) = valor_pago {
        pagamento_arr.push(json!({
            "valor_pago_total_cobranca": vp
        }));
    }

    (
        StatusCode::OK,
        Json(json!({
            "data": [
                {
                    "id_boleto": "bol_sim_consultado",
                    "dado_boleto": {
                        "dados_individuais_boleto": [
                            {
                                "situacao_geral_boleto": situacao,
                                "numero_nosso_numero": nosso_num,
                                "pagamentos": pagamento_arr
                            }
                        ]
                    }
                }
            ]
        })),
    )
}

async fn start_simulator() -> (String, SimulatorState) {
    let state = SimulatorState {
        situacao_boleto: Arc::new(Mutex::new("Pago".to_string())),
        ..Default::default()
    };

    let app = Router::new()
        .route("/as/token.oauth2", post(sim_oauth_token))
        .route("/api/oauth/token", post(sim_oauth_token))
        .route("/notificacoes_boletos", post(sim_cadastrar_notificacao))
        .route("/boletos", get(sim_consultar_boletos))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    (format!("http://127.0.0.1:{port}"), state)
}

#[tokio::test]
async fn test_webhook_itau_boleto_suite_completa() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de webhook Itaú ignorado.");
        return;
    };

    let (sim_url, sim_state) = start_simulator().await;
    std::env::set_var("ITAU_API_BASE_URL", &sim_url);
    std::env::set_var("ITAU_STS_BASE_URL", &sim_url);

    let db_name = format!("escolar_itau_webhook_{}", Uuid::new_v4().simple());
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

    // Setup Tenant A e B
    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();
    let admin_user_a = Uuid::new_v4();
    let admin_user_b = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola Alpha', $2), ($3, 'Escola Beta', $4)"
    )
    .bind(tenant_a)
    .bind(format!("alpha-{}", &tenant_a.to_string()[..8]))
    .bind(tenant_b)
    .bind(format!("beta-{}", &tenant_b.to_string()[..8]))
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Admin A', $3, 'hash', 'admin'), ($4, $5, 'Admin B', $6, 'hash', 'admin')"
    )
    .bind(admin_user_a)
    .bind(tenant_a)
    .bind(format!("admin-{}@alpha.com", &tenant_a.to_string()[..8]))
    .bind(admin_user_b)
    .bind(tenant_b)
    .bind(format!("admin-{}@beta.com", &tenant_b.to_string()[..8]))
    .execute(&pool)
    .await
    .unwrap();

    let token_admin_a = generate_jwt(admin_user_a, tenant_a, "admin", &jwt_private).unwrap();

    let token_admin_b = generate_jwt(admin_user_b, tenant_b, "admin", &jwt_private).unwrap();

    // 1. Configurar tenant_itau_config e credenciais para Tenant A e B
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
        b"client_id_test_a",
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
        b"client_secret_test_a",
        Some(admin_user_a),
    )
    .await
    .unwrap();

    // Tenant B setup
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
        b"client_id_test_b",
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
        b"client_secret_test_b",
        Some(admin_user_b),
    )
    .await
    .unwrap();

    // 2. Alunos e faturas para Tenant A
    let aluno_a_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel) VALUES ($1, $2, 'Aluno Teste Alpha', '11122233344', '2015-05-10', 'Resp Test', 'resp@test.com', '11999999999')"
    )
    .bind(aluno_a_id)
    .bind(tenant_a)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    let fatura_a1_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, nosso_numero, gateway_invoice_id)
        VALUES ($1, $2, $3, 'Mensalidade A1', 150.00, CURRENT_DATE + 5, 'pendente', 'itau', '00000001', 'bol_itau_001')
        "#
    )
    .bind(fatura_a1_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    let fatura_a2_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, nosso_numero, gateway_invoice_id)
        VALUES ($1, $2, $3, 'Mensalidade A2', 150.00, CURRENT_DATE + 5, 'pendente', 'itau', '00000002', 'bol_itau_002')
        "#
    )
    .bind(fatura_a2_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    let fatura_a3_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, nosso_numero, gateway_invoice_id)
        VALUES ($1, $2, $3, 'Mensalidade A3', 150.00, CURRENT_DATE + 5, 'pendente', 'itau', '00000003', 'bol_itau_003')
        "#
    )
    .bind(fatura_a3_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    let fatura_a4_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, nosso_numero, gateway_invoice_id)
        VALUES ($1, $2, $3, 'Mensalidade A4', 200.00, CURRENT_DATE + 5, 'pendente', 'itau', '00000004', 'bol_itau_004')
        "#
    )
    .bind(fatura_a4_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    let fatura_a5_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO faturas
            (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, nosso_numero, gateway_invoice_id)
        VALUES ($1, $2, $3, 'Mensalidade A5', 100.00, CURRENT_DATE + 5, 'pendente', 'itau', '00000005', 'bol_itau_005')
        "#
    )
    .bind(fatura_a5_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .execute(&mut *conn_a)
    .await
    .unwrap();

    // =========================================================================
    // CASO 1: Cadastro de webhook de boleto (admin)
    // =========================================================================
    println!("--- TESTE 1: Cadastro de webhook boleto ---");

    // Sem ITAU_WEBHOOK_BASE_URL configurado -> 400
    std::env::remove_var("ITAU_WEBHOOK_BASE_URL");
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/tenant/integrations/itau/webhooks/boleto")
        .header(header::AUTHORIZATION, format!("Bearer {token_admin_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

    // Com ITAU_WEBHOOK_BASE_URL -> 200 OK e chama simulador
    std::env::set_var("ITAU_WEBHOOK_BASE_URL", "https://escola.exemplo.com");
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/tenant/integrations/itau/webhooks/boleto")
        .header(header::AUTHORIZATION, format!("Bearer {token_admin_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let body_bytes = axum::body::to_bytes(resp.into_body(), 1024 * 64)
        .await
        .unwrap();
    if status != StatusCode::OK {
        panic!(
            "Status esperado 200, recebido {}: {}",
            status,
            String::from_utf8_lossy(&body_bytes)
        );
    }
    let json_resp: Value = serde_json::from_slice(&body_bytes).unwrap();
    let webhook_client_id_a = json_resp["webhook_client_id"].as_str().unwrap().to_string();
    assert!(!webhook_client_id_a.is_empty());

    // Conferir payload enviado ao simulador
    let cadastro_body = sim_state
        .last_cadastro_body
        .lock()
        .unwrap()
        .clone()
        .unwrap();
    assert_eq!(
        cadastro_body["data"]["webhook_url"],
        format!("https://escola.exemplo.com/webhooks/itau/{tenant_a}/boletos")
    );
    assert_eq!(
        cadastro_body["data"]["webhook_oauth_url"],
        format!("https://escola.exemplo.com/webhooks/itau/{tenant_a}/oauth/token")
    );
    let webhook_client_secret_texto = cadastro_body["data"]["webhook_client_secret"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(webhook_client_secret_texto.len(), 64); // 32 bytes em hex

    // Conferir que o secret foi gravado APENAS como hash
    let hash_bytes = secrets::ler(
        &mut escolar_backend::db::acquire_tenant(&pool, tenant_a)
            .await
            .unwrap(),
        &chave_mestra,
        tenant_a,
        "itau",
        TipoSegredo::WebhookClientSecretHash,
    )
    .await
    .unwrap()
    .unwrap();
    let hash_hex = String::from_utf8(hash_bytes).unwrap();
    assert_eq!(
        hash_hex,
        hex::encode(sha2::Sha256::digest(webhook_client_secret_texto.as_bytes()))
    );

    // Conferir GET de estado informando webhook_boleto_registrado_em
    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/tenant/integrations/itau")
        .header(header::AUTHORIZATION, format!("Bearer {token_admin_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body_bytes = axum::body::to_bytes(resp.into_body(), 1024 * 64)
        .await
        .unwrap();
    let estado_json: Value = serde_json::from_slice(&body_bytes).unwrap();
    assert!(estado_json["webhook_boleto_registrado_em"].is_string());

    // Cadastrar também no Tenant B para os testes de isolamento
    let req_b = Request::builder()
        .method("POST")
        .uri("/api/v1/tenant/integrations/itau/webhooks/boleto")
        .header(header::AUTHORIZATION, format!("Bearer {token_admin_b}"))
        .header("X-Tenant-ID", tenant_b.to_string())
        .body(Body::empty())
        .unwrap();
    let resp_b = app.clone().oneshot(req_b).await.unwrap();
    assert_eq!(resp_b.status(), StatusCode::OK);
    let body_bytes_b = axum::body::to_bytes(resp_b.into_body(), 1024 * 64)
        .await
        .unwrap();
    let json_resp_b: Value = serde_json::from_slice(&body_bytes_b).unwrap();
    let webhook_client_id_b = json_resp_b["webhook_client_id"]
        .as_str()
        .unwrap()
        .to_string();
    let cadastro_body_b = sim_state
        .last_cadastro_body
        .lock()
        .unwrap()
        .clone()
        .unwrap();
    let webhook_client_secret_b = cadastro_body_b["data"]["webhook_client_secret"]
        .as_str()
        .unwrap()
        .to_string();

    // =========================================================================
    // CASO 2: Rota de token OAuth2 (/webhooks/itau/:tenant_id/oauth/token)
    // =========================================================================
    println!("--- TESTE 2: Emissor OAuth2 de tokens do webhook ---");

    // Client errado -> 401 invalid_client
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/oauth/token"))
        .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(Body::from(
            "grant_type=client_credentials&client_id=errado&client_secret=123",
        ))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    let b = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
    assert_eq!(
        serde_json::from_slice::<Value>(&b).unwrap()["error"],
        "invalid_client"
    );

    // Secret errado -> 401 invalid_client
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/oauth/token"))
        .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(Body::from(format!(
            "grant_type=client_credentials&client_id={webhook_client_id_a}&client_secret=secreterrondisse"
        )))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

    // Certo via Form -> 200 com access_token
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/oauth/token"))
        .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(Body::from(format!(
            "grant_type=client_credentials&client_id={webhook_client_id_a}&client_secret={webhook_client_secret_texto}"
        )))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let b = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
    let token_resp: Value = serde_json::from_slice(&b).unwrap();
    let token_webhook_a = token_resp["access_token"].as_str().unwrap().to_string();
    assert_eq!(token_resp["token_type"], "Bearer");
    assert_eq!(token_resp["expires_in"], 300);

    // Certo via Basic Auth
    let credentials_b64 = base64::engine::general_purpose::STANDARD
        .encode(format!("{webhook_client_id_a}:{webhook_client_secret_texto}").as_bytes());
    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/webhooks/itau/{tenant_a}/oauth/token"))
        .header(header::AUTHORIZATION, format!("Basic {credentials_b64}"))
        .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(Body::from("grant_type=client_credentials"))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Gerar token do Tenant B
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_b}/oauth/token"))
        .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(Body::from(format!(
            "grant_type=client_credentials&client_id={webhook_client_id_b}&client_secret={webhook_client_secret_b}"
        )))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let b = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
    let token_webhook_b = serde_json::from_slice::<Value>(&b).unwrap()["access_token"]
        .as_str()
        .unwrap()
        .to_string();

    // Token do Tenant B NÃO vale na rota do Tenant A -> 401
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/boletos"))
        .header(header::AUTHORIZATION, format!("Bearer {token_webhook_b}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from("{}"))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

    // Token vencido -> 401
    let token_vencido = escolar_backend::handlers::webhooks_itau::gerar_webhook_token(
        tenant_a,
        &chave_mestra,
        -10, // já expirou há 10s
    )
    .unwrap();
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/boletos"))
        .header(header::AUTHORIZATION, format!("Bearer {token_vencido}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from("{}"))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

    // =========================================================================
    // CASO 3: Aviso BAIXA_EFETIVA com consulta "Pago" -> Baixa na fatura + idempotência
    // =========================================================================
    println!("--- TESTE 3: BAIXA_EFETIVA com consulta 'Pago' ---");

    *sim_state.situacao_boleto.lock().unwrap() = "Pago".to_string();
    *sim_state.valor_pago_consulta.lock().unwrap() = Some("150.00".to_string());

    let payload_aviso_1 = json!({
        "boletos": [
            {
                "idBoleto": "bol_itau_001",
                "numeroNossoNumero": "00000001",
                "tipoLiquidacao": "06",
                "tipoCobranca": "boleto",
                "dataInclusaoPagamento": "2026-10-20",
                "valorPagoTotalCobranca": "150.00"
            }
        ]
    });

    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/boletos"))
        .header(header::AUTHORIZATION, format!("Bearer {token_webhook_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_1).unwrap()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    // Processar pendentes
    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    // Conferir fatura baixada
    let status_fat: String = sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura_a1_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status_fat, "pago");

    // Conferir webhook_events
    let count_events: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM webhook_events WHERE tenant_id = $1 AND gateway_name = 'itau' AND event_id = 'bol_itau_001:06:2026-10-20'"
    )
    .bind(tenant_a)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count_events, 1);

    // Conferir audit_logs
    let count_audit: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND acao = 'itau_baixa_boleto' AND entidade_id = $2"
    )
    .bind(tenant_a)
    .bind(fatura_a1_id.to_string())
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count_audit, 1);

    // Repetir o mesmo aviso -> 200 rápido e não duplica baixa nem webhook_events
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/boletos"))
        .header(header::AUTHORIZATION, format!("Bearer {token_webhook_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_1).unwrap()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    let count_events_after: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM webhook_events WHERE tenant_id = $1 AND gateway_name = 'itau' AND event_id = 'bol_itau_001:06:2026-10-20'"
    )
    .bind(tenant_a)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count_events_after, 1);

    // =========================================================================
    // CASO 4: BAIXA_OPERACIONAL -> fatura continua pendente
    // =========================================================================
    println!("--- TESTE 4: BAIXA_OPERACIONAL (95) ---");

    let payload_aviso_2 = json!({
        "boletos": [
            {
                "idBoleto": "bol_itau_002",
                "numeroNossoNumero": "00000002",
                "tipoLiquidacao": "95",
                "dataInclusaoPagamento": "2026-10-20",
                "valorPagoTotalCobranca": "150.00"
            }
        ]
    });

    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/boletos"))
        .header(header::AUTHORIZATION, format!("Bearer {token_webhook_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_2).unwrap()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    let status_fat2: String = sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura_a2_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status_fat2, "pendente");

    let audit_95: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND acao = 'itau_pagamento_informado'"
    )
    .bind(tenant_a)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(audit_95 >= 1);

    // =========================================================================
    // CASO 5: Consulta "não pago" -> continua pendente com tentativa; depois "paga" -> baixa
    // =========================================================================
    println!("--- TESTE 5: Consulta 'não pago' seguido de reprocessamento ---");

    *sim_state.situacao_boleto.lock().unwrap() = "Em Aberto".to_string();

    let payload_aviso_3 = json!({
        "idBoleto": "bol_itau_003",
        "numeroNossoNumero": "00000003",
        "tipoLiquidacao": "06",
        "dataInclusaoPagamento": "2026-10-20",
        "valorPagoTotalCobranca": "150.00"
    });

    // Aceita também objeto único conforme o card
    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/boletos"))
        .header(header::AUTHORIZATION, format!("Bearer {token_webhook_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_3).unwrap()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    // Fatura continua pendente
    let status_fat3: String = sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura_a3_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status_fat3, "pendente");

    // Tentativa registrada em gateway_avisos
    let tentativas: i32 = sqlx::query_scalar(
        "SELECT tentativas FROM gateway_avisos WHERE tenant_id = $1 AND event_id = 'bol_itau_003:06:2026-10-20'"
    )
    .bind(tenant_a)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(tentativas, 1);

    // Simulador agora diz que foi liquidado
    *sim_state.situacao_boleto.lock().unwrap() = "Liquidado".to_string();
    *sim_state.valor_pago_consulta.lock().unwrap() = Some("150.00".to_string());

    // Forçar proxima_tentativa_em para agora
    sqlx::query(
        "UPDATE gateway_avisos SET proxima_tentativa_em = NOW() - INTERVAL '1 second' WHERE tenant_id = $1 AND event_id = 'bol_itau_003:06:2026-10-20'"
    )
    .bind(tenant_a)
    .execute(&pool)
    .await
    .unwrap();

    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    // Agora sim foi baixado
    let status_fat3_after: String = sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura_a3_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status_fat3_after, "pago");

    // =========================================================================
    // CASO 6: Valor menor -> divergente, sem baixa
    // =========================================================================
    println!("--- TESTE 6: Valor divergente menor que o título ---");

    *sim_state.situacao_boleto.lock().unwrap() = "Pago".to_string();
    *sim_state.valor_pago_consulta.lock().unwrap() = Some("180.00".to_string()); // fatura é 200.00

    let payload_aviso_4 = json!({
        "boletos": [
            {
                "idBoleto": "bol_itau_004",
                "numeroNossoNumero": "00000004",
                "tipoLiquidacao": "06",
                "dataInclusaoPagamento": "2026-10-20",
                "valorPagoTotalCobranca": "180.00"
            }
        ]
    });

    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_a}/boletos"))
        .header(header::AUTHORIZATION, format!("Bearer {token_webhook_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload_aviso_4).unwrap()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_a)
        .await
        .unwrap();

    // Fatura continua pendente
    let status_fat4: String = sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura_a4_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status_fat4, "pendente");

    // Aviso descartado
    let status_aviso4: String = sqlx::query_scalar(
        "SELECT status FROM gateway_avisos WHERE tenant_id = $1 AND event_id = 'bol_itau_004:06:2026-10-20'"
    )
    .bind(tenant_a)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status_aviso4, "descartado");

    // Audit log de divergência
    let audit_div: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND acao = 'webhook_valor_divergente' AND entidade_id = $2"
    )
    .bind(tenant_a)
    .bind(fatura_a4_id.to_string())
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audit_div, 1);

    // =========================================================================
    // CASO 7: Isolamento entre tenants
    // =========================================================================
    println!("--- TESTE 7: Isolamento entre tenants ---");

    *sim_state.situacao_boleto.lock().unwrap() = "Pago".to_string();
    *sim_state.valor_pago_consulta.lock().unwrap() = Some("100.00".to_string());

    // Enviar aviso na rota do Tenant B usando idBoleto e nosso_numero da fatura A5 do Tenant A
    let payload_aviso_cross = json!({
        "boletos": [
            {
                "idBoleto": "bol_itau_005",
                "numeroNossoNumero": "00000005",
                "tipoLiquidacao": "06",
                "dataInclusaoPagamento": "2026-10-20",
                "valorPagoTotalCobranca": "100.00"
            }
        ]
    });

    let req = Request::builder()
        .method("POST")
        .uri(format!("/webhooks/itau/{tenant_b}/boletos"))
        .header(header::AUTHORIZATION, format!("Bearer {token_webhook_b}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::to_vec(&payload_aviso_cross).unwrap(),
        ))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    escolar_backend::services::itau_avisos::processar_pendentes(&state, tenant_b)
        .await
        .unwrap();

    // A fatura A5 do Tenant A CONTINUA pendente (não foi afetada pela rota do B)
    let status_fat5: String = sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura_a5_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status_fat5, "pendente");

    // No Tenant B o aviso foi descartado por fatura não encontrada
    let status_aviso_b: String = sqlx::query_scalar(
        "SELECT status FROM gateway_avisos WHERE tenant_id = $1 AND event_id = 'bol_itau_005:06:2026-10-20'"
    )
    .bind(tenant_b)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status_aviso_b, "descartado");

    // Limpeza
    pool.close().await;
    drop_database(&admin, &db_name).await;
    println!("--- SUITE DE WEBHOOK ITAU BOLETO CONCLUÍDA COM SUCESSO! ---");
}
