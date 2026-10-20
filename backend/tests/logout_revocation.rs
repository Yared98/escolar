use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use escolar_backend::realtime::MessageHub;
use escolar_backend::{
    config::{development_signing_material, AppState, Config},
    handlers::auth::generate_jwt,
    routes::create_router,
};
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
    let _ = sqlx::query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()")
        .bind(name)
        .execute(admin)
        .await;
    let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS {name}"))
        .execute(admin)
        .await;
}

#[tokio::test]
async fn test_logout_revocation_and_session_isolation() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de revogação de logout ignorado.");
        return;
    };

    let db_name = format!("escolar_revocation_{}", Uuid::new_v4().simple());
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

    let result = run_revocation_checks(&test_pool).await;
    test_pool.close().await;
    drop_database(&admin, &db_name).await;
    result.expect("teste de revogação de token no logout");
}

async fn run_revocation_checks(pool: &PgPool) -> Result<(), String> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| format!("migrations: {e}"))?;

    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();

    // Inserir tenant e usuário para passar na consulta de /auth/me
    sqlx::query(
        "INSERT INTO tenants (id, name, slug, status) VALUES ($1, 'Escola Teste', $2, 'active')",
    )
    .bind(tenant_id)
    .bind(format!("slug-{}", Uuid::new_v4().simple()))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'User Teste', 'user@teste.com', 'hash', 'gestor')"
    )
    .bind(user_id)
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
        cora_mode: escolar_backend::config::CoraMode::Mock,
        cora_client_id: None,
        cora_cert_file: None,
        cora_key_file: None,
        cora_base_url: None,

        email_mode: escolar_backend::config::EmailMode::Simulado,
        app_public_url: "http://localhost:3000".to_string(),
        app_secrets_key: None,
        itau_mode: escolar_backend::config::ItauMode::Mock,
        itau_sts_base_url: None,
    };

    let app_state = AppState {
        pool: pool.clone(),
        config,
        message_hub: MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    };

    let app = create_router(app_state);

    let user2_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'User Teste 2', 'user2@teste.com', 'hash', 'gestor')"
    )
    .bind(user2_id)
    .bind(tenant_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Gerar token ativo do Usuário 1 e token ativo do Usuário 2 (ou 2ª sessão de outro usuário)
    let token_1 = generate_jwt(user_id, tenant_id, "gestor", &private_pem)
        .map_err(|e| format!("generate_jwt 1: {e}"))?;
    let token_2 = generate_jwt(user2_id, tenant_id, "gestor", &private_pem)
        .map_err(|e| format!("generate_jwt 2: {e}"))?;

    // 1. Token 1 acessa /auth/me via Header Authorization -> OK (200)
    let req = Request::builder()
        .uri("/api/v1/auth/me")
        .header("Authorization", format!("Bearer {token_1}"))
        .header("X-Tenant-ID", tenant_id.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::OK {
        return Err(format!(
            "Token 1 inicial falhou com status {}",
            res.status()
        ));
    }

    // 2. Token 2 acessa /auth/me via query param access_token -> OK (200)
    let req = Request::builder()
        .uri(format!("/api/v1/auth/me?access_token={token_2}"))
        .header("X-Tenant-ID", tenant_id.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::OK {
        return Err(format!(
            "Token 2 inicial falhou com status {}",
            res.status()
        ));
    }

    // 3. Fazer logout do Token 1
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/logout")
        .header("Authorization", format!("Bearer {token_1}"))
        .header("X-Tenant-ID", tenant_id.to_string())
        .header("Content-Type", "application/json")
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::OK {
        return Err(format!(
            "Logout do Token 1 falhou com status {}",
            res.status()
        ));
    }

    // 4. Token 1 via Header Authorization -> 401
    let req = Request::builder()
        .uri("/api/v1/auth/me")
        .header("Authorization", format!("Bearer {token_1}"))
        .header("X-Tenant-ID", tenant_id.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::UNAUTHORIZED {
        return Err(format!(
            "Token 1 revogado via Header retornou status {}",
            res.status()
        ));
    }

    // 5. Token 1 via query param access_token -> 401
    let req = Request::builder()
        .uri(format!("/api/v1/auth/me?access_token={token_1}"))
        .header("X-Tenant-ID", tenant_id.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::UNAUTHORIZED {
        return Err(format!(
            "Token 1 revogado via query param retornou status {}",
            res.status()
        ));
    }

    // 6. Token 2 continua ativo -> OK (200)
    let req = Request::builder()
        .uri("/api/v1/auth/me")
        .header("Authorization", format!("Bearer {token_2}"))
        .header("X-Tenant-ID", tenant_id.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::OK {
        return Err(format!(
            "Token 2 ativo falhou apos logout do Token 1 com status {}",
            res.status()
        ));
    }

    Ok(())
}
