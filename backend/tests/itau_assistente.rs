use axum::{
    body::Body,
    extract::State,
    http::{header, Request, StatusCode},
    response::Json,
    routing::post,
    Router,
};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rsa::pkcs1v15::SigningKey;
use rsa::pkcs8::{DecodePublicKey, EncodePrivateKey, LineEnding};
use rsa::rand_core::OsRng;
use rsa::signature::Keypair;
use rsa::{RsaPrivateKey, RsaPublicKey};
use serde_json::{json, Value};
use sha2::Sha512;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use tower::ServiceExt;
use uuid::Uuid;
use x509_cert::builder::{Builder, CertificateBuilder, Profile};
use x509_cert::der::pem::LineEnding as DerLineEnding;
use x509_cert::der::{DecodePem, EncodePem};
use x509_cert::name::Name;
use x509_cert::request::CertReq;
use x509_cert::serial_number::SerialNumber;
use x509_cert::spki::SubjectPublicKeyInfoOwned;
use x509_cert::time::Validity;

use escolar_backend::{
    config::{
        development_signing_material, AppState, ChaveMestra, Config, CoraMode, EmailMode, ItauMode,
    },
    handlers::auth::generate_jwt,
    middleware::security::IpRateLimiter,
    realtime::MessageHub,
    routes::create_router,
    services::itau_sts::cifrar_aes_256_cbc,
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

fn gerar_certificado_teste(client_id: &str, dias_validade: u64) -> (String, String) {
    let mut rng = OsRng;
    let private_key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
    let signing_key = SigningKey::<Sha512>::new(private_key.clone());
    let priv_pem = private_key
        .to_pkcs8_pem(LineEnding::LF)
        .unwrap()
        .to_string();

    let serial_number = SerialNumber::from(42u32);
    let validity =
        Validity::from_now(std::time::Duration::from_secs(dias_validade * 86400)).unwrap();
    let profile = Profile::Root;
    let subject = Name::from_str(&format!("CN={client_id},OU=Escola Teste,C=BR")).unwrap();
    let pub_key = SubjectPublicKeyInfoOwned::from_key(signing_key.verifying_key()).unwrap();
    let builder = CertificateBuilder::new(
        profile,
        serial_number,
        validity,
        subject,
        pub_key,
        &signing_key,
    )
    .unwrap();
    let cert = builder.build::<rsa::pkcs1v15::Signature>().unwrap();
    let cert_pem = cert.to_pem(DerLineEnding::LF).unwrap();
    (cert_pem, priv_pem)
}

fn assinar_csr_teste(
    csr_pem: &str,
    signing_key: &SigningKey<Sha512>,
    ca_name: &Name,
    dias_validade: u64,
) -> String {
    let req = CertReq::from_pem(csr_pem.as_bytes()).expect("CSR inválido no simulador");
    let serial_number = SerialNumber::from(42u32);
    let validity =
        Validity::from_now(std::time::Duration::from_secs(dias_validade * 86400)).unwrap();
    let profile = Profile::Leaf {
        issuer: ca_name.clone(),
        enable_key_agreement: false,
        enable_key_encipherment: false,
    };
    let builder = CertificateBuilder::new(
        profile,
        serial_number,
        validity,
        req.info.subject,
        req.info.public_key,
        signing_key,
    )
    .unwrap();
    let cert = builder.build::<rsa::pkcs1v15::Signature>().unwrap();
    cert.to_pem(DerLineEnding::LF).unwrap()
}

#[derive(Clone)]
struct SimulatorState {
    fail_solicitacao: Arc<Mutex<bool>>,
    received_token: Arc<Mutex<Option<String>>>,
    received_csr: Arc<Mutex<Option<String>>>,
    test_cert_pem: Arc<Mutex<String>>,
    client_secret: Arc<Mutex<String>>,
    ca_signing_key: Arc<SigningKey<Sha512>>,
    ca_name: Name,
    dias_validade: Arc<Mutex<u64>>,
}

async fn sim_solicitar_certificado(
    State(state): State<SimulatorState>,
    headers: header::HeaderMap,
    body: String,
) -> (StatusCode, Json<Value>) {
    if *state.fail_solicitacao.lock().unwrap() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Internal Error" })),
        );
    }

    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .unwrap_or_default();
    let token = auth_header.strip_prefix("Bearer ").unwrap_or_default();
    *state.received_token.lock().unwrap() = Some(token.to_string());
    *state.received_csr.lock().unwrap() = Some(body.clone());

    let dias = *state.dias_validade.lock().unwrap();
    let cert = if body.contains("BEGIN CERTIFICATE REQUEST") {
        assinar_csr_teste(&body, &state.ca_signing_key, &state.ca_name, dias)
    } else {
        state.test_cert_pem.lock().unwrap().clone()
    };
    let secret = state.client_secret.lock().unwrap().clone();

    (
        StatusCode::OK,
        Json(json!({
            "certificado": cert,
            "client_secret": secret
        })),
    )
}

