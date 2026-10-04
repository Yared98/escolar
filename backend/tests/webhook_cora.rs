use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use escolar_backend::{
    config::{development_signing_material, AppState, Config},
    routes::create_router,
};
use hmac::{Hmac, Mac};
use serde_json::json;
use sha2::Sha256;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

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
    let _ = sqlx::query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()")
        .bind(name)
        .execute(admin)
        .await;
    let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS {name}"))
        .execute(admin)
        .await;
}

fn compute_hmac_hex(secret: &str, body: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("hmac key length");
    mac.update(body);
    hex::encode(mac.finalize().into_bytes())
}

fn compute_hmac_t_v1(secret: &str, timestamp: i64, body: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("hmac key length");
    mac.update(timestamp.to_string().as_bytes());
    mac.update(b".");
    mac.update(body);
    let sig_hex = hex::encode(mac.finalize().into_bytes());
    format!("t={timestamp},v1={sig_hex}")
}

#[tokio::test]
async fn test_webhook_cora_security_idempotency_and_value_check() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de webhook_cora ignorado.");
        return;
    };

    let db_name = format!("escolar_whcora_{}", Uuid::new_v4().simple());
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

    sqlx::migrate!("./migrations")
        .run(&test_pool)
        .await
        .expect("migrations");

    let tenant_id = Uuid::new_v4();
    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Tenant Webhook Test', $2)")
        .bind(tenant_id)
        .bind(format!("tenant-wh-{}", Uuid::new_v4().simple()))
        .execute(&test_pool)
        .await
        .expect("insert tenant");

    let webhook_secret = "cora_secret_test_key_12345";
    sqlx::query(
        "INSERT INTO tenant_bank_integrations (id, tenant_id, gateway_name, client_id, client_secret, webhook_secret, is_active) VALUES ($1, $2, 'cora', 'client_id_123', 'client_sec', $3, true)"
    )
    .bind(Uuid::new_v4())
    .bind(tenant_id)
    .bind(webhook_secret)
    .execute(&test_pool)
    .await
    .expect("insert bank integration");

    let aluno_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO alunos (id, tenant_id, nome, cpf, data_nascimento, nome_responsavel, email_responsavel, telefone_responsavel) VALUES ($1, $2, 'Aluno Cora Test', '11122233344', '2015-05-05', 'Resp Test', 'resp@test.com', '11999999999')"
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .execute(&test_pool)
    .await
    .expect("insert aluno");

    let fatura1_id = Uuid::new_v4();
    let cora_inv1_id = "cora_inv_001";
    sqlx::query(
        "INSERT INTO faturas (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, gateway_invoice_id) VALUES ($1, $2, $3, 'Fatura Mensal 1', 150.0, CURRENT_DATE, 'pendente', 'cora', $4)"
    )
    .bind(fatura1_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .bind(cora_inv1_id)
    .execute(&test_pool)
    .await
    .expect("insert fatura 1");

    let fatura2_id = Uuid::new_v4();
    let cora_inv2_id = "cora_inv_002";
    sqlx::query(
        "INSERT INTO faturas (id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name, gateway_invoice_id) VALUES ($1, $2, $3, 'Fatura Mensal 2', 200.0, CURRENT_DATE, 'pendente', 'cora', $4)"
    )
    .bind(fatura2_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .bind(cora_inv2_id)
    .execute(&test_pool)
    .await
    .expect("insert fatura 2");

    let (pem, pub_pem, pub_x) = development_signing_material();
    let mut config = Config::default();
    config.jwt_private_pem = pem;
    config.jwt_public_pem = pub_pem;
    config.jwt_public_x = pub_x;

    let app = create_router(AppState {
        pool: test_pool.clone(),
        config,
        message_hub: escolar_backend::realtime::MessageHub::default(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::new(),
    });

    // 1. Assinatura inválida -> 401 Unauthorized
    let payload1 = json!({
        "event_id": "evt_test_001",
        "type": "invoice.paid",
        "data": {
            "invoice": {
                "id": cora_inv1_id,
                "status": "paid",
                "amount": 150.0
            }
        }
    });
    let body_bytes1 = serde_json::to_vec(&payload1).unwrap();

    let req_invalid_sig = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/webhooks/cora/{tenant_id}"))
        .header("content-type", "application/json")
        .header("Cora-Signature", "invalid_signature_hex_123456")
        .body(Body::from(body_bytes1.clone()))
        .unwrap();

    let resp = app.clone().oneshot(req_invalid_sig).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

    // 2. Assinatura válida -> 200 OK e fatura baixada
    let valid_sig1 = compute_hmac_hex(webhook_secret, &body_bytes1);
    let req_valid1 = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/webhooks/cora/{tenant_id}"))
        .header("content-type", "application/json")
        .header("Cora-Signature", &valid_sig1)
        .body(Body::from(body_bytes1.clone()))
        .unwrap();

    let resp = app.clone().oneshot(req_valid1).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let fatura1_status: (String,) = sqlx::query_as("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura1_id)
        .fetch_one(&test_pool)
        .await
        .unwrap();
    assert_eq!(fatura1_status.0, "pago");

    // 2b. Duplicado (anti-replay) -> 200 OK sem alterar a fatura duas vezes
    let req_duplicate = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/webhooks/cora/{tenant_id}"))
        .header("content-type", "application/json")
        .header("Cora-Signature", &valid_sig1)
        .body(Body::from(body_bytes1.clone()))
        .unwrap();

    let resp = app.clone().oneshot(req_duplicate).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let event_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM webhook_events WHERE tenant_id = $1 AND event_id = 'evt_test_001'",
    )
    .bind(tenant_id)
    .fetch_one(&test_pool)
    .await
    .unwrap();
    assert_eq!(
        event_count.0, 1,
        "Evento deve ser inserido apenas uma vez no webhook_events"
    );

    // 3. Timestamp velho com CORA_WEBHOOK_SIGNATURE_FORMAT=t_v1 -> 401 Unauthorized
    std::env::set_var("CORA_WEBHOOK_SIGNATURE_FORMAT", "t_v1");
    let old_ts = chrono::Utc::now().timestamp() - 600;
    let payload_ts = json!({
        "event_id": "evt_test_old_ts",
        "type": "invoice.paid",
        "data": {
            "invoice": {
                "id": cora_inv1_id,
                "status": "paid",
                "amount": 150.0
            }
        }
    });
    let body_bytes_ts = serde_json::to_vec(&payload_ts).unwrap();
    let header_old_ts = compute_hmac_t_v1(webhook_secret, old_ts, &body_bytes_ts);

    let req_old_ts = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/webhooks/cora/{tenant_id}"))
        .header("content-type", "application/json")
        .header("Cora-Signature", &header_old_ts)
        .body(Body::from(body_bytes_ts))
        .unwrap();

    let resp = app.clone().oneshot(req_old_ts).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    std::env::remove_var("CORA_WEBHOOK_SIGNATURE_FORMAT");

    // 4. Valor divergente -> não baixa fatura e grava em audit_logs
    let payload_divergent = json!({
        "event_id": "evt_test_divergent",
        "type": "invoice.paid",
        "data": {
            "invoice": {
                "id": cora_inv2_id,
                "status": "paid",
                "amount": 50.0
            }
        }
    });
    let body_bytes_div = serde_json::to_vec(&payload_divergent).unwrap();
    let valid_sig_div = compute_hmac_hex(webhook_secret, &body_bytes_div);

    let req_divergent = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/webhooks/cora/{tenant_id}"))
        .header("content-type", "application/json")
        .header("Cora-Signature", &valid_sig_div)
        .body(Body::from(body_bytes_div))
        .unwrap();

    let resp = app.clone().oneshot(req_divergent).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let fatura2_status: (String,) = sqlx::query_as("SELECT status FROM faturas WHERE id = $1")
        .bind(fatura2_id)
        .fetch_one(&test_pool)
        .await
        .unwrap();
    assert_eq!(
        fatura2_status.0, "pendente",
        "Fatura com valor divergente nao deve ser baixada"
    );

    let audit_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM audit_logs WHERE tenant_id = $1 AND acao = 'webhook_valor_divergente' AND entidade_id = $2"
    )
    .bind(tenant_id)
    .bind(fatura2_id.to_string())
    .fetch_one(&test_pool)
    .await
    .unwrap();
    assert_eq!(
        audit_count.0, 1,
        "Deve registrar auditoria de valor divergente em audit_logs"
    );

    test_pool.close().await;
    drop_database(&admin, &db_name).await;
}
