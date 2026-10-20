use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, Request, StatusCode},
    response::Json,
    routing::{get, patch, post},
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
    last_payload: Arc<Mutex<Option<Value>>>,
    correlation_ids: Arc<Mutex<Vec<String>>>,
    fail_422: Arc<Mutex<bool>>,
    fail_500: Arc<Mutex<bool>>,
    fail_duplicado: Arc<Mutex<bool>>,
    return_202: Arc<Mutex<bool>>,
    consultar_not_found: Arc<Mutex<bool>>,
    consultar_not_found_once: Arc<Mutex<bool>>,
    consultar_retorno_custom: Arc<Mutex<Option<Value>>>,
    fail_baixa: Arc<Mutex<bool>>,
    baixa_called: Arc<Mutex<bool>>,
    baixa_ids: Arc<Mutex<Vec<String>>>,
    emitir_count: Arc<Mutex<u32>>,
    consultar_count: Arc<Mutex<u32>>,
    emitted_nosso_numeros: Arc<Mutex<Vec<String>>>,
}

async fn sim_oauth_token() -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "access_token": "sim_oauth_token_valido_999",
            "token_type": "Bearer",
            "expires_in": 300
        })),
    )
}

async fn sim_boletos_pix(
    State(state): State<SimulatorState>,
    headers: header::HeaderMap,
    Json(payload): Json<Value>,
) -> (StatusCode, Json<Value>) {
    if let Some(cid) = headers
        .get("x-itau-correlationid")
        .and_then(|h| h.to_str().ok())
    {
        state.correlation_ids.lock().unwrap().push(cid.to_string());
    }

    *state.last_payload.lock().unwrap() = Some(payload.clone());
    *state.emitir_count.lock().unwrap() += 1;

    let nosso_numero = payload
        .pointer("/dado_boleto/dados_individuais_boleto/0/numero_nosso_numero")
        .and_then(|v| v.as_str())
        .unwrap_or("00000001")
        .to_string();

    state
        .emitted_nosso_numeros
        .lock()
        .unwrap()
        .push(nosso_numero.clone());

    if *state.fail_500.lock().unwrap() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "codigo": "500",
                "mensagem": "Erro interno do servidor Itaú simulado"
            })),
        );
    }

    if *state.fail_duplicado.lock().unwrap() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "codigo": "422",
                "mensagem": "Boleto com nosso_numero já existente para o beneficiário",
                "campos": [
                    {
                        "campo": "numero_nosso_numero",
                        "mensagem": "já cadastrado"
                    }
                ]
            })),
        );
    }

    if *state.fail_422.lock().unwrap() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "codigo": "422",
                "mensagem": "Erro de validação de negócio do Itaú",
                "campos": [
                    {
                        "campo": "data_vencimento",
                        "mensagem": "Vencimento menor que prazo mínimo permitido"
                    }
                ]
            })),
        );
    }

    if *state.return_202.lock().unwrap() {
        return (
            StatusCode::ACCEPTED,
            Json(json!({
                "codigo": "202",
                "mensagem": "Operação em andamento, consulte seu bolecode em instantes"
            })),
        );
    }

    (
        StatusCode::OK,
        Json(json!({
            "dado_boleto": {
                "dados_individuais_boleto": [
                    {
                        "id_boleto_individual": "boleto_ind_sim_001",
                        "numero_linha_digitavel": "34191111111111111111111111111111111111111111111",
                        "codigo_barras": "34191111111111111111111111111111111111111111",
                        "numero_nosso_numero": nosso_numero
                    }
                ]
            },
            "dados_qrcode": {
                "chave": "12345678000190",
                "txid": "BL1234567890123456789012345678901",
                "emv": "00020126580014br.gov.bcb.pix0136simulado520400005303986540512.345802BR5925Escola6009SAOPAULO62070503***63041D3A"
            }
        })),
    )
}

