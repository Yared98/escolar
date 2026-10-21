use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use escolar_backend::{
    config::{development_signing_material, AppState, Config},
    routes::create_router,
};
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

fn app_state(pool: PgPool) -> AppState {
    let (private_pem, public_pem, public_x) = development_signing_material();
    AppState {
        pool,
        config: Config {
            database_url: String::new(),
            jwt_private_pem: private_pem,
            jwt_public_pem: public_pem,
            jwt_public_x: public_x,
            port: 8000,
            allowed_origins: "http://localhost:3000".into(),
            environment: "test".into(),
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

            itau_renovacao_automatica: false,
            itau_mode: escolar_backend::config::ItauMode::Mock,
            itau_sts_base_url: None,
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    }
}

fn argon2_hash(password: &str) -> String {
    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
        Argon2,
    };
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .unwrap()
        .to_string()
}

async fn json_body(res: axum::response::Response) -> serde_json::Value {
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    serde_json::from_slice(&bytes).unwrap_or_else(|_| serde_json::Value::Null)
}

#[tokio::test]
async fn gestao_usuarios_e_rbac() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de usuários ignorado.");
        return;
    };

    let db_name = format!("escolar_usuarios_{}", Uuid::new_v4().simple());
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
        .max_connections(4)
        .connect(&database_url_for(&admin_url, &db_name))
        .await
        .expect("conexão do database de teste");

    let result = run_checks(&pool).await;
    pool.close().await;
    drop_database(&admin, &db_name).await;
    result.expect("testes de gestão de usuários e RBAC");
}