async fn sim_oauth_token() -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "access_token": "sim_oauth_token_valido_12345",
            "token_type": "Bearer",
            "expires_in": 300
        })),
    )
}

async fn sim_renovar_certificado(
    State(state): State<SimulatorState>,
    headers: header::HeaderMap,
    body: String,
) -> (StatusCode, Json<Value>) {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .unwrap_or_default();
    let token = auth_header.strip_prefix("Bearer ").unwrap_or_default();
    *state.received_token.lock().unwrap() = Some(token.to_string());
    *state.received_csr.lock().unwrap() = Some(body.clone());

    let dias = *state.dias_validade.lock().unwrap();
    let cert = if body.contains("BEGIN CERTIFICATE REQUEST") {
        assinar_csr_teste(&body, &state.ca_signing_key, &state.ca_name, dias)
    } else {
        state.test_cert_pem.lock().unwrap().clone()
    };

    (
        StatusCode::OK,
        Json(json!({
            "certificado": cert
        })),
    )
}

async fn start_simulator() -> (String, SimulatorState) {
    let (cert_pem, _) = gerar_certificado_teste("sim_client_id_default", 365);
    let mut rng = OsRng;
    let ca_private_key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
    let ca_signing_key = Arc::new(SigningKey::<Sha512>::new(ca_private_key));
    let ca_name = Name::from_str("CN=Simulador Itau STS CA,O=Banco Itau Unibanco SA,C=BR").unwrap();

    let state = SimulatorState {
        fail_solicitacao: Arc::new(Mutex::new(false)),
        received_token: Arc::new(Mutex::new(None)),
        received_csr: Arc::new(Mutex::new(None)),
        test_cert_pem: Arc::new(Mutex::new(cert_pem)),
        client_secret: Arc::new(Mutex::new("sim_secret_xyz_987".to_string())),
        ca_signing_key,
        ca_name,
        dias_validade: Arc::new(Mutex::new(365)),
    };

    let app = Router::new()
        .route(
            "/seguranca/v1/certificado/solicitacao",
            post(sim_solicitar_certificado),
        )
        .route("/as/token.oauth2", post(sim_oauth_token))
        .route("/api/oauth/token", post(sim_oauth_token))
        .route(
            "/seguranca/v1/certificado/renovacao",
            post(sim_renovar_certificado),
        )
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    (format!("http://127.0.0.1:{port}"), state)
}