async fn sim_consultar_boletos(
    State(state): State<SimulatorState>,
    headers: header::HeaderMap,
) -> (StatusCode, Json<Value>) {
    if let Some(cid) = headers
        .get("x-itau-correlationid")
        .and_then(|h| h.to_str().ok())
    {
        state.correlation_ids.lock().unwrap().push(cid.to_string());
    }

    *state.consultar_count.lock().unwrap() += 1;

    if *state.consultar_not_found_once.lock().unwrap() {
        *state.consultar_not_found_once.lock().unwrap() = false;
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "mensagem": "Boleto não encontrado" })),
        );
    }

    if *state.consultar_not_found.lock().unwrap() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "mensagem": "Boleto não encontrado" })),
        );
    }

    if let Some(custom) = state.consultar_retorno_custom.lock().unwrap().clone() {
        return (StatusCode::OK, Json(custom));
    }

    (
        StatusCode::OK,
        Json(json!({
            "data": [
                {
                    "id_boleto": "boleto_consultado_999",
                    "dado_boleto": {
                        "dados_individuais_boleto": [
                            {
                                "numero_linha_digitavel": "34192222222222222222222222222222222222222222222",
                                "codigo_barras": "34192222222222222222222222222222222222222222",
                                "numero_nosso_numero": "00000003"
                            }
                        ]
                    },
                    "dados_qrcode": {
                        "txid": "BL2222222222222222222222222222222",
                        "emv": "00020126580014br.gov.bcb.pix0136consultado520400005303986540512.345802BR5925Escola6009SAOPAULO62070503***63041D3A"
                    }
                }
            ]
        })),
    )
}

async fn sim_baixar_boleto(
    State(state): State<SimulatorState>,
    Path(id): Path<String>,
    headers: header::HeaderMap,
) -> (StatusCode, Json<Value>) {
    if let Some(cid) = headers
        .get("x-itau-correlationid")
        .and_then(|h| h.to_str().ok())
    {
        state.correlation_ids.lock().unwrap().push(cid.to_string());
    }

    *state.baixa_called.lock().unwrap() = true;
    state.baixa_ids.lock().unwrap().push(id);

    if *state.fail_baixa.lock().unwrap() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({
                "mensagem": "Boleto não pode ser baixado pois já está liquidado"
            })),
        );
    }

    (StatusCode::NO_CONTENT, Json(json!({})))
}

async fn start_simulator() -> (String, SimulatorState) {
    let state = SimulatorState::default();

    let app = Router::new()
        .route("/as/token.oauth2", post(sim_oauth_token))
        .route("/api/oauth/token", post(sim_oauth_token))
        .route("/boletos-pix", post(sim_boletos_pix))
        .route("/boletos", get(sim_consultar_boletos))
        .route("/boletos/:id/baixa", patch(sim_baixar_boleto))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    (format!("http://127.0.0.1:{port}"), state)
}

