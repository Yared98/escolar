use argon2::PasswordHasher;
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use escolar_backend::{
    config::{development_signing_material, AppState, Config},
    routes::create_router,
};
use serde_json::json;
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
    let _ = sqlx::query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()")
        .bind(name)
        .execute(admin)
        .await;
    let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS {name}"))
        .execute(admin)
        .await;
}

#[tokio::test]
async fn test_login_account_lock_and_throttle() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de login_throttle ignorado.");
        return;
    };

    let db_name = format!("escolar_throttle_{}", Uuid::new_v4().simple());
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

    let result = run_throttle_checks(&test_pool).await;
    test_pool.close().await;
    drop_database(&admin, &db_name).await;
    result.expect("teste de bloqueio e throttle no login");
}

async fn run_throttle_checks(pool: &PgPool) -> Result<(), String> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| format!("migrations: {e}"))?;

    let (pem, pub_pem, pub_x) = development_signing_material();
    let mut config = Config::default();
    config.jwt_private_pem = pem;
    config.jwt_public_pem = pub_pem;
    config.jwt_public_x = pub_x;
    config.account_lock_max_attempts = 5;
    config.account_lock_window_minutes = 15;
    config.rate_limit_public_rpm = 50;

    let app_state = AppState {
        pool: pool.clone(),
        config,
        message_hub: escolar_backend::realtime::MessageHub::default(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::new(),
    };

    let tenant_id = Uuid::new_v4();
    let slug = format!("escola-lock-{}", &tenant_id.to_string()[..8]);

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Escola Lock Test', $2)")
        .bind(tenant_id)
        .bind(&slug)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    // Insere usuário para teste de bloqueio
    let user_id = Uuid::new_v4();
    let email = "bloqueio@escola.test";

    // Hash Argon2 de "SenhaFort3!"
    let salt =
        argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
    let pass_hash = argon2::Argon2::default()
        .hash_password(b"SenhaFort3!", &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'User Lock', $3, $4, 'gestor')",
    )
    .bind(user_id)
    .bind(tenant_id)
    .bind(email)
    .bind(&pass_hash)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let app = create_router(app_state);

    // 1. Resposta idêntica para e-mail inexistente e senha errada (sem enumeração)
    let body_inexistente = json!({
        "tenant_slug": slug,
        "email": "naoexiste@escola.test",
        "password": "wrongpassword"
    });
    let req1 = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body_inexistente).unwrap()))
        .unwrap();

    let res1 = app.clone().oneshot(req1).await.map_err(|e| e.to_string())?;
    if res1.status() != StatusCode::UNAUTHORIZED {
        return Err(format!(
            "Esperado 401 para e-mail inexistente, obtido {}",
            res1.status()
        ));
    }
    let body_bytes1 = axum::body::to_bytes(res1.into_body(), 1024).await.unwrap();
    let json1: serde_json::Value = serde_json::from_slice(&body_bytes1).unwrap();

    let body_senha_errada = json!({
        "tenant_slug": slug,
        "email": email,
        "password": "wrongpassword"
    });
    let req2 = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body_senha_errada).unwrap()))
        .unwrap();

    let res2 = app.clone().oneshot(req2).await.map_err(|e| e.to_string())?;
    if res2.status() != StatusCode::UNAUTHORIZED {
        return Err(format!(
            "Esperado 401 para senha errada, obtido {}",
            res2.status()
        ));
    }
    let body_bytes2 = axum::body::to_bytes(res2.into_body(), 1024).await.unwrap();
    let json2: serde_json::Value = serde_json::from_slice(&body_bytes2).unwrap();

    if json1 != json2 {
        return Err(format!("Respostas de e-mail inexistente ({json1:?}) e senha errada ({json2:?}) devem ser IDÊNTICAS!"));
    }

    // 2. Simular 5 tentativas com falha para o mesmo e-mail (já fizemos 1 no teste acima)
    for i in 2..=5 {
        let req_fail = Request::builder()
            .method("POST")
            .uri("/api/v1/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&body_senha_errada).unwrap()))
            .unwrap();

        let res_fail = app
            .clone()
            .oneshot(req_fail)
            .await
            .map_err(|e| e.to_string())?;
        if res_fail.status() != StatusCode::UNAUTHORIZED {
            return Err(format!(
                "Tentativa {i} esperava 401, obtido {}",
                res_fail.status()
            ));
        }
    }

    // 6ª tentativa para o mesmo e-mail (mesmo com a senha CORRETA) deve retornar 429 sem validar
    let body_senha_correta = json!({
        "tenant_slug": slug,
        "email": email,
        "password": "SenhaFort3!"
    });
    let req6 = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body_senha_correta).unwrap()))
        .unwrap();

    let res6 = app.clone().oneshot(req6).await.map_err(|e| e.to_string())?;
    if res6.status() != StatusCode::TOO_MANY_REQUESTS {
        return Err(format!(
            "6ª tentativa esperava 429 (TOO_MANY_REQUESTS), obtido {}",
            res6.status()
        ));
    }

    // 3. Login correto zera o contador
    let user2_id = Uuid::new_v4();
    let email2 = "reset@escola.test";
    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'User Reset', $3, $4, 'gestor')",
    )
    .bind(user2_id)
    .bind(tenant_id)
    .bind(email2)
    .bind(&pass_hash)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let body_user2_errada = json!({
        "tenant_slug": slug,
        "email": email2,
        "password": "wrongpassword"
    });

    // 2 tentativas incorretas
    for _ in 0..2 {
        let req_err = Request::builder()
            .method("POST")
            .uri("/api/v1/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&body_user2_errada).unwrap()))
            .unwrap();
        let _ = app
            .clone()
            .oneshot(req_err)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Login bem-sucedido
    let body_user2_correta = json!({
        "tenant_slug": slug,
        "email": email2,
        "password": "SenhaFort3!"
    });
    let req_ok = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body_user2_correta).unwrap()))
        .unwrap();

    let res_ok = app
        .clone()
        .oneshot(req_ok)
        .await
        .map_err(|e| e.to_string())?;
    if res_ok.status() != StatusCode::OK {
        return Err(format!(
            "Esperado 200 OK para login correto, obtido {}",
            res_ok.status()
        ));
    }

    // Verificar se falhas foram zeradas no banco para o email2
    let failed_count2: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM login_attempts WHERE tenant_id = $1 AND email = $2 AND success = false",
    )
    .bind(tenant_id)
    .bind(email2)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    if failed_count2 != 0 {
        return Err(format!(
            "Login bem-sucedido deveria zerar as falhas; restam {failed_count2}"
        ));
    }

    Ok(())
}
