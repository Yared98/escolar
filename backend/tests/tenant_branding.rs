use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use escolar_backend::{
    config::{development_signing_material, AppState, Config, CoraMode, EmailMode, ItauMode},
    handlers::auth::generate_jwt,
    middleware::security::IpRateLimiter,
    realtime::MessageHub,
    routes::create_router,
};

const VALID_PNG: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
    0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
    0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00,
    0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
];

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
async fn test_tenant_branding_completo() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste tenant_branding ignorado.");
        return;
    };

    let db_name = format!("escolar_branding_{}", Uuid::new_v4().simple());
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

    let (priv_key_pem, pub_key_pem, pub_x) = development_signing_material();

    let config = Config {
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
        app_secrets_key: None,
        itau_mode: ItauMode::Mock,
        itau_sts_base_url: None,
    };

    let state = AppState {
        pool: pool.clone(),
        config: config.clone(),
        message_hub: MessageHub::new(),
        ip_rate_limiter: IpRateLimiter::new(),
    };

    let tenant_a = Uuid::new_v4();
    let slug_a = format!("escola-a-{}", &tenant_a.to_string()[..8]);
    let tenant_b = Uuid::new_v4();
    let slug_b = format!("escola-b-{}", &tenant_b.to_string()[..8]);

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Colégio Alpha', $2), ($3, 'Colégio Beta', $4)")
        .bind(tenant_a)
        .bind(&slug_a)
        .bind(tenant_b)
        .bind(&slug_b)
        .execute(&pool)
        .await
        .unwrap();

    let user_gestor_a = Uuid::new_v4();
    let user_prof_a = Uuid::new_v4();
    let user_gestor_b = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO users (id, tenant_id, name, email, password_hash, role)
        VALUES ($1, $2, 'Gestor Alpha', 'gestor@alpha.test', 'hash', 'gestor'),
               ($3, $2, 'Professor Alpha', 'prof@alpha.test', 'hash', 'professor'),
               ($4, $5, 'Gestor Beta', 'gestor@beta.test', 'hash', 'gestor')
        "#,
    )
    .bind(user_gestor_a)
    .bind(tenant_a)
    .bind(user_prof_a)
    .bind(user_gestor_b)
    .bind(tenant_b)
    .execute(&pool)
    .await
    .unwrap();

    let token_gestor_a = generate_jwt(user_gestor_a, tenant_a, "gestor", &priv_key_pem).unwrap();
    let token_prof_a = generate_jwt(user_prof_a, tenant_a, "professor", &priv_key_pem).unwrap();
    let token_gestor_b = generate_jwt(user_gestor_b, tenant_b, "gestor", &priv_key_pem).unwrap();

    let app = create_router(state.clone());

    // =========================================================================
    // 1. GET sem linha devolve os padrões e o nome do tenant.
    // =========================================================================
    {
        let req = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/branding")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let body: Value = serde_json::from_slice(&body_bytes).unwrap();

        assert_eq!(body["cor_primaria"], "#2d5338");
        assert_eq!(body["cor_destaque"], "#f59e0b");
        assert_eq!(body["nome_exibicao"], "Colégio Alpha");
        assert_eq!(body["tem_logo"], false);
        assert!(body["logo_url"].is_null());
        assert!(body["atualizado_em"].is_null());
    }

    // =========================================================================
    // 2. PUT por gestor grava (hex maiúsculo vira minúsculo) e gera audit_logs; GET seguinte devolve novo valor.
    // =========================================================================
    {
        let payload = json!({
            "cor_primaria": "#1A2B3C",
            "cor_destaque": "#4D5E6F",
            "nome_exibicao": "Alpha School"
        });

        let req = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&payload).unwrap()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let body: Value = serde_json::from_slice(&body_bytes).unwrap();

        assert_eq!(body["cor_primaria"], "#1a2b3c");
        assert_eq!(body["cor_destaque"], "#4d5e6f");
        assert_eq!(body["nome_exibicao"], "Alpha School");
        assert!(!body["atualizado_em"].is_null());

        // Verificar registro em audit_logs
        let audit_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM audit_logs WHERE tenant_id = $1 AND acao = 'tenant_branding.atualizar'",
        )
        .bind(tenant_a)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(audit_count, 1);

        // GET seguinte devolve o novo valor
        let req_get = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/branding")
            .header(header::AUTHORIZATION, format!("Bearer {token_prof_a}")) // professor pode ler!
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();

        let resp_get = app.clone().oneshot(req_get).await.unwrap();
        assert_eq!(resp_get.status(), StatusCode::OK);
        let body_get: Value = serde_json::from_slice(
            &axum::body::to_bytes(resp_get.into_body(), usize::MAX).await.unwrap(),
        )
        .unwrap();
        assert_eq!(body_get["cor_primaria"], "#1a2b3c");
        assert_eq!(body_get["cor_destaque"], "#4d5e6f");
        assert_eq!(body_get["nome_exibicao"], "Alpha School");
    }

    // =========================================================================
    // 3. PUT por professor → 403; hex inválido ('azul', '#12345') → 400; nome com 121 caracteres → 400.
    // =========================================================================
    {
        // Professor tentando alterar cores -> 403 Forbidden
        let payload = json!({
            "cor_primaria": "#112233",
            "cor_destaque": "#223344",
            "nome_exibicao": "Tentativa Professor"
        });
        let req_prof = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding")
            .header(header::AUTHORIZATION, format!("Bearer {token_prof_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&payload).unwrap()))
            .unwrap();
        let resp_prof = app.clone().oneshot(req_prof).await.unwrap();
        assert_eq!(resp_prof.status(), StatusCode::FORBIDDEN);

        // Hex inválido: "azul" -> 400 Bad Request
        let payload_azul = json!({
            "cor_primaria": "azul",
            "cor_destaque": "#223344"
        });
        let req_azul = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&payload_azul).unwrap()))
            .unwrap();
        let resp_azul = app.clone().oneshot(req_azul).await.unwrap();
        assert_eq!(resp_azul.status(), StatusCode::BAD_REQUEST);

        // Hex inválido: "#12345" -> 400 Bad Request
        let payload_curto = json!({
            "cor_primaria": "#12345",
            "cor_destaque": "#223344"
        });
        let req_curto = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&payload_curto).unwrap()))
            .unwrap();
        let resp_curto = app.clone().oneshot(req_curto).await.unwrap();
        assert_eq!(resp_curto.status(), StatusCode::BAD_REQUEST);

        // Nome com 121 caracteres -> 400 Bad Request
        let nome_longo = "A".repeat(121);
        let payload_longo = json!({
            "cor_primaria": "#112233",
            "cor_destaque": "#223344",
            "nome_exibicao": nome_longo
        });
        let req_longo = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&payload_longo).unwrap()))
            .unwrap();
        let resp_longo = app.clone().oneshot(req_longo).await.unwrap();
        assert_eq!(resp_longo.status(), StatusCode::BAD_REQUEST);
    }

    // =========================================================================
    // 4. Logo PNG mínimo válido aceito e servido com Content-Type certo; SVG → 400; 262145 bytes → erro; DELETE remove.
    // =========================================================================
    {
        // Envio de PNG válido por gestor
        let req_png = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding/logo")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header(header::CONTENT_TYPE, "image/png")
            .body(Body::from(VALID_PNG.to_vec()))
            .unwrap();
        let resp_png = app.clone().oneshot(req_png).await.unwrap();
        assert_eq!(resp_png.status(), StatusCode::OK);
        let body_png: Value = serde_json::from_slice(
            &axum::body::to_bytes(resp_png.into_body(), usize::MAX).await.unwrap(),
        )
        .unwrap();
        assert_eq!(body_png["tem_logo"], true);
        let logo_url = body_png["logo_url"].as_str().unwrap();
        assert!(logo_url.starts_with("/api/v1/tenant/branding/logo?v="));

        // GET do logo servido com headers corretos
        let req_get_logo = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/branding/logo")
            .header(header::AUTHORIZATION, format!("Bearer {token_prof_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_get_logo = app.clone().oneshot(req_get_logo).await.unwrap();
        assert_eq!(resp_get_logo.status(), StatusCode::OK);
        assert_eq!(
            resp_get_logo.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/png"
        );
        assert_eq!(
            resp_get_logo.headers().get(header::CACHE_CONTROL).unwrap(),
            "private, max-age=300"
        );
        assert_eq!(
            resp_get_logo.headers().get("x-content-type-options").unwrap(),
            "nosniff"
        );
        let logo_bytes = axum::body::to_bytes(resp_get_logo.into_body(), usize::MAX).await.unwrap();
        assert_eq!(logo_bytes.as_ref(), VALID_PNG);

        // Envio de SVG (<svg ...>) -> 400 Bad Request
        let svg_bytes = b"<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"10\"/></svg>";
        let req_svg = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding/logo")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header(header::CONTENT_TYPE, "image/svg+xml")
            .body(Body::from(svg_bytes.to_vec()))
            .unwrap();
        let resp_svg = app.clone().oneshot(req_svg).await.unwrap();
        assert_eq!(resp_svg.status(), StatusCode::BAD_REQUEST);

        // Envio com 262.145 bytes -> erro 400
        let big_bytes = vec![0u8; 262145];
        let req_big = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding/logo")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::from(big_bytes))
            .unwrap();
        let resp_big = app.clone().oneshot(req_big).await.unwrap();
        assert_eq!(resp_big.status(), StatusCode::BAD_REQUEST);

        // DELETE remove o logo
        let req_del = Request::builder()
            .method("DELETE")
            .uri("/api/v1/tenant/branding/logo")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_del = app.clone().oneshot(req_del).await.unwrap();
        assert_eq!(resp_del.status(), StatusCode::OK);
        let body_del: Value = serde_json::from_slice(
            &axum::body::to_bytes(resp_del.into_body(), usize::MAX).await.unwrap(),
        )
        .unwrap();
        assert_eq!(body_del["tem_logo"], false);
        assert!(body_del["logo_url"].is_null());

        // GET seguinte do logo -> 404
        let req_get_404 = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/branding/logo")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_get_404 = app.clone().oneshot(req_get_404).await.unwrap();
        assert_eq!(resp_get_404.status(), StatusCode::NOT_FOUND);

        // Verificar audit_logs de logo
        let audit_logo_up: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM audit_logs WHERE tenant_id = $1 AND acao = 'tenant_branding.logo_atualizar'",
        )
        .bind(tenant_a)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(audit_logo_up, 1);

        let audit_logo_del: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM audit_logs WHERE tenant_id = $1 AND acao = 'tenant_branding.logo_remover'",
        )
        .bind(tenant_a)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(audit_logo_del, 1);
    }

    // =========================================================================
    // 5. Isolamento: com o contexto da escola A, não se lê nem se altera a linha da escola B.
    // =========================================================================
    {
        // Escola B define sua própria identidade
        let payload_b = json!({
            "cor_primaria": "#001122",
            "cor_destaque": "#334455",
            "nome_exibicao": "Beta School"
        });
        let req_b = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_b}"))
            .header("X-Tenant-ID", tenant_b.to_string())
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&payload_b).unwrap()))
            .unwrap();
        let resp_b = app.clone().oneshot(req_b).await.unwrap();
        assert_eq!(resp_b.status(), StatusCode::OK);

        // Gestor A consulta -> continua vendo seus dados, não os da Escola B
        let req_a = Request::builder()
            .method("GET")
            .uri("/api/v1/tenant/branding")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_a = app.clone().oneshot(req_a).await.unwrap();
        assert_eq!(resp_a.status(), StatusCode::OK);
        let body_a: Value = serde_json::from_slice(
            &axum::body::to_bytes(resp_a.into_body(), usize::MAX).await.unwrap(),
        )
        .unwrap();
        assert_eq!(body_a["cor_primaria"], "#1a2b3c");
        assert_eq!(body_a["nome_exibicao"], "Alpha School");

        // Consulta direta via SQL com RLS ativo sob contexto do Tenant A
        let mut conn = pool.acquire().await.unwrap();
        sqlx::query("SET ROLE escolar_runtime")
            .execute(&mut *conn)
            .await
            .unwrap();
        sqlx::query("SELECT set_config('app.current_tenant', $1, false)")
            .bind(tenant_a.to_string())
            .execute(&mut *conn)
            .await
            .unwrap();

        let visible_b: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM tenant_branding WHERE tenant_id = $1",
        )
        .bind(tenant_b)
        .fetch_one(&mut *conn)
        .await
        .unwrap();
        assert_eq!(visible_b, 0, "Tenant A não deve enxergar tenant_branding do Tenant B sob RLS");

        // Escrita cruzada: Tenant A tentando alterar a linha do Tenant B
        let cross_update = sqlx::query(
            "UPDATE tenant_branding SET cor_primaria = '#999999' WHERE tenant_id = $1",
        )
        .bind(tenant_b)
        .execute(&mut *conn)
        .await
        .unwrap();
        assert_eq!(cross_update.rows_affected(), 0, "Update cruzado deve afetar 0 linhas");

        sqlx::query("RESET ROLE")
            .execute(&mut *conn)
            .await
            .unwrap();
    }

    // =========================================================================
    // 6. Pública: slug válido devolve as cores; slug inexistente → 404.
    // =========================================================================
    {
        // Inserir logo novamente na Escola A para testar rota pública de logo
        let req_png = Request::builder()
            .method("PUT")
            .uri("/api/v1/tenant/branding/logo")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .header(header::CONTENT_TYPE, "image/png")
            .body(Body::from(VALID_PNG.to_vec()))
            .unwrap();
        let _ = app.clone().oneshot(req_png).await.unwrap();

        // Rota pública por slug válido (sem nenhum header de auth nem X-Tenant-ID)
        let req_pub = Request::builder()
            .method("GET")
            .uri(format!("/api/v1/public/branding/{slug_a}"))
            .body(Body::empty())
            .unwrap();
        let resp_pub = app.clone().oneshot(req_pub).await.unwrap();
        assert_eq!(resp_pub.status(), StatusCode::OK);
        let body_pub: Value = serde_json::from_slice(
            &axum::body::to_bytes(resp_pub.into_body(), usize::MAX).await.unwrap(),
        )
        .unwrap();
        assert_eq!(body_pub["cor_primaria"], "#1a2b3c");
        assert_eq!(body_pub["cor_destaque"], "#4d5e6f");
        assert_eq!(body_pub["nome_exibicao"], "Alpha School");
        let pub_logo_url = body_pub["logo_url"].as_str().unwrap();
        assert!(pub_logo_url.starts_with(&format!("/api/v1/public/branding/{slug_a}/logo?v=")));

        // Não expor ID nem outros campos internos
        assert!(body_pub.get("tenant_id").is_none());
        assert!(body_pub.get("cnpj").is_none());

        // Rota pública de logo
        let req_pub_logo = Request::builder()
            .method("GET")
            .uri(format!("/api/v1/public/branding/{slug_a}/logo"))
            .body(Body::empty())
            .unwrap();
        let resp_pub_logo = app.clone().oneshot(req_pub_logo).await.unwrap();
        assert_eq!(resp_pub_logo.status(), StatusCode::OK);
        assert_eq!(
            resp_pub_logo.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/png"
        );
        assert_eq!(
            resp_pub_logo.headers().get(header::CACHE_CONTROL).unwrap(),
            "public, max-age=300"
        );
        assert_eq!(
            resp_pub_logo.headers().get("x-content-type-options").unwrap(),
            "nosniff"
        );
        let pub_bytes = axum::body::to_bytes(resp_pub_logo.into_body(), usize::MAX).await.unwrap();
        assert_eq!(pub_bytes.as_ref(), VALID_PNG);

        // Slug inexistente -> 404 Not Found
        let req_404 = Request::builder()
            .method("GET")
            .uri("/api/v1/public/branding/escola-inexistente-12345")
            .body(Body::empty())
            .unwrap();
        let resp_404 = app.clone().oneshot(req_404).await.unwrap();
        assert_eq!(resp_404.status(), StatusCode::NOT_FOUND);

        let req_logo_404 = Request::builder()
            .method("GET")
            .uri("/api/v1/public/branding/escola-inexistente-12345/logo")
            .body(Body::empty())
            .unwrap();
        let resp_logo_404 = app.clone().oneshot(req_logo_404).await.unwrap();
        assert_eq!(resp_logo_404.status(), StatusCode::NOT_FOUND);
    }

    pool.close().await;
    drop_database(&admin, &db_name).await;
}
