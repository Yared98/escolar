use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
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

#[tokio::test]
async fn test_integracoes_status_rbac_formato_e_isolamento() {
    let Some(admin_url) = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.trim().is_empty())
    else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de status de integrações ignorado.");
        return;
    };

    let db_name = format!("escolar_test_status_{}", Uuid::new_v4().simple());
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

    // Tenants
    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Tenant A', $2)")
        .bind(tenant_a)
        .bind(format!("tenant-a-{}", &tenant_a.to_string()[..8]))
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Tenant B', $2)")
        .bind(tenant_b)
        .bind(format!("tenant-b-{}", &tenant_b.to_string()[..8]))
        .execute(&pool)
        .await
        .unwrap();

    // Usuários do Tenant A
    let user_admin_a = Uuid::new_v4();
    let user_gestor_a = Uuid::new_v4();
    let user_fin_a = Uuid::new_v4();
    let user_prof_a = Uuid::new_v4();
    let user_sec_a = Uuid::new_v4();

    for (uid, role, email) in [
        (user_admin_a, "admin", "admin@a.test"),
        (user_gestor_a, "gestor", "gestor@a.test"),
        (user_fin_a, "financeiro", "fin@a.test"),
        (user_prof_a, "professor", "prof@a.test"),
        (user_sec_a, "secretaria", "sec@a.test"),
    ] {
        sqlx::query(
            "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'hash', $5)",
        )
        .bind(uid)
        .bind(tenant_a)
        .bind(format!("User {role}"))
        .bind(email)
        .bind(role)
        .execute(&pool)
        .await
        .unwrap();
    }

    // Usuário do Tenant B (financeiro)
    let user_fin_b = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, 'Fin B', 'fin@b.test', 'hash', 'financeiro')",
    )
    .bind(user_fin_b)
    .bind(tenant_b)
    .execute(&pool)
    .await
    .unwrap();

    // Configuração Itaú: Tenant A ativo = true
    sqlx::query(
        r#"
        INSERT INTO tenant_itau_config (tenant_id, agencia, conta, dac, id_beneficiario, chave_pix, especie_padrao, multa_padrao_percentual, juros_padrao_percentual, ativo, proximo_nosso_numero)
        VALUES ($1, '1500', '0005206', '1', '150000052061', '12345678000190', '04', 2.00, 1.00, true, 1)
        "#,
    )
    .bind(tenant_a)
    .execute(&pool)
    .await
    .unwrap();
    // Tenant B não tem registro em tenant_itau_config

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
        app_secrets_key: Some(ChaveMestra::from_hex(TEST_SECRETS_HEX).unwrap()),
        itau_mode: ItauMode::Mock,
        itau_sts_base_url: None,
    };

    let state = AppState {
        pool: pool.clone(),
        config: config.clone(),
        message_hub: MessageHub::new(),
        ip_rate_limiter: IpRateLimiter::new(),
    };

    let token_admin_a = generate_jwt(user_admin_a, tenant_a, "admin", &priv_key_pem).unwrap();
    let token_gestor_a = generate_jwt(user_gestor_a, tenant_a, "gestor", &priv_key_pem).unwrap();
    let token_fin_a = generate_jwt(user_fin_a, tenant_a, "financeiro", &priv_key_pem).unwrap();
    let token_prof_a = generate_jwt(user_prof_a, tenant_a, "professor", &priv_key_pem).unwrap();
    let token_sec_a = generate_jwt(user_sec_a, tenant_a, "secretaria", &priv_key_pem).unwrap();
    let token_fin_b = generate_jwt(user_fin_b, tenant_b, "financeiro", &priv_key_pem).unwrap();

    let app = create_router(state.clone());

    // 1. Financeiro Tenant A recebe 200 com formato exato
    {
        let req = Request::builder()
            .method("GET")
            .uri("/api/v1/financeiro/integracoes/status")
            .header(header::AUTHORIZATION, format!("Bearer {token_fin_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let body: Value =
            serde_json::from_slice(&axum::body::to_bytes(resp.into_body(), 2048).await.unwrap())
                .unwrap();

        // Resposta exata: { "itau": { "modo": ..., "ativo": ... }, "cora": { "modo": ..., "disponivel": ... } }
        let obj = body.as_object().expect("deve ser objeto JSON");
        let mut top_keys: Vec<_> = obj.keys().cloned().collect();
        top_keys.sort();
        assert_eq!(
            top_keys,
            vec!["cora", "itau"],
            "resposta não deve conter nenhuma outra chave"
        );

        let itau_obj = body["itau"].as_object().expect("itau deve ser objeto");
        let mut itau_keys: Vec<_> = itau_obj.keys().cloned().collect();
        itau_keys.sort();
        assert_eq!(
            itau_keys,
            vec!["ativo", "modo"],
            "itau só deve ter ativo e modo"
        );

        let cora_obj = body["cora"].as_object().expect("cora deve ser objeto");
        let mut cora_keys: Vec<_> = cora_obj.keys().cloned().collect();
        cora_keys.sort();
        assert_eq!(
            cora_keys,
            vec!["disponivel", "modo"],
            "cora só deve ter disponivel e modo"
        );

        assert_eq!(body["itau"]["modo"], "mock");
        assert_eq!(body["itau"]["ativo"], true);
        assert_eq!(body["cora"]["modo"], "mock");
        assert_eq!(body["cora"]["disponivel"], true);
    }

    // 2. Admin e Gestor também recebem 200
    {
        let req_admin = Request::builder()
            .method("GET")
            .uri("/api/v1/financeiro/integracoes/status")
            .header(header::AUTHORIZATION, format!("Bearer {token_admin_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_admin = app.clone().oneshot(req_admin).await.unwrap();
        assert_eq!(resp_admin.status(), StatusCode::OK);

        let req_gestor = Request::builder()
            .method("GET")
            .uri("/api/v1/financeiro/integracoes/status")
            .header(header::AUTHORIZATION, format!("Bearer {token_gestor_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_gestor = app.clone().oneshot(req_gestor).await.unwrap();
        assert_eq!(resp_gestor.status(), StatusCode::OK);
    }

    // 3. Professor e Secretaria recebem 403
    {
        let req_prof = Request::builder()
            .method("GET")
            .uri("/api/v1/financeiro/integracoes/status")
            .header(header::AUTHORIZATION, format!("Bearer {token_prof_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_prof = app.clone().oneshot(req_prof).await.unwrap();
        assert_eq!(resp_prof.status(), StatusCode::FORBIDDEN);

        let req_sec = Request::builder()
            .method("GET")
            .uri("/api/v1/financeiro/integracoes/status")
            .header(header::AUTHORIZATION, format!("Bearer {token_sec_a}"))
            .header("X-Tenant-ID", tenant_a.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_sec = app.clone().oneshot(req_sec).await.unwrap();
        assert_eq!(resp_sec.status(), StatusCode::FORBIDDEN);
    }

    // 4. Tenant B não vê o ativo do Tenant A (isolamento multitenant)
    {
        let req_b = Request::builder()
            .method("GET")
            .uri("/api/v1/financeiro/integracoes/status")
            .header(header::AUTHORIZATION, format!("Bearer {token_fin_b}"))
            .header("X-Tenant-ID", tenant_b.to_string())
            .body(Body::empty())
            .unwrap();
        let resp_b = app.clone().oneshot(req_b).await.unwrap();
        assert_eq!(resp_b.status(), StatusCode::OK);

        let body_b: Value = serde_json::from_slice(
            &axum::body::to_bytes(resp_b.into_body(), 2048)
                .await
                .unwrap(),
        )
        .unwrap();

        assert_eq!(
            body_b["itau"]["ativo"], false,
            "Tenant B sem configuração deve ter ativo = false"
        );
    }

    // Limpeza
    drop_database(&admin, &db_name).await;
}