async fn run_checks(pool: &PgPool) -> Result<(), String> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| format!("migrations: {e}"))?;

    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();
    let gestor_a = Uuid::new_v4();
    let professor_a = Uuid::new_v4();
    let gestor_b = Uuid::new_v4();
    let senha_gestor = "SenhaGestor2026!";
    let senha_gestor_hash = argon2_hash(senha_gestor);

    sqlx::query(
        "INSERT INTO tenants (id, name, slug, status) VALUES ($1, 'Escola A', $2, 'active'), ($3, 'Escola B', $4, 'active')"
    )
    .bind(tenant_a)
    .bind(format!("escola-a-{}", &tenant_a.to_string()[..8]))
    .bind(tenant_b)
    .bind(format!("escola-b-{}", &tenant_b.to_string()[..8]))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role, ativo, deve_trocar_senha) VALUES ($1, $2, 'Gestor A', $3, $4, 'gestor', true, false)"
    )
    .bind(gestor_a)
    .bind(tenant_a)
    .bind(format!("gestor-{}", &gestor_a.to_string()[..8]))
    .bind(&senha_gestor_hash)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role, ativo, deve_trocar_senha) VALUES ($1, $2, 'Gestor B', $3, $4, 'gestor', true, false)"
    )
    .bind(gestor_b)
    .bind(tenant_b)
    .bind(format!("gestor-b-{}", &gestor_b.to_string()[..8]))
    .bind(&senha_gestor_hash)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let app = create_router(app_state(pool.clone()));

    // 1. Login do gestor A
    let gestor_email = format!("gestor-{}", &gestor_a.to_string()[..8]);
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "tenant_slug": format!("escola-a-{}", &tenant_a.to_string()[..8]),
                "email": gestor_email,
                "password": senha_gestor
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::OK {
        return Err(format!("login gestor A retornou {}", res.status()));
    }
    let login_body = json_body(res).await;
    let token_gestor = login_body["token"]
        .as_str()
        .ok_or("token ausente no login")?
        .to_string();

    // 2. Gestor A cria professor
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/administrativo/usuarios")
        .header("Authorization", format!("Bearer {token_gestor}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "nome": "Professor A",
                "email": format!("prof-{}", &professor_a.to_string()[..8]),
                "perfil": "professor"
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::OK {
        return Err(format!("criação professor retornou {}", res.status()));
    }
    let criado = json_body(res).await;
    let senha_professor = criado["senha_temporaria"]
        .as_str()
        .ok_or("senha temporária ausente")?
        .to_string();

    // 3. Professor faz login
    let prof_email = format!("prof-{}", &professor_a.to_string()[..8]);
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "tenant_slug": format!("escola-a-{}", &tenant_a.to_string()[..8]),
                "email": prof_email,
                "password": senha_professor
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::OK {
        return Err(format!("login professor retornou {}", res.status()));
    }
    let prof_login = json_body(res).await;
    let token_professor = prof_login["token"]
        .as_str()
        .ok_or("token professor ausente")?
        .to_string();
    let refresh_professor = prof_login["refresh_token"]
        .as_str()
        .ok_or("refresh token professor ausente")?
        .to_string();
    if prof_login["user"]["deve_trocar_senha"].as_bool() != Some(true) {
        return Err("usuário criado deveria ter deve_trocar_senha=true".to_string());
    }

    // 4. Professor não acessa /administrativo/usuarios
    let req = Request::builder()
        .uri("/api/v1/administrativo/usuarios")
        .header("Authorization", format!("Bearer {token_professor}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::FORBIDDEN {
        return Err(format!(
            "professor acessou usuários com status {}",
            res.status()
        ));
    }

    // 5. Isolamento entre tenants: gestor B logado no tenant B não acessa dados do tenant A
    let gestor_b_email = format!("gestor-b-{}", &gestor_b.to_string()[..8]);
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "tenant_slug": format!("escola-b-{}", &tenant_b.to_string()[..8]),
                "email": gestor_b_email,
                "password": senha_gestor
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::OK {
        return Err(format!("login gestor B retornou {}", res.status()));
    }
    let login_b = json_body(res).await;
    let token_gestor_b = login_b["token"]
        .as_str()
        .ok_or("token gestor B ausente")?
        .to_string();

    let req = Request::builder()
        .uri("/api/v1/administrativo/usuarios")
        .header("Authorization", format!("Bearer {token_gestor_b}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .body(Body::empty())
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::UNAUTHORIZED && res.status() != StatusCode::FORBIDDEN {
        return Err(format!(
            "gestor B no tenant A deveria ser bloqueado, retornou {}",
            res.status()
        ));
    }

    // 6. Gestor A desativa professor
    let req = Request::builder()
        .method("PUT")
        .uri(format!(
            "/api/v1/administrativo/usuarios/{}",
            criado["id"].as_str().unwrap_or("")
        ))
        .header("Authorization", format!("Bearer {token_gestor}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::json!({"ativo": false}).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::OK {
        return Err(format!("desativação professor retornou {}", res.status()));
    }

    // 7. Professor desativado não loga
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::json!({
                "tenant_slug": format!("escola-a-{}", &tenant_a.to_string()[..8]),
                "email": prof_email,
                "password": senha_professor
            })
            .to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::UNAUTHORIZED {
        return Err(format!(
            "login professor desativado retornou {}",
            res.status()
        ));
    }

    // 7b. A sessão aberta antes da desativação não renova mais (refresh token revogado)
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/refresh")
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::json!({ "refresh_token": refresh_professor }).to_string(),
        ))
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::UNAUTHORIZED {
        return Err(format!(
            "refresh do professor desativado deveria falhar, retornou {}",
            res.status()
        ));
    }

    // 8. Regra do último gestor ativo: tentar desativar a si mesmo deve falhar
    let req = Request::builder()
        .method("PUT")
        .uri(format!("/api/v1/administrativo/usuarios/{}", gestor_a))
        .header("Authorization", format!("Bearer {token_gestor}"))
        .header("X-Tenant-ID", tenant_a.to_string())
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::json!({"ativo": false}).to_string()))
        .unwrap();
    let res = app.clone().oneshot(req).await.map_err(|e| e.to_string())?;
    if res.status() != StatusCode::BAD_REQUEST {
        return Err(format!("auto-desativação gestor retornou {}", res.status()));
    }

    Ok(())
}