#[tokio::test]
async fn test_itau_assistente_fluxo_completo() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de assistente Itaú ignorado.");
        return;
    };

    let (sim_url, sim_state) = start_simulator().await;

    let db_name = format!("escolar_itau_assistente_{}", Uuid::new_v4().simple());
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

    let tenant_id = Uuid::new_v4();
    let user_admin_id = Uuid::new_v4();
    let user_gestor_id = Uuid::new_v4();
    let user_prof_id = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola Itaú Modelo', $2)")
        .bind(tenant_id)
        .bind(format!("escola-itau-{}", &tenant_id.to_string()[..8]))
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Admin User', 'admin@itau.test', 'hash', 'admin')")
        .bind(user_admin_id)
        .bind(tenant_id)
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Gestor User', 'gestor@itau.test', 'hash', 'gestor')")
        .bind(user_gestor_id)
        .bind(tenant_id)
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Prof User', 'prof@itau.test', 'hash', 'professor')")
        .bind(user_prof_id)
        .bind(tenant_id)
        .execute(&pool)
        .await
        .unwrap();

    let (priv_key_pem, pub_key_pem, pub_x) = development_signing_material();

    let config_prod = Config {
        itau_renovacao_automatica: false,
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
        app_secrets_key: Some(ChaveMestra::from_hex(TEST_SECRETS_HEX).unwrap()),
        itau_mode: ItauMode::Production,
        itau_sts_base_url: Some(sim_url.clone()),
    };

    let state_prod = AppState {
        pool: pool.clone(),
        config: config_prod.clone(),
        message_hub: MessageHub::new(),
        ip_rate_limiter: IpRateLimiter::new(),
    };

    let token_admin = generate_jwt(user_admin_id, tenant_id, "admin", &priv_key_pem).unwrap();
    let token_gestor = generate_jwt(user_gestor_id, tenant_id, "gestor", &priv_key_pem).unwrap();
    let token_prof = generate_jwt(user_prof_id, tenant_id, "professor", &priv_key_pem).unwrap();

    let app_prod = create_router(state_prod.clone());

    // 1. RBAC: GET aceita gestor e admin, mas rejeita professor com 403
    {
        let req_prof = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/integrations/itau")
            .header(header::AUTHORIZATION, format!("Bearer {token_prof}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_prof = app_prod.clone().oneshot(req_prof).await.unwrap();
        assert_eq!(resp_prof.status(), StatusCode::FORBIDDEN);

        let req_gestor = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/integrations/itau")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_gestor = app_prod.clone().oneshot(req_gestor).await.unwrap();
        assert_eq!(resp_gestor.status(), StatusCode::OK);
    }

    // 2. Sem APP_SECRETS_KEY -> rotas 3-8 respondem 503 ServiceUnavailable
    {
        let mut config_no_key = config_prod.clone();
        config_no_key.app_secrets_key = None;
        let state_no_key = AppState {
            pool: pool.clone(),
            config: config_no_key,
            message_hub: MessageHub::new(),
            ip_rate_limiter: IpRateLimiter::new(),
        };
        let app_no_key = create_router(state_no_key);

        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/chave-transporte")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(json!({}).to_string()))
            .unwrap();
        let resp = app_no_key.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    // 3. ITAU_MODE=mock -> rotas 3-8 respondem 400 "modo simulado: nada é enviado ao banco"
    {
        let mut config_mock = config_prod.clone();
        config_mock.itau_mode = ItauMode::Mock;
        let state_mock = AppState {
            pool: pool.clone(),
            config: config_mock,
            message_hub: MessageHub::new(),
            ip_rate_limiter: IpRateLimiter::new(),
        };
        let app_mock = create_router(state_mock);

        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/chave-transporte")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(json!({}).to_string()))
            .unwrap();
        let resp = app_mock.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let body: Value =
            serde_json::from_slice(&axum::body::to_bytes(resp.into_body(), 1024).await.unwrap())
                .unwrap();
        assert!(body["error"].as_str().unwrap().contains("modo simulado"));
    }

    // 4. PUT /tenant/integrations/itau/dados: validação e salvamento
    {
        // 400 se agência inválida
        let req_inv = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/integrations/itau/dados")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                json!({
                    "agencia": "12",
                    "conta": "1234567",
                    "dac": "8",
                    "chave_pix": "pix@escola.test"
                })
                .to_string(),
            ))
            .unwrap();
        let resp_inv = app_prod.clone().oneshot(req_inv).await.unwrap();
        assert_eq!(resp_inv.status(), StatusCode::BAD_REQUEST);

        // Sucesso com dados válidos
        let req_ok = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/integrations/itau/dados")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                json!({
                    "agencia": "1234",
                    "conta": "1234567",
                    "dac": "8",
                    "chave_pix": "escola@itau.test",
                    "especie_padrao": "04",
                    "multa_padrao_percentual": 2.5,
                    "juros_padrao_percentual": 1.2
                })
                .to_string(),
            ))
            .unwrap();
        let resp_ok = app_prod.clone().oneshot(req_ok).await.unwrap();
        assert_eq!(resp_ok.status(), StatusCode::OK);
        let body_ok: Value = serde_json::from_slice(
            &axum::body::to_bytes(resp_ok.into_body(), 1024)
                .await
                .unwrap(),
        )
        .unwrap();
        assert_eq!(body_ok["id_beneficiario"], "123412345678");
    }

    // 5. POST /tenant/integrations/itau/ativar sem teste prévio -> 409 Conflict
    {
        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/ativar")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(json!({ "ativo": true }).to_string()))
            .unwrap();
        let resp = app_prod.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::CONFLICT);
    }

    // 6. POST /tenant/integrations/itau/chave-transporte
    let public_transport_pem: String = {
        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/chave-transporte")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(json!({}).to_string()))
            .unwrap();
        let resp = app_prod.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body: Value =
            serde_json::from_slice(&axum::body::to_bytes(resp.into_body(), 4096).await.unwrap())
                .unwrap();
        let pub_pem = body["chave_publica_pem"].as_str().unwrap().to_string();
        assert!(pub_pem.contains("-----BEGIN PUBLIC KEY-----"));

        // Se chamar novamente sem substituir=true -> 409
        let req_dup = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/chave-transporte")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(json!({ "substituir": false }).to_string()))
            .unwrap();
        let resp_dup = app_prod.clone().oneshot(req_dup).await.unwrap();
        assert_eq!(resp_dup.status(), StatusCode::CONFLICT);

        pub_pem
    };

    // 7. Simular e-mail do Itaú e chamada com falha 500 do simulador
    let client_id_raw = "client-id-itau-escola-1234";
    let token_raw = "token-temporario-sts-abcde-999";
    let session_key_raw = [0x5au8; 32];
    let iv_zero = [0u8; 16];

    let pub_key_parsed = RsaPublicKey::from_public_key_pem(&public_transport_pem).unwrap();
    let enc_session_key = pub_key_parsed
        .encrypt(&mut OsRng, rsa::Pkcs1v15Encrypt, &session_key_raw)
        .unwrap();
    let chave_sessao_cifrada_b64 = STANDARD.encode(&enc_session_key);

    let enc_client_id =
        cifrar_aes_256_cbc(&session_key_raw, &iv_zero, client_id_raw.as_bytes()).unwrap();
    let client_id_cifrado_b64 = STANDARD.encode(&enc_client_id);

    let enc_token = cifrar_aes_256_cbc(&session_key_raw, &iv_zero, token_raw.as_bytes()).unwrap();
    let token_temporario_cifrado_b64 = STANDARD.encode(&enc_token);

    // Quando o simulador falha (500), nada é gravado
    {
        *sim_state.fail_solicitacao.lock().unwrap() = true;

        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/credenciais")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                json!({
                    "chave_sessao_cifrada": chave_sessao_cifrada_b64,
                    "client_id_cifrado": client_id_cifrado_b64,
                    "token_temporario_cifrado": token_temporario_cifrado_b64
                })
                .to_string(),
            ))
            .unwrap();
        let resp = app_prod.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);

        // Chave de transporte continua existindo pois a transação não gravou nada
        let req_estado = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/integrations/itau")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_est = app_prod.clone().oneshot(req_estado).await.unwrap();
        let body_est: Value = serde_json::from_slice(
            &axum::body::to_bytes(resp_est.into_body(), 4096)
                .await
                .unwrap(),
        )
        .unwrap();
        assert_eq!(body_est["has_chave_transporte"], true);
        assert_eq!(body_est["has_client_id"], false);
        assert_eq!(body_est["has_certificado"], false);
    }

    // 8. Sucesso na rota 4: simulador 200 devolve certificado e secret
    {
        *sim_state.fail_solicitacao.lock().unwrap() = false;

        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/credenciais")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                json!({
                    "chave_sessao_cifrada": chave_sessao_cifrada_b64,
                    "client_id_cifrado": client_id_cifrado_b64,
                    "token_temporario_cifrado": token_temporario_cifrado_b64
                })
                .to_string(),
            ))
            .unwrap();
        let resp = app_prod.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Validar que o simulador recebeu o Bearer token certo e o CSR com CN
        assert_eq!(
            sim_state.received_token.lock().unwrap().as_deref(),
            Some(token_raw)
        );
        let csr_recebido = sim_state.received_csr.lock().unwrap().clone().unwrap();
        assert!(csr_recebido.contains("-----BEGIN CERTIFICATE REQUEST-----"));
        let csr = <x509_cert::request::CertReq as x509_cert::der::DecodePem>::from_pem(
            csr_recebido.as_bytes(),
        )
        .unwrap();
        assert!(csr.info.subject.to_string().contains(client_id_raw));
    }

    // 9. Conferir estado após sucesso na rota 4:
    // - GET não devolve segredos
    // - has_chave_transporte é false (chave de transporte foi apagada)
    // - has_client_id é true, client_id_mascarado presente
    // - has_certificado é true, certificado_valido_ate presente
    {
        let req = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/integrations/itau")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .body(Body::empty())
            .unwrap();
        let resp = app_prod.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body: Value =
            serde_json::from_slice(&axum::body::to_bytes(resp.into_body(), 4096).await.unwrap())
                .unwrap();

        assert_eq!(body["has_chave_transporte"], false);
        assert_eq!(body["has_client_id"], true);
        assert_eq!(body["has_client_secret"], true);
        assert_eq!(body["has_certificado"], true);
        assert!(body["client_id_mascarado"].as_str().unwrap().contains('…'));
        assert_ne!(body["client_id_mascarado"].as_str().unwrap(), client_id_raw);
        assert!(body["certificado_valido_ate"].is_string());
        // Certificado novo de 365 dias não pode ser renovado ainda (faltam > 30 dias)
        assert_eq!(body["pode_renovar"], false);

        // Conferir que nenhum valor secreto aparece no JSON
        let body_str = body.to_string();
        assert!(!body_str.contains("sim_secret_xyz_987"));
        assert!(!body_str.contains(client_id_raw));
    }

    // 10. Rota 6: POST /tenant/integrations/itau/testar -> grava ultimo_teste_ok_em
    {
        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/testar")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .body(Body::empty())
            .unwrap();
        let resp = app_prod.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Agora GET mostra ultimo_teste_ok_em preenchido
        let req_estado = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/integrations/itau")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_est = app_prod.clone().oneshot(req_estado).await.unwrap();
        let body_est: Value = serde_json::from_slice(
            &axum::body::to_bytes(resp_est.into_body(), 4096)
                .await
                .unwrap(),
        )
        .unwrap();
        assert!(body_est["ultimo_teste_ok_em"].is_string());
    }

    // 11. Rota 7: Agora com teste bem-sucedido, ativar tem sucesso!
    {
        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/ativar")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(json!({ "ativo": true }).to_string()))
            .unwrap();
        let resp = app_prod.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body: Value =
            serde_json::from_slice(&axum::body::to_bytes(resp.into_body(), 1024).await.unwrap())
                .unwrap();
        assert_eq!(body["ativo"], true);
    }

    // 12. Rota 8: Renovar com certificado válido por 365 dias responde 400 (só pode se <= 30 dias)
    {
        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/renovar")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .body(Body::empty())
            .unwrap();
        let resp = app_prod.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    // 13. Sandbox: Rota 5 credenciais-sandbox
    {
        let mut config_sandbox = config_prod.clone();
        config_sandbox.itau_mode = ItauMode::Sandbox;
        let state_sandbox = AppState {
            pool: pool.clone(),
            config: config_sandbox,
            message_hub: MessageHub::new(),
            ip_rate_limiter: IpRateLimiter::new(),
        };
        let app_sandbox = create_router(state_sandbox);

        let req = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/credenciais-sandbox")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                json!({
                    "client_id": "sandbox_client_id_test",
                    "client_secret": "sandbox_secret_test"
                })
                .to_string(),
            ))
            .unwrap();
        let resp = app_sandbox.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        // Testar conexão em sandbox
        let req_test = Request::builder()
            .method("POST")
            .uri("/api/v1/tenant/integrations/itau/testar")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin}"))
            .header("X-Tenant-ID", tenant_id.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_test = app_sandbox.clone().oneshot(req_test).await.unwrap();
        assert_eq!(resp_test.status(), StatusCode::OK);
    }

    // 14. Audit logs registrados nos passos
    {
        let count_logs: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND acao LIKE 'itau_%'",
        )
        .bind(tenant_id)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(
            count_logs >= 4,
            "Devem existir logs de auditoria para os passos do assistente (obtido: {count_logs})"
        );
    }

    // Limpeza
    drop_database(&admin, &db_name).await;
}