#[tokio::test]
async fn test_itau_emissao_suite_completa() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de emissão Itaú ignorado.");
        return;
    };

    let (sim_url, sim_state) = start_simulator().await;
    std::env::set_var("ITAU_API_BASE_URL", &sim_url);
    std::env::set_var("ITAU_STS_BASE_URL", &sim_url);

    let db_name = format!("escolar_itau_emissao_{}", Uuid::new_v4().simple());
    let admin = PgPoolOptions::new()
        .max_connections(2)
        .connect(&admin_url)
        .await
        .expect("conexão administrativa");

    sqlx::query(&format!("CREATE DATABASE {db_name}"))
        .execute(&admin)
        .await
        .expect("criação do database descartável");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url_for(&admin_url, &db_name))
        .await
        .expect("conexão ao database de teste");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("aplicação das migrations");

    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();
    let user_admin_a = Uuid::new_v4();
    let user_admin_b = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola A', $2), ($3, 'Escola B', $4)",
    )
    .bind(tenant_a)
    .bind(format!("escola-a-{}", &tenant_a.to_string()[..8]))
    .bind(tenant_b)
    .bind(format!("escola-b-{}", &tenant_b.to_string()[..8]))
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query("INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Admin A', 'admin@a.test', 'hash', 'admin'), ($3, $4, 'Admin B', 'admin@b.test', 'hash', 'admin')")
        .bind(user_admin_a)
        .bind(tenant_a)
        .bind(user_admin_b)
        .bind(tenant_b)
        .execute(&pool)
        .await
        .unwrap();

    let chave_mestra = ChaveMestra::from_hex(TEST_SECRETS_HEX).unwrap();

    // Grava credenciais Itaú para Tenant A
    {
        let mut conn = pool.acquire().await.unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_a,
            "itau",
            TipoSegredo::ClientId,
            b"client_id_teste_1234",
            Some(user_admin_a),
        )
        .await
        .unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_a,
            "itau",
            TipoSegredo::ClientSecret,
            b"client_secret_super_secreto",
            Some(user_admin_a),
        )
        .await
        .unwrap();
    }

    // Configura tenant_itau_config ativo para Tenant A
    sqlx::query(
        r#"
        INSERT INTO tenant_itau_config (tenant_id, agencia, conta, dac, id_beneficiario, chave_pix, especie_padrao, multa_padrao_percentual, juros_padrao_percentual, ativo, proximo_nosso_numero)
        VALUES ($1, '1500', '0005206', '1', '150000052061', '12345678000190', '04', 2.00, 1.00, true, 1)
        "#
    )
    .bind(tenant_a)
    .execute(&pool)
    .await
    .unwrap();

    // Cria Aluno A com endereço completo e responsável
    let aluno_a_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO alunos (
            id, tenant_id, nome, cpf, data_nascimento,
            nome_responsavel, email_responsavel, telefone_responsavel,
            cpf_responsavel_legal,
            nome_responsavel_financeiro, cpf_responsavel_financeiro,
            logradouro, numero, complemento, bairro, cidade, estado, cep
        ) VALUES (
            $1, $2, 'Aluno Teste A', '11122233344', '2015-05-10',
            'Resp Legal', 'resp@a.test', '11999999999',
            '11111111111',
            'Maria da Silva [Responsável]', '12345678901',
            'Rua das Palmeiras', '100', 'Apto 201', 'Bela Vista', 'São Paulo', 'SP', '01310-100'
        )
        "#,
    )
    .bind(aluno_a_id)
    .bind(tenant_a)
    .execute(&pool)
    .await
    .unwrap();

    // Cria Aluno Incompleto para testar validação 400
    let aluno_incompleto_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO alunos (
            id, tenant_id, nome, cpf, data_nascimento,
            nome_responsavel, email_responsavel, telefone_responsavel,
            nome_responsavel_financeiro, cpf_responsavel_financeiro,
            logradouro, numero, bairro, cidade, estado, cep
        ) VALUES (
            $1, $2, 'Aluno Sem CEP', '55566677788', '2015-05-10',
            'Resp Inc', 'inc@a.test', '11888888888',
            'Resp Incompleto', '12345678901',
            'Rua A', '1', 'Centro', 'São Paulo', 'SP', ''
        )
        "#,
    )
    .bind(aluno_incompleto_id)
    .bind(tenant_a)
    .execute(&pool)
    .await
    .unwrap();

    // Cria faturas para teste
    let fatura_1_id = Uuid::new_v4();
    let fatura_2_id = Uuid::new_v4();
    let fatura_3_id = Uuid::new_v4();
    let fatura_4_id = Uuid::new_v4();
    let fatura_5_id = Uuid::new_v4();
    let fatura_6_id = Uuid::new_v4();
    let fatura_7_id = Uuid::new_v4();
    let fatura_incompleta_id = Uuid::new_v4();
    let fatura_paga_id = Uuid::new_v4();

    let vencimento_futuro = chrono::Utc::now().date_naive() + chrono::Duration::days(15);

    sqlx::query(
        r#"
        INSERT INTO faturas (id, tenant_id, aluno_id, descricao, valor, data_vencimento, metodo_pagamento, status, multa_percentual, juros_mora_mes_percentual)
        VALUES
            ($1, $10, $11, 'Mensalidade 01/26', 750.00, $12, 'boleto', 'pendente', 2.0, 1.0),
            ($2, $10, $11, 'Mensalidade 02/26', 800.00, $12, 'boleto', 'pendente', 2.0, 1.0),
            ($3, $10, $11, 'Mensalidade 03/26', 850.00, $12, 'boleto', 'pendente', 2.0, 1.0),
            ($4, $10, $11, 'Mensalidade 04/26', 900.00, $12, 'boleto', 'pendente', 2.0, 1.0),
            ($5, $10, $11, 'Mensalidade 05/26', 950.00, $12, 'boleto', 'pendente', 2.0, 1.0),
            ($6, $10, $11, 'Mensalidade 06/26', 1000.00, $12, 'boleto', 'pendente', 2.0, 1.0),
            ($7, $10, $11, 'Mensalidade 07/26', 1050.00, $12, 'boleto', 'pendente', 2.0, 1.0),
            ($8, $10, $13, 'Mensalidade Incompleta', 500.00, $12, 'boleto', 'pendente', 2.0, 1.0),
            ($9, $10, $11, 'Mensalidade Paga', 600.00, $12, 'boleto', 'pago', 2.0, 1.0)
        "#
    )
    .bind(fatura_1_id)
    .bind(fatura_2_id)
    .bind(fatura_3_id)
    .bind(fatura_4_id)
    .bind(fatura_5_id)
    .bind(fatura_6_id)
    .bind(fatura_7_id)
    .bind(fatura_incompleta_id)
    .bind(fatura_paga_id)
    .bind(tenant_a)
    .bind(aluno_a_id)
    .bind(vencimento_futuro)
    .bind(aluno_incompleto_id)
    .execute(&pool)
    .await
    .unwrap();

    let (priv_key_pem, pub_key_pem, pub_x) = development_signing_material();

    let config = Config {
        database_url: database_url_for(&admin_url, &db_name),
        jwt_private_pem: priv_key_pem.clone(),
        jwt_public_pem: pub_key_pem.clone(),
        jwt_public_x: pub_x.clone(),
        port: 8000,
        allowed_origins: "http://localhost:3000".to_string(),
        environment: "development".to_string(),
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
        app_secrets_key: Some(chave_mestra),
        itau_mode: ItauMode::Sandbox,
        itau_sts_base_url: Some(sim_url.clone()),
    };

    let app_state = AppState {
        pool: pool.clone(),
        config: config.clone(),
        message_hub: MessageHub::new(),
        ip_rate_limiter: IpRateLimiter::new(),
    };

    let token_a = generate_jwt(user_admin_a, tenant_a, "admin", &priv_key_pem).unwrap();
    let token_b = generate_jwt(user_admin_b, tenant_b, "admin", &priv_key_pem).unwrap();

    let app = create_router(app_state);

    // =========================================================================
    // Caso 1 & 2: Emissão 200 OK + Payload bate com mapeamento + nosso_numero sequencial
    // =========================================================================
    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_1_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from("{}"))
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let body_bytes = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
        .await
        .unwrap();
    if status != StatusCode::OK {
        panic!(
            "Status was {}, body: {}",
            status,
            String::from_utf8_lossy(&body_bytes)
        );
    }
    let resp_json: Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(resp_json["gateway_name"], "itau");
    assert_eq!(resp_json["gateway_invoice_id"], "boleto_ind_sim_001");
    assert_eq!(resp_json["nosso_numero"], "00000001");
    assert_eq!(
        resp_json["codigo_barras"],
        "34191111111111111111111111111111111111111111"
    );
    assert_eq!(
        resp_json["gateway_digitable_line"],
        "34191111111111111111111111111111111111111111111"
    );
    assert!(resp_json["gateway_pix_code"]
        .as_str()
        .unwrap()
        .contains("00020126"));
    assert_eq!(
        resp_json["gateway_txid"],
        "BL1234567890123456789012345678901"
    );
    assert_eq!(resp_json["gateway_emissao_pendente"], false);

    // Verifica payload que chegou no simulador
    let last_payload = sim_state.last_payload.lock().unwrap().clone().unwrap();
    assert_eq!(last_payload["etapa_processo_boleto"], "efetivacao");
    assert_eq!(
        last_payload["beneficiario"]["id_beneficiario"],
        "150000052061"
    );
    assert_eq!(
        last_payload["dado_boleto"]["descricao_instrumento_cobranca"],
        "boleto_pix"
    );
    assert_eq!(last_payload["dado_boleto"]["tipo_boleto"], "a vista");
    assert_eq!(last_payload["dado_boleto"]["codigo_carteira"], "109");
    assert_eq!(last_payload["dado_boleto"]["codigo_especie"], "04");
    assert_eq!(last_payload["dado_boleto"]["codigo_tipo_vencimento"], 3);
    assert_eq!(last_payload["dado_boleto"]["valor_total_titulo"], "750.00");
    assert_eq!(
        last_payload["dado_boleto"]["multa"]["codigo_tipo_multa"],
        "02"
    );
    assert_eq!(
        last_payload["dado_boleto"]["multa"]["percentual_multa"],
        "2.00000"
    );
    assert_eq!(
        last_payload["dado_boleto"]["juros"]["codigo_tipo_juros"],
        "90"
    );
    assert_eq!(
        last_payload["dado_boleto"]["juros"]["percentual_juros"],
        "1.00000"
    );
    assert_eq!(
        last_payload["dado_boleto"]["desconto"]["codigo_tipo_desconto"],
        "00"
    );
    assert_eq!(
        last_payload["dado_boleto"]["recebimento_divergente"]["codigo_tipo_autorizacao"],
        "03"
    );
    assert_eq!(last_payload["dados_qrcode"]["chave"], "12345678000190");
    assert_eq!(last_payload["dados_qrcode"]["tipo_cobranca"], "cob");
    assert_eq!(
        last_payload["dado_boleto"]["dados_individuais_boleto"][0]["numero_nosso_numero"],
        "00000001"
    );
    // Pagador normalizado sem colchetes:
    assert_eq!(
        last_payload["dado_boleto"]["pagador"]["pessoa"]["nome_pessoa"],
        "Maria da Silva Responsável"
    );
    assert_eq!(
        last_payload["dado_boleto"]["pagador"]["pessoa"]["tipo_pessoa"]["codigo_tipo_pessoa"],
        "F"
    );
    assert_eq!(
        last_payload["dado_boleto"]["pagador"]["pessoa"]["tipo_pessoa"]
            ["numero_cadastro_pessoa_fisica"],
        "12345678901"
    );
    assert_eq!(
        last_payload["dado_boleto"]["pagador"]["endereco"]["nome_logradouro"],
        "Rua das Palmeiras, 100 - Apto 201"
    );
    assert_eq!(
        last_payload["dado_boleto"]["pagador"]["endereco"]["nome_bairro"],
        "Bela Vista"
    );
    assert_eq!(
        last_payload["dado_boleto"]["pagador"]["endereco"]["sigla_UF"],
        "SP"
    );
    assert_eq!(
        last_payload["dado_boleto"]["pagador"]["endereco"]["numero_CEP"],
        "01310100"
    );

    // Segunda chamada na mesma fatura 1 devolve existente sem reemitir:
    let emit_before = *sim_state.emitir_count.lock().unwrap();
    let req_repeat = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_1_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from("{}"))
        .unwrap();
    let resp_repeat = app.clone().oneshot(req_repeat).await.unwrap();
    assert_eq!(resp_repeat.status(), StatusCode::OK);
    let emit_after = *sim_state.emitir_count.lock().unwrap();
    assert_eq!(
        emit_before, emit_after,
        "Segunda chamada não deve chamar o Itaú novamente"
    );

    // =========================================================================
    // Caso 3: Emissão sequencial de nosso_numero na fatura 2 (00000002)
    // =========================================================================
    let req2 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_2_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp2 = app.clone().oneshot(req2).await.unwrap();
    assert_eq!(resp2.status(), StatusCode::OK);
    let body_bytes2 = axum::body::to_bytes(resp2.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let resp_json2: Value = serde_json::from_slice(&body_bytes2).unwrap();
    assert_eq!(resp_json2["nosso_numero"], "00000002");

    // =========================================================================
    // Caso 4: 202 Accepted + marca pendente + segunda chamada consulta sem reemitir
    // =========================================================================
    *sim_state.return_202.lock().unwrap() = true;
    let req3 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_3_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp3 = app.clone().oneshot(req3).await.unwrap();
    assert_eq!(resp3.status(), StatusCode::ACCEPTED);
    let body_bytes3 = axum::body::to_bytes(resp3.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let resp_json3: Value = serde_json::from_slice(&body_bytes3).unwrap();
    assert_eq!(resp_json3["status"], "pendente");
    assert_eq!(resp_json3["mensagem"], "emissão em andamento");
    assert_eq!(resp_json3["nosso_numero"], "00000003");

    // Verifica no banco que fatura 3 está pendente com nosso_numero 00000003
    let pendente_db: (bool, Option<String>) =
        sqlx::query_as("SELECT gateway_emissao_pendente, nosso_numero FROM faturas WHERE id = $1")
            .bind(fatura_3_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(pendente_db.0);
    assert_eq!(pendente_db.1.as_deref(), Some("00000003"));

    // Desliga 202 no simulador
    *sim_state.return_202.lock().unwrap() = false;
    let emitir_count_before_consulta = *sim_state.emitir_count.lock().unwrap();

    // Segunda chamada na fatura 3 deve chamar consulta (GET /boletos) sem reemitir
    let req3_consulta = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_3_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp3_consulta = app.clone().oneshot(req3_consulta).await.unwrap();
    assert_eq!(resp3_consulta.status(), StatusCode::OK);
    assert_eq!(
        *sim_state.consultar_count.lock().unwrap(),
        1,
        "GET /boletos deve ter sido chamado"
    );
    assert_eq!(
        *sim_state.emitir_count.lock().unwrap(),
        emitir_count_before_consulta,
        "POST /boletos-pix não deve ser chamado novamente"
    );

    // =========================================================================
    // Caso 5: 422 do Itaú devolve mensagem e não grava
    // =========================================================================
    *sim_state.fail_422.lock().unwrap() = true;
    let req4 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_4_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp4 = app.clone().oneshot(req4).await.unwrap();
    assert_eq!(resp4.status(), StatusCode::UNPROCESSABLE_ENTITY);

    // Verifica que fatura 4 não foi gravada como emitida (sem nosso_numero/gateway_name depois)
    let fatura_4_db: (Option<String>, Option<String>, Option<String>, bool) =
        sqlx::query_as("SELECT gateway_name, gateway_invoice_id, nosso_numero, gateway_emissao_pendente FROM faturas WHERE id = $1")
            .bind(fatura_4_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(fatura_4_db.0.is_none());
    assert!(fatura_4_db.1.is_none());
    assert!(fatura_4_db.2.is_none());
    assert!(!fatura_4_db.3);
    *sim_state.fail_422.lock().unwrap() = false;

    // =========================================================================
    // Caso 6: Endereço incompleto → 400 e simulador não é chamado
    // =========================================================================
    let emitir_antes_incompleto = *sim_state.emitir_count.lock().unwrap();
    let req_inc = Request::builder()
        .method("POST")
        .uri(format!(
            "/api/v1/financeiro/faturas/{fatura_incompleta_id}/itau"
        ))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp_inc = app.clone().oneshot(req_inc).await.unwrap();
    assert_eq!(resp_inc.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        *sim_state.emitir_count.lock().unwrap(),
        emitir_antes_incompleto,
        "Simulador não deve ser chamado quando endereço é incompleto"
    );

    // =========================================================================
    // Caso 7: Fatura já paga → 409 Conflict
    // =========================================================================
    let req_paga = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_paga_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp_paga = app.clone().oneshot(req_paga).await.unwrap();
    assert_eq!(resp_paga.status(), StatusCode::CONFLICT);

    // =========================================================================
    // Caso 8: Integração inativa → 409 Conflict
    // =========================================================================
    // Desativa a integração temporariamente
    sqlx::query("UPDATE tenant_itau_config SET ativo = false WHERE tenant_id = $1")
        .bind(tenant_a)
        .execute(&pool)
        .await
        .unwrap();
    let req_inativa = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_4_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp_inativa = app.clone().oneshot(req_inativa).await.unwrap();
    assert_eq!(resp_inativa.status(), StatusCode::CONFLICT);
    // Reativa a integração
    sqlx::query("UPDATE tenant_itau_config SET ativo = true WHERE tenant_id = $1")
        .bind(tenant_a)
        .execute(&pool)
        .await
        .unwrap();

    // =========================================================================
    // Caso 8b: Integração ativa sem chave Pix → 409 e simulador NÃO recebe chamada
    // =========================================================================
    sqlx::query("UPDATE tenant_itau_config SET chave_pix = NULL WHERE tenant_id = $1")
        .bind(tenant_a)
        .execute(&pool)
        .await
        .unwrap();

    let emitir_count_antes_sem_pix = *sim_state.emitir_count.lock().unwrap();
    let consultar_count_antes_sem_pix = *sim_state.consultar_count.lock().unwrap();

    let req_sem_pix = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_5_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp_sem_pix = app.clone().oneshot(req_sem_pix).await.unwrap();
    assert_eq!(resp_sem_pix.status(), StatusCode::CONFLICT);
    let body_sem_pix = axum::body::to_bytes(resp_sem_pix.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let str_sem_pix = String::from_utf8_lossy(&body_sem_pix);
    assert!(
        str_sem_pix.contains(
            "Preencha agência, conta e chave Pix na configuração do Itaú antes de emitir."
        ),
        "Mensagem esperada para chave Pix ausente, recebido: {str_sem_pix}"
    );
    assert_eq!(
        *sim_state.emitir_count.lock().unwrap(),
        emitir_count_antes_sem_pix,
        "Simulador não deve ser chamado quando chave Pix está ausente"
    );
    assert_eq!(
        *sim_state.consultar_count.lock().unwrap(),
        consultar_count_antes_sem_pix,
        "Simulador de consulta não deve ser chamado quando chave Pix está ausente"
    );

    // Restaura chave_pix
    sqlx::query("UPDATE tenant_itau_config SET chave_pix = '12345678000190' WHERE tenant_id = $1")
        .bind(tenant_a)
        .execute(&pool)
        .await
        .unwrap();

    // =========================================================================
    // Caso 8c: Simulador devolve 500 na emissão → fatura fica pendente com nosso_numero;
    // nova chamada consulta, não acha (404), reemite com o MESMO número;
    // sequência não pula na próxima fatura
    // =========================================================================
    *sim_state.fail_500.lock().unwrap() = true;

    let req5 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_5_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp5 = app.clone().oneshot(req5).await.unwrap();
    assert_eq!(resp5.status(), StatusCode::BAD_GATEWAY);
    let body_bytes5 = axum::body::to_bytes(resp5.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let str5 = String::from_utf8_lossy(&body_bytes5);
    assert!(
        str5.contains("não foi possível confirmar a emissão; tente de novo para consultar"),
        "Mensagem de 502 esperada, recebido: {str5}"
    );

    // Confere no banco: fatura 5 gravada ANTES como pendente com nosso_numero
    let fatura_5_db: (Option<String>, Option<String>, bool) = sqlx::query_as(
        "SELECT gateway_name, nosso_numero, gateway_emissao_pendente FROM faturas WHERE id = $1",
    )
    .bind(fatura_5_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(fatura_5_db.0.as_deref(), Some("itau"));
    let nosso_num_fatura_5 = fatura_5_db
        .1
        .expect("nosso_numero deve ter sido gravado antes da chamada");
    assert_eq!(nosso_num_fatura_5, "00000005");
    assert!(fatura_5_db.2, "gateway_emissao_pendente deve ser true");

    // Desliga 500 e ativa consulta 404 (não achou)
    *sim_state.fail_500.lock().unwrap() = false;
    *sim_state.consultar_not_found.lock().unwrap() = true;
    sim_state.emitted_nosso_numeros.lock().unwrap().clear();

    // Segunda chamada na fatura 5: consulta -> não acha -> reemite com o MESMO nosso_numero
    let req5_reemit = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_5_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp5_reemit = app.clone().oneshot(req5_reemit).await.unwrap();
    assert_eq!(resp5_reemit.status(), StatusCode::OK);
    let body_bytes5_reemit = axum::body::to_bytes(resp5_reemit.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let json5: Value = serde_json::from_slice(&body_bytes5_reemit).unwrap();
    assert_eq!(json5["nosso_numero"], "00000005");
    assert_eq!(json5["gateway_emissao_pendente"], false);

    // Confere que no simulador a reemissão enviou exatamente o mesmo nosso_numero
    let emitted_numbers = sim_state.emitted_nosso_numeros.lock().unwrap().clone();
    assert_eq!(emitted_numbers, vec!["00000005".to_string()]);

    *sim_state.consultar_not_found.lock().unwrap() = false;

    // Próxima emissão (fatura 6): sequência NÃO pulou número
    let req6 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_6_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp6 = app.clone().oneshot(req6).await.unwrap();
    assert_eq!(resp6.status(), StatusCode::OK);
    let body_bytes6 = axum::body::to_bytes(resp6.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let json6: Value = serde_json::from_slice(&body_bytes6).unwrap();
    assert_eq!(
        json6["nosso_numero"], "00000006",
        "A sequência não deve pular número"
    );

    // =========================================================================
    // Caso 8d: Na reemissão, Itaú responde que número já existe → consulta de novo e grava
    // =========================================================================
    sqlx::query(
        "UPDATE faturas SET gateway_name = 'itau', nosso_numero = '00000007', gateway_emissao_pendente = true WHERE id = $1",
    )
    .bind(fatura_7_id)
    .execute(&pool)
    .await
    .unwrap();

    *sim_state.consultar_not_found_once.lock().unwrap() = true;
    *sim_state.fail_duplicado.lock().unwrap() = true;
    *sim_state.consultar_retorno_custom.lock().unwrap() = Some(json!({
        "data": [
            {
                "id_boleto": "boleto_duplicado_recuperado_777",
                "dado_boleto": {
                    "dados_individuais_boleto": [
                        {
                            "numero_linha_digitavel": "34193333333333333333333333333333333333333333333",
                            "codigo_barras": "34193333333333333333333333333333333333333333",
                            "numero_nosso_numero": "00000007"
                        }
                    ]
                },
                "dados_qrcode": {
                    "txid": "BL3333333333333333333333333333333",
                    "emv": "00020126580014br.gov.bcb.pix0136duplicado520400005303986540512.345802BR5925Escola6009SAOPAULO62070503***63041D3A"
                }
            }
        ]
    }));

    let req7 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_7_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp7 = app.clone().oneshot(req7).await.unwrap();
    assert_eq!(resp7.status(), StatusCode::OK);
    let body_bytes7 = axum::body::to_bytes(resp7.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let json7: Value = serde_json::from_slice(&body_bytes7).unwrap();
    assert_eq!(json7["nosso_numero"], "00000007");
    assert_eq!(
        json7["gateway_invoice_id"],
        "boleto_duplicado_recuperado_777"
    );
    assert_eq!(json7["gateway_emissao_pendente"], false);

    *sim_state.fail_duplicado.lock().unwrap() = false;
    *sim_state.consultar_retorno_custom.lock().unwrap() = None;

    // =========================================================================
    // Caso 9: Cancelar fatura emitida chama baixa no Itaú
    // =========================================================================
    let req_cancel = Request::builder()
        .method("DELETE")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_1_id}"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp_cancel = app.clone().oneshot(req_cancel).await.unwrap();
    assert_eq!(resp_cancel.status(), StatusCode::OK);
    assert!(*sim_state.baixa_called.lock().unwrap());
    assert_eq!(
        sim_state.baixa_ids.lock().unwrap().last().unwrap(),
        "boleto_ind_sim_001"
    );

    // Status no banco atualizado para cancelado
    let status_cancel: String = sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura_1_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status_cancel, "cancelado");

    // =========================================================================
    // Caso 10: Baixa recusada pelo Itaú NÃO cancela a fatura (502 Bad Gateway)
    // =========================================================================
    *sim_state.fail_baixa.lock().unwrap() = true;
    let req_cancel_fail = Request::builder()
        .method("DELETE")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_2_id}"))
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let resp_cancel_fail = app.clone().oneshot(req_cancel_fail).await.unwrap();
    assert_eq!(resp_cancel_fail.status(), StatusCode::BAD_GATEWAY);

    // Fatura continua com status pendente no banco!
    let status_nao_cancelado: String =
        sqlx::query_scalar("SELECT status FROM faturas WHERE id = $1")
            .bind(fatura_2_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status_nao_cancelado, "pendente");

    // =========================================================================
    // Caso 11: Isolamento entre tenants (Tenant B não emite fatura do Tenant A)
    // =========================================================================
    let req_tenant_b = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/financeiro/faturas/{fatura_2_id}/itau"))
        .header(header::AUTHORIZATION, format!("Bearer {token_b}"))
        .header("X-Tenant-ID", tenant_b.to_string())
        .body(Body::empty())
        .unwrap();
    let resp_tenant_b = app.clone().oneshot(req_tenant_b).await.unwrap();
    assert_eq!(resp_tenant_b.status(), StatusCode::NOT_FOUND);

    // =========================================================================
    // Caso 12: x-itau-correlationID presente e diferente por chamada
    // =========================================================================
    let cids = sim_state.correlation_ids.lock().unwrap().clone();
    assert!(!cids.is_empty(), "correlation IDs devem estar presentes");
    for cid in &cids {
        assert!(Uuid::parse_str(cid).is_ok(), "Deve ser um UUID v4 válido");
    }
    let mut cids_dedup = cids.clone();
    cids_dedup.sort();
    cids_dedup.dedup();
    assert_eq!(
        cids.len(),
        cids_dedup.len(),
        "Cada requisição deve ter um correlationID único"
    );

    // =========================================================================
    // Caso 13: Nenhum log ou resposta com client_secret
    // =========================================================================
    let resp_str = format!("{:?}", resp_json);
    assert!(!resp_str.contains("client_secret_super_secreto"));

    pool.close().await;
    drop_database(&admin, &db_name).await;
}
