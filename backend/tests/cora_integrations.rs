use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use escolar_backend::{
    config::{development_signing_material, AppState, Config, CoraMode, EmailMode},
    handlers::auth::generate_jwt,
    realtime::MessageHub,
    routes::create_router,
};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tower::util::ServiceExt;
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

#[tokio::test]
async fn test_get_bank_integrations_returns_modo_gateway() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de cora_integrations ignorado.");
        return;
    };

    let db_name = format!("escolar_cora_{}", Uuid::new_v4().simple());
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

    let result = run_cora_integration_checks(&test_pool).await;
    test_pool.close().await;
    drop_database(&admin, &db_name).await;

    result.expect("teste de integração banking de cora");
}

async fn run_cora_integration_checks(pool: &PgPool) -> Result<(), String> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| format!("migrations: {e}"))?;

    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO tenants (id, name, slug, status) VALUES ($1, 'Escola Teste Cora', $2, 'active')",
    )
    .bind(tenant_id)
    .bind(format!("slug-{}", Uuid::new_v4().simple()))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Gestor Cora', 'gestor@cora.com', 'hash', 'gestor')",
    )
    .bind(user_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO tenant_bank_integrations (tenant_id, gateway_name, client_id, client_secret, webhook_secret, is_active) VALUES ($1, 'cora', 'cora_client_id_123', 'cora_secret_456', 'wh_secret', true)",
    )
    .bind(tenant_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let (private_pem, public_pem, public_x) = development_signing_material();
    let config = Config {
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
        cora_mode: CoraMode::Mock,
        cora_client_id: None,
        cora_cert_file: None,
        cora_key_file: None,
        cora_base_url: None,

        email_mode: EmailMode::Simulado,
        app_public_url: "http://localhost:3000".to_string(),
    };

    let app_state = AppState {
        pool: pool.clone(),
        config,
        message_hub: MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::new(),
    };

    let router = create_router(app_state);

    let token = generate_jwt(user_id, tenant_id, "gestor", &private_pem)
        .map_err(|e| format!("gerar jwt: {e}"))?;

    let req = Request::builder()
        .method("GET")
        .uri("/api/v1/tenant/integrations/banking")
        .header("X-Tenant-ID", tenant_id.to_string())
        .header("Authorization", format!("Bearer {token}"))
        .body(Body::empty())
        .map_err(|e| e.to_string())?;

    let response = router.oneshot(req).await.map_err(|e| e.to_string())?;
    if response.status() != StatusCode::OK {
        return Err(format!(
            "Status esperado 200 OK, recebeu {}",
            response.status()
        ));
    }

    let body_bytes = axum::body::to_bytes(response.into_body(), 1024 * 64)
        .await
        .map_err(|e| format!("ler body: {e}"))?;

    let json_array: Value =
        serde_json::from_slice(&body_bytes).map_err(|e| format!("parse json: {e}"))?;

    let list = json_array
        .as_array()
        .ok_or_else(|| "resposta não é array json".to_string())?;

    let cora_item = list
        .iter()
        .find(|item| item["gateway_name"] == "cora")
        .ok_or_else(|| "item cora não encontrado na lista".to_string())?;

    let modo_gateway = cora_item["modo_gateway"]
        .as_str()
        .ok_or_else(|| "modo_gateway ausente ou não é string".to_string())?;

    if modo_gateway != "mock" {
        return Err(format!(
            "modo_gateway esperado 'mock', recebeu '{modo_gateway}'"
        ));
    }

    Ok(())
}
