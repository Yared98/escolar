use axum::{extract::State, http::StatusCode, response::Json, routing::post, Router};
use chrono::Utc;
use rsa::pkcs1v15::SigningKey;
use rsa::pkcs8::{EncodePrivateKey, LineEnding};
use rsa::rand_core::OsRng;
use rsa::signature::Keypair;
use rsa::RsaPrivateKey;
use serde_json::{json, Value};
use sha2::Sha512;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
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
    middleware::security::IpRateLimiter,
    realtime::MessageHub,
    services::itau_renovacao::executar_ciclo_renovacao,
    services::itau_sts::parse_certificado_validade,
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
    let serial_number = SerialNumber::from(43u32);
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
    fail_renovacao: Arc<Mutex<bool>>,
    renovacao_calls: Arc<Mutex<u32>>,
    ca_signing_key: Arc<SigningKey<Sha512>>,
    ca_name: Name,
    dias_validade: Arc<Mutex<u64>>,
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
    body: String,
) -> (StatusCode, axum::response::Response) {
    use axum::response::IntoResponse;
    *state.renovacao_calls.lock().unwrap() += 1;
    if *state.fail_renovacao.lock().unwrap() {
        return (
            StatusCode::BAD_GATEWAY,
            Json(json!({
                "codigo": "502",
                "mensagem": "Falha simulada no STS do Itaú"
            }))
            .into_response(),
        );
    }

    let dias = *state.dias_validade.lock().unwrap();
    let cert = assinar_csr_teste(&body, &state.ca_signing_key, &state.ca_name, dias);
    (StatusCode::OK, cert.into_response())
}

