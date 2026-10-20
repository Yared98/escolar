use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use axum::Router;
use escolar_backend::config::{development_signing_material, AppState, Config};
use escolar_backend::routes::create_router;
use serde_json::{json, Value};
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

async fn setup_pool() -> Option<(PgPool, String, PgPool)> {
    let admin_url = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())?;

    let db_name = format!("escolar_sessao_cookie_{}", Uuid::new_v4().simple());
    let admin = match PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&admin_url)
        .await
    {
        Ok(pool) => pool,
        Err(e) => {
            eprintln!("Não foi possível conectar ao Postgres de teste ({e}); teste ignorado.");
            return None;
        }
    };

    if let Err(e) = sqlx::query(&format!("CREATE DATABASE {db_name}"))
        .execute(&admin)
        .await
    {
        eprintln!("Falha ao criar database de teste ({e}); teste ignorado.");
        return None;
    }

    let pool = match PgPoolOptions::new()
        .max_connections(4)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&database_url_for(&admin_url, &db_name))
        .await
    {
        Ok(pool) => pool,
        Err(e) => {
            eprintln!("Falha ao conectar no database de teste ({e}); teste ignorado.");
            let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS {db_name}"))
                .execute(&admin)
                .await;
            return None;
        }
    };

    if let Err(e) = sqlx::migrate!("./migrations").run(&pool).await {
        eprintln!("Falha ao rodar migrations de teste ({e}); teste ignorado.");
        let _ = sqlx::query(&format!("DROP DATABASE IF EXISTS {db_name}"))
            .execute(&admin)
            .await;
        return None;
    }

    Some((admin, db_name, pool))
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
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    }
}

fn auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

fn hash_senha(senha: &str) -> String {
    use argon2::password_hash::{rand_core::OsRng, PasswordHasher, SaltString};
    argon2::Argon2::default()
        .hash_password(senha.as_bytes(), &SaltString::generate(&mut OsRng))
        .unwrap()
        .to_string()
}

struct Resposta {
    status: StatusCode,
    set_cookies: Vec<String>,
    corpo: Value,
}

async fn enviar(app: &Router, req: Request<Body>) -> Resposta {
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let set_cookies = res
        .headers()
        .get_all("set-cookie")
        .iter()
        .map(|v| v.to_str().unwrap().to_string())
        .collect();
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let corpo = serde_json::from_slice(&bytes).unwrap_or(json!({}));
    Resposta {
        status,
        set_cookies,
        corpo,
    }
}

fn post(uri: &str) -> axum::http::request::Builder {
    Request::builder()
        .method(Method::POST)
        .uri(uri)
        .header("Content-Type", "application/json")
}

/// Valor do cookie de refresh numa lista de Set-Cookie.
fn refresh_do_set_cookie(cookies: &[String]) -> String {
    cookies
        .iter()
        .find_map(|c| c.strip_prefix("escolar_refresh="))
        .and_then(|resto| resto.split(';').next())
        .unwrap_or("")
        .to_string()
}

fn renovar_com_cookie(refresh: &str, extras: &[(&str, &str)]) -> Request<Body> {
    let mut b = post("/api/v1/auth/refresh")
        .header("x-auth-mode", "cookie")
        .header("cookie", format!("escolar_refresh={refresh}"));
    for (k, v) in extras {
        b = b.header(*k, *v);
    }
    b.body(Body::empty()).unwrap()
}

