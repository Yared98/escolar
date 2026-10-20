use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use axum::Router;
use escolar_backend::config::{development_signing_material, AppState, Config};
use escolar_backend::handlers::auth::generate_jwt;
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

    let db_name = format!("escolar_notif_leitura_{}", Uuid::new_v4().simple());
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

async fn chamar(
    app: &Router,
    method: Method,
    uri: &str,
    token: &str,
    tenant: Uuid,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("Authorization", auth_header(token))
        .header("X-Tenant-ID", tenant.to_string());
    let body = match body {
        Some(payload) => {
            builder = builder.header("Content-Type", "application/json");
            Body::from(payload.to_string())
        }
        None => Body::empty(),
    };
    let res = app
        .clone()
        .oneshot(builder.body(body).unwrap())
        .await
        .unwrap();

    let status = res.status();
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let payload: Value = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(&bytes).unwrap_or(json!({}))
    };
    (status, payload)
}

fn lida_de(lista: &Value, id: Uuid) -> bool {
    lista
        .as_array()
        .expect("lista de notificações")
        .iter()
        .find(|n| n["id"] == id.to_string())
        .and_then(|n| n["lida"].as_bool())
        .expect("notificação na lista")
}

/// Leitura por pessoa: aviso geral marcado por um não some para os outros; marcar persiste;
/// notificação de outra pessoa vista pela gestão não muda a leitura do destinatário; isolamento.
#[tokio::test]
async fn notificacoes_leitura_por_pessoa_persistente_e_isolada() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        return;
    };

    let tenant_a = Uuid::new_v4();
    let tenant_b = Uuid::new_v4();
    let gestor = Uuid::new_v4();
    let professor = Uuid::new_v4();
    let familia = Uuid::new_v4();
    let gestor_b = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO tenants (id, name, slug, status) VALUES ($1, 'Escola A', $2, 'active'), ($3, 'Escola B', $4, 'active')",
    )
    .bind(tenant_a)
    .bind(format!("a-{}", tenant_a.simple()))
    .bind(tenant_b)
    .bind(format!("b-{}", tenant_b.simple()))
    .execute(&pool)
    .await
    .unwrap();
    for (id, tenant, email, role) in [
        (gestor, tenant_a, "gestor@a.test", "gestor"),
        (professor, tenant_a, "prof@a.test", "professor"),
        (familia, tenant_a, "familia@a.test", "responsavel"),
        (gestor_b, tenant_b, "gestor@b.test", "gestor"),
    ] {
        sqlx::query(
            "INSERT INTO users (id, tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $3, 'x', $4)",
        )
        .bind(id)
        .bind(tenant)
        .bind(email)
        .bind(role)
        .execute(&pool)
        .await
        .unwrap();
    }

    let geral = Uuid::new_v4();
    let para_familia = Uuid::new_v4();
    let geral_b = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO notificacoes_sistema (id, tenant_id, destinatario_id, modulo, titulo, mensagem, canal_disparo) VALUES \
         ($1, $2, NULL, 'agenda', 'Reunião geral', 'Sexta às 19h', 'push_pwa'), \
         ($3, $2, $4, 'financeiro', 'Mensalidade', 'Vence amanhã', 'push_pwa'), \
         ($5, $6, NULL, 'agenda', 'Aviso B', 'Outra escola', 'push_pwa')",
    )
    .bind(geral)
    .bind(tenant_a)
    .bind(para_familia)
    .bind(familia)
    .bind(geral_b)
    .bind(tenant_b)
    .execute(&pool)
    .await
    .unwrap();

    let state = app_state(pool.clone());
    let pem = state.config.jwt_private_pem.clone();
    let app = create_router(state);
    let tok = |id: Uuid, tenant: Uuid, role: &str| generate_jwt(id, tenant, role, &pem).unwrap();
    let t_gestor = tok(gestor, tenant_a, "gestor");
    let t_prof = tok(professor, tenant_a, "professor");
    let t_familia = tok(familia, tenant_a, "responsavel");
    let t_gestor_b = tok(gestor_b, tenant_b, "gestor");

    // Professor marca todas: o aviso geral fica lido só para ele.
    let (st, _) = chamar(
        &app,
        Method::POST,
        "/api/v1/notificacoes/marcar-todas-lidas",
        &t_prof,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(st, StatusCode::OK);
    let (_, lista_prof) = chamar(
        &app,
        Method::GET,
        "/api/v1/notificacoes",
        &t_prof,
        tenant_a,
        None,
    )
    .await;
    assert!(
        lida_de(&lista_prof, geral),
        "a leitura do professor foi gravada"
    );
    let (_, lista_gestor) = chamar(
        &app,
        Method::GET,
        "/api/v1/notificacoes",
        &t_gestor,
        tenant_a,
        None,
    )
    .await;
    assert!(
        !lida_de(&lista_gestor, geral),
        "a leitura do professor não vale para a gestão"
    );
    let (_, lista_familia) = chamar(
        &app,
        Method::GET,
        "/api/v1/notificacoes",
        &t_familia,
        tenant_a,
        None,
    )
    .await;
    assert!(!lida_de(&lista_familia, geral), "nem para a família");

    // Gestão vê a notificação da família e marca: lida para a gestão, não para a família.
    let (st, _) = chamar(
        &app,
        Method::POST,
        &format!("/api/v1/notificacoes/marcar-lida/{para_familia}"),
        &t_gestor,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(st, StatusCode::OK);
    let (_, lista_gestor) = chamar(
        &app,
        Method::GET,
        "/api/v1/notificacoes",
        &t_gestor,
        tenant_a,
        None,
    )
    .await;
    assert!(lida_de(&lista_gestor, para_familia));
    let (_, lista_familia) = chamar(
        &app,
        Method::GET,
        "/api/v1/notificacoes",
        &t_familia,
        tenant_a,
        None,
    )
    .await;
    assert!(
        !lida_de(&lista_familia, para_familia),
        "a família ainda não leu a própria notificação"
    );

    // Professor não marca notificação endereçada à família (não é dele).
    let (st, _) = chamar(
        &app,
        Method::POST,
        &format!("/api/v1/notificacoes/marcar-lida/{para_familia}"),
        &t_prof,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(st, StatusCode::NOT_FOUND);

    // Família marca a sua: persiste em nova consulta.
    let (st, _) = chamar(
        &app,
        Method::POST,
        &format!("/api/v1/notificacoes/marcar-lida/{para_familia}"),
        &t_familia,
        tenant_a,
        None,
    )
    .await;
    assert_eq!(st, StatusCode::OK);
    let (_, lista_familia) = chamar(
        &app,
        Method::GET,
        "/api/v1/notificacoes",
        &t_familia,
        tenant_a,
        None,
    )
    .await;
    assert!(lida_de(&lista_familia, para_familia));

    // Outra escola: não enxerga nem marca notificações da escola A.
    let (st, _) = chamar(
        &app,
        Method::POST,
        &format!("/api/v1/notificacoes/marcar-lida/{geral}"),
        &t_gestor_b,
        tenant_b,
        None,
    )
    .await;
    assert_eq!(st, StatusCode::NOT_FOUND);
    let (_, lista_b) = chamar(
        &app,
        Method::GET,
        "/api/v1/notificacoes",
        &t_gestor_b,
        tenant_b,
        None,
    )
    .await;
    let ids_b: Vec<String> = lista_b
        .as_array()
        .unwrap()
        .iter()
        .map(|n| n["id"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(ids_b, vec![geral_b.to_string()]);
    let (st, _) = chamar(
        &app,
        Method::POST,
        "/api/v1/notificacoes/marcar-todas-lidas",
        &t_gestor_b,
        tenant_b,
        None,
    )
    .await;
    assert_eq!(st, StatusCode::OK);
    let (_, lista_gestor) = chamar(
        &app,
        Method::GET,
        "/api/v1/notificacoes",
        &t_gestor,
        tenant_a,
        None,
    )
    .await;
    assert!(
        !lida_de(&lista_gestor, geral),
        "marcar na escola B não mexe na escola A"
    );

    drop_database(&admin, &db_name).await;
}