async fn start_simulator() -> (String, SimulatorState) {
    let mut rng = OsRng;
    let ca_private_key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
    let ca_signing_key = Arc::new(SigningKey::<Sha512>::new(ca_private_key));
    let ca_name = Name::from_str("CN=Simulador Itau STS CA,O=Banco Itau Unibanco SA,C=BR").unwrap();

    let state = SimulatorState {
        fail_renovacao: Arc::new(Mutex::new(false)),
        renovacao_calls: Arc::new(Mutex::new(0)),
        ca_signing_key,
        ca_name,
        dias_validade: Arc::new(Mutex::new(365)),
    };

    let app = Router::new()
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
async fn test_itau_renovacao_ciclo_completo() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste itau_renovacao ignorado.");
        return;
    };

    let (sim_url, sim_state) = start_simulator().await;

    let db_name = format!("escolar_itau_renov_{}", Uuid::new_v4().simple());
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

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola Itaú Renovacao', $2)")
        .bind(tenant_id)
        .bind(format!("escola-itau-renov-{}", &tenant_id.to_string()[..8]))
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

    let (priv_key_pem, pub_key_pem, pub_x) = development_signing_material();
    let chave_mestra = ChaveMestra::from_hex(TEST_SECRETS_HEX).unwrap();

    let config_prod = Config {
        itau_renovacao_automatica: true,
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
        app_secrets_key: Some(chave_mestra.clone()),
        itau_mode: ItauMode::Production,
        itau_sts_base_url: Some(sim_url.clone()),
    };

    let state_prod = AppState {
        pool: pool.clone(),
        config: config_prod.clone(),
        message_hub: MessageHub::new(),
        ip_rate_limiter: IpRateLimiter::new(),
    };

    // 1. Inserir configuração do Itaú com ativo = true
    sqlx::query(
        r#"
        INSERT INTO tenant_itau_config (
            tenant_id, agencia, conta, dac, id_beneficiario, chave_pix, ativo
        ) VALUES ($1, '0057', '1234567', '8', '005712345678', 'escola@exemplo.com.br', true)
        "#,
    )
    .bind(tenant_id)
    .execute(&pool)
    .await
    .unwrap();

    // 2. Cenário: Fora da janela (faltam 200 dias) -> não chama o simulador
    let (cert_200, key_200) = gerar_certificado_teste("client_200", 200);
    {
        let mut conn = pool.acquire().await.unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::Cert,
            cert_200.as_bytes(),
            None,
        )
        .await
        .unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
            key_200.as_bytes(),
            None,
        )
        .await
        .unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::ClientId,
            b"client_id_teste_123",
            None,
        )
        .await
        .unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::ClientSecret,
            b"client_secret_teste_456",
            None,
        )
        .await
        .unwrap();
    }

    executar_ciclo_renovacao(&state_prod).await.unwrap();
    assert_eq!(
        *sim_state.renovacao_calls.lock().unwrap(),
        0,
        "não deve chamar STS quando faltam 200 dias"
    );

    // 3. Cenário: Fora da janela (falta < 1 dia, ex: 0 dias) -> não chama o simulador
    let (cert_0, key_0) = gerar_certificado_teste("client_0", 0);
    {
        let mut conn = pool.acquire().await.unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::Cert,
            cert_0.as_bytes(),
            None,
        )
        .await
        .unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
            key_0.as_bytes(),
            None,
        )
        .await
        .unwrap();
    }

    executar_ciclo_renovacao(&state_prod).await.unwrap();
    assert_eq!(
        *sim_state.renovacao_calls.lock().unwrap(),
        0,
        "não deve chamar STS quando falta < 1 dia"
    );

    // 4. Cenário: Flag desligada -> nada acontece
    let mut config_desligada = config_prod.clone();
    config_desligada.itau_renovacao_automatica = false;
    let state_desligada = AppState {
        pool: pool.clone(),
        config: config_desligada,
        message_hub: MessageHub::new(),
        ip_rate_limiter: IpRateLimiter::new(),
    };
    let (cert_15, key_15) = gerar_certificado_teste("client_15", 15);
    {
        let mut conn = pool.acquire().await.unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::Cert,
            cert_15.as_bytes(),
            None,
        )
        .await
        .unwrap();
        secrets::salvar(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
            key_15.as_bytes(),
            None,
        )
        .await
        .unwrap();
    }

    executar_ciclo_renovacao(&state_desligada).await.unwrap();
    assert_eq!(
        *sim_state.renovacao_calls.lock().unwrap(),
        0,
        "não deve chamar STS com flag desligada"
    );

    // 5. Cenário: Modo ≠ Production (ex: Mock) -> nada acontece
    let mut config_mock = config_prod.clone();
    config_mock.itau_mode = ItauMode::Mock;
    let state_mock = AppState {
        pool: pool.clone(),
        config: config_mock,
        message_hub: MessageHub::new(),
        ip_rate_limiter: IpRateLimiter::new(),
    };
    executar_ciclo_renovacao(&state_mock).await.unwrap();
    assert_eq!(
        *sim_state.renovacao_calls.lock().unwrap(),
        0,
        "não deve chamar STS em modo Mock"
    );
    // 6. Cenário: Simulador falha -> certificado antigo continua, erro gravado, uma notificação por usuário da gestão
    *sim_state.fail_renovacao.lock().unwrap() = true;
    executar_ciclo_renovacao(&state_prod).await.unwrap();
    assert_eq!(
        *sim_state.renovacao_calls.lock().unwrap(),
        1,
        "chamou simulador que falhou"
    );

    // Verifica que o certificado antigo continua
    {
        let mut conn = pool.acquire().await.unwrap();
        let cert_atual = secrets::ler(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::Cert,
        )
        .await
        .unwrap()
        .unwrap();
        assert_eq!(
            String::from_utf8(cert_atual).unwrap().trim(),
            cert_15.trim(),
            "certificado antigo mantido"
        );
    }

    // Verifica erro gravado e tentativa gravada no banco
    let (ultimo_erro, ultima_tentativa, alerta_enviado_em): (Option<String>, Option<chrono::DateTime<Utc>>, Option<chrono::DateTime<Utc>>) =
        sqlx::query_as("SELECT renovacao_ultimo_erro, renovacao_ultima_tentativa_em, renovacao_alerta_enviado_em FROM tenant_itau_config WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert!(
        ultimo_erro.is_some(),
        "renovacao_ultimo_erro deve estar preenchido"
    );
    assert!(
        ultima_tentativa.is_some(),
        "renovacao_ultima_tentativa_em deve estar preenchida"
    );
    assert!(
        alerta_enviado_em.is_some(),
        "renovacao_alerta_enviado_em deve estar preenchida"
    );

    // Verifica notificações geradas para a gestão (admin e gestor = 2 usuários)
    let notificacoes_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notificacoes_sistema WHERE tenant_id = $1 AND titulo = 'Renovação do certificado do Itaú falhou'",
    )
    .bind(tenant_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        notificacoes_count, 2,
        "deve gerar 1 notificação para cada usuário da gestão"
    );

    // Segunda execução no mesmo dia não duplica notificação
    executar_ciclo_renovacao(&state_prod).await.unwrap();
    let notificacoes_count_2: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notificacoes_sistema WHERE tenant_id = $1 AND titulo = 'Renovação do certificado do Itaú falhou'",
    )
    .bind(tenant_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        notificacoes_count_2, 2,
        "segunda execução não deve duplicar notificações"
    );

    // 7. Cenário: Dentro da janela (1 dia < faltam <= 30 dias) -> renova, nova validade gravada, audit ok
    *sim_state.fail_renovacao.lock().unwrap() = false;
    let chamadas_antes = *sim_state.renovacao_calls.lock().unwrap();

    executar_ciclo_renovacao(&state_prod).await.unwrap();
    assert_eq!(
        *sim_state.renovacao_calls.lock().unwrap(),
        chamadas_antes + 1,
        "STS deve ser chamado"
    );

    // Certificado renovado no banco
    let cert_renovado_bytes = {
        let mut conn = pool.acquire().await.unwrap();
        secrets::ler(
            &mut conn,
            &chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::Cert,
        )
        .await
        .unwrap()
        .unwrap()
    };
    let (err, _): (Option<String>, Option<chrono::DateTime<chrono::Utc>>) = sqlx::query_as("SELECT renovacao_ultimo_erro, renovacao_ultima_tentativa_em FROM tenant_itau_config WHERE tenant_id = $1").bind(tenant_id).fetch_one(&pool).await.unwrap();
    eprintln!("ERRO STEP 7: {:?}", err);
    let cert_renovado_pem = String::from_utf8(cert_renovado_bytes).unwrap();
    assert_ne!(
        cert_renovado_pem.trim(),
        cert_15.trim(),
        "certificado deve ser novo"
    );
    let validade_renovada = parse_certificado_validade(&cert_renovado_pem).unwrap();
    assert!(
        (validade_renovada - Utc::now()).num_days() > 300,
        "novo certificado tem validade de ~365 dias"
    );

    // Verifica que renovacao_ultimo_erro foi limpo
    let (ultimo_erro_depois, ultima_tentativa_depois): (Option<String>, Option<chrono::DateTime<Utc>>) =
        sqlx::query_as("SELECT renovacao_ultimo_erro, renovacao_ultima_tentativa_em FROM tenant_itau_config WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert!(
        ultimo_erro_depois.is_none(),
        "renovacao_ultimo_erro deve ser limpo no sucesso"
    );
    assert!(
        ultima_tentativa_depois.is_some(),
        "renovacao_ultima_tentativa_em deve ser atualizada"
    );

    // Audit log gravado com ok
    let audit_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND acao = 'itau_renovacao_automatica' AND detalhes_json->>'resultado' = 'ok'",
    )
    .bind(tenant_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audit_count, 1, "audit_log com resultado ok deve existir");

    drop_database(&admin, &db_name).await;
}