/// Sessão do navegador: refresh token em cookie HttpOnly, rotação, proteção contra outro site,
/// logout que apaga o cookie, e o modo antigo (corpo) intacto para quem não é navegador.
#[tokio::test]
async fn sessao_em_cookie_httponly_com_rotacao_e_protecao_de_origem() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        return;
    };

    let tenant = Uuid::new_v4();
    let slug = format!("escola-{}", tenant.simple());
    sqlx::query("INSERT INTO tenants (id, name, slug, status) VALUES ($1, 'Escola', $2, 'active')")
        .bind(tenant)
        .bind(&slug)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Gestor', 'gestor@escola.test', $3, 'gestor')",
    )
    .bind(Uuid::new_v4())
    .bind(tenant)
    .bind(hash_senha("SenhaSegura2026!"))
    .execute(&pool)
    .await
    .unwrap();

    let app = create_router(app_state(pool.clone()));
    let login_corpo =
        json!({"tenant_slug": slug, "email": "gestor@escola.test", "password": "SenhaSegura2026!"});
    let login = |extras: &[(&str, &str)]| {
        let mut b = post("/api/v1/auth/login");
        for (k, v) in extras {
            b = b.header(*k, *v);
        }
        b.body(Body::from(login_corpo.to_string())).unwrap()
    };

    // 1. Login em modo cookie: sem refresh_token no corpo, cookie HttpOnly/SameSite=Strict.
    let r = enviar(&app, login(&[("x-auth-mode", "cookie")])).await;
    assert_eq!(r.status, StatusCode::OK);
    assert!(
        r.corpo.get("refresh_token").is_none(),
        "refresh não pode ir no corpo: {}",
        r.corpo
    );
    assert!(r.corpo["token"].as_str().is_some());
    assert_eq!(r.set_cookies.len(), 1);
    let cookie = &r.set_cookies[0];
    for esperado in [
        "HttpOnly",
        "SameSite=Strict",
        "Path=/api/v1/auth",
        "Max-Age=604800",
    ] {
        assert!(cookie.contains(esperado), "faltou {esperado} em {cookie}");
    }
    assert!(
        !cookie.contains("Secure"),
        "ambiente de teste não é produção"
    );
    let refresh1 = refresh_do_set_cookie(&r.set_cookies);
    assert!(refresh1.len() > 20);

    // 2. Login de outra origem em modo cookie é recusado e não grava cookie.
    let r = enviar(
        &app,
        login(&[
            ("x-auth-mode", "cookie"),
            ("origin", "https://malicioso.example"),
        ]),
    )
    .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
    assert!(r.set_cookies.is_empty());

    // 3. Sem o cabeçalho do modo cookie o cookie é ignorado (corpo vazio = 400).
    let sem_cabecalho = post("/api/v1/auth/refresh")
        .header("cookie", format!("escolar_refresh={refresh1}"))
        .body(Body::empty())
        .unwrap();
    assert_eq!(
        enviar(&app, sem_cabecalho).await.status,
        StatusCode::BAD_REQUEST
    );

    // 4. Renovação a partir de outro site é recusada (e não gasta o refresh token).
    let r = enviar(
        &app,
        renovar_com_cookie(&refresh1, &[("origin", "https://malicioso.example")]),
    )
    .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);

    // 5. Renovação correta: novo access token, cookie rotacionado, nada de refresh no corpo.
    let r = enviar(
        &app,
        renovar_com_cookie(&refresh1, &[("origin", "http://localhost:3000")]),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK);
    assert!(r.corpo["token"].as_str().is_some());
    assert!(r.corpo.get("refresh_token").is_none());
    let refresh2 = refresh_do_set_cookie(&r.set_cookies);
    assert!(
        !refresh2.is_empty() && refresh2 != refresh1,
        "o refresh token deve girar"
    );

    // 6. Reusar o refresh antigo (já rotacionado) falha com 401, sem apagar o cookie (duas abas
    //    renovando juntas não podem derrubar o cookie novo da que ganhou a corrida).
    let r = enviar(&app, renovar_com_cookie(&refresh1, &[])).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    assert!(
        r.set_cookies.is_empty(),
        "401 de renovação não mexe no cookie"
    );

    // 7. Sem cookie nenhum, em modo cookie: 401.
    let sem_cookie = post("/api/v1/auth/refresh")
        .header("x-auth-mode", "cookie")
        .body(Body::empty())
        .unwrap();
    assert_eq!(
        enviar(&app, sem_cookie).await.status,
        StatusCode::UNAUTHORIZED
    );

    // 8. Logout em modo cookie apaga o cookie e revoga a sessão: o refresh token deixa de servir.
    let r = enviar(&app, renovar_com_cookie(&refresh2, &[])).await;
    assert_eq!(r.status, StatusCode::OK);
    let access = r.corpo["token"].as_str().unwrap().to_string();
    let refresh3 = refresh_do_set_cookie(&r.set_cookies);
    let logout = post("/api/v1/auth/logout")
        .header("x-auth-mode", "cookie")
        .header("authorization", auth_header(&access))
        .header("x-tenant-id", tenant.to_string())
        .body(Body::from("{}"))
        .unwrap();
    let r = enviar(&app, logout).await;
    assert_eq!(r.status, StatusCode::OK);
    assert!(r.set_cookies.iter().any(|c| c.contains("Max-Age=0")));
    assert_eq!(
        enviar(&app, renovar_com_cookie(&refresh3, &[]))
            .await
            .status,
        StatusCode::UNAUTHORIZED
    );

    // 9. Modo antigo (sem X-Auth-Mode) continua igual: refresh no corpo, sem cookie.
    let r = enviar(&app, login(&[])).await;
    assert_eq!(r.status, StatusCode::OK);
    let antigo = r.corpo["refresh_token"]
        .as_str()
        .expect("refresh no corpo")
        .to_string();
    assert!(r.set_cookies.is_empty());
    let via_corpo = post("/api/v1/auth/refresh")
        .body(Body::from(json!({"refresh_token": antigo}).to_string()))
        .unwrap();
    let r = enviar(&app, via_corpo).await;
    assert_eq!(r.status, StatusCode::OK);
    assert!(r.corpo["refresh_token"].as_str().is_some());
    assert!(r.set_cookies.is_empty());

    drop_database(&admin, &db_name).await;
}
