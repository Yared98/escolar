use argon2::PasswordHasher;
use axum::{extract::State, Json};
use escolar_backend::config::{development_signing_material, AppState, Config};
use escolar_backend::handlers::auth::sessao::issue_session_conn;
use escolar_backend::handlers::auth::{login, LoginDto};
use escolar_backend::handlers::recuperacao_senha::{
    esqueci_senha, redefinir_senha_publico, EsqueciSenhaDto, RedefinirSenhaDto,
};
use escolar_backend::services::email::listar_emails_saida;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
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

async fn create_test_pool() -> (PgPool, PgPool, String) {
    let admin_url = std::env::var("ESCOLAR_TEST_DATABASE_URL")
        .expect("ESCOLAR_TEST_DATABASE_URL deve estar configurado");
    let db_name = format!("escolar_recuperacao_senha_{}", Uuid::new_v4().simple());
    let admin = PgPoolOptions::new()
        .max_connections(2)
        .connect(&admin_url)
        .await
        .expect("conexão administrativa");

    sqlx::query(&format!("CREATE DATABASE {db_name}"))
        .execute(&admin)
        .await
        .expect("criação do database de teste");

    let pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(&database_url_for(&admin_url, &db_name))
        .await
        .expect("conexão do database de teste");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("aplicar migrations");

    (pool, admin, db_name)
}

fn make_state(pool: &PgPool) -> AppState {
    let (private_pem, public_pem, public_x) = development_signing_material();
    AppState {
        pool: pool.clone(),
        config: Config {
            database_url: String::new(),
            jwt_private_pem: private_pem,
            jwt_public_pem: public_pem,
            jwt_public_x: public_x,
            port: 8000,
            allowed_origins: "*".into(),
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
        },
        message_hub: escolar_backend::realtime::MessageHub::new(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    }
}

async fn criar_escola_com_gestor(pool: &PgPool, slug: &str) -> (Uuid, Uuid, String, String) {
    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let email = format!("gestor-{user_id}@escola.test");
    let password = "SenhaAntiga2026!";

    sqlx::query(
        "INSERT INTO tenants (id, name, slug, status) VALUES ($1, 'Escola Teste', $2, 'active')",
    )
    .bind(tenant_id)
    .bind(slug)
    .execute(pool)
    .await
    .expect("criar tenant");

    let salt =
        argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
    let argon2 = argon2::Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .unwrap()
        .to_string();

    sqlx::query(
        "INSERT INTO users (id, tenant_id, name, email, password_hash, role, ativo, deve_trocar_senha) VALUES ($1, $2, 'Gestor', $3, $4, 'gestor', true, false)"
    )
    .bind(user_id)
    .bind(tenant_id)
    .bind(&email)
    .bind(&hash)
    .execute(pool)
    .await
    .expect("criar gestor");

    (tenant_id, user_id, email, password.to_string())
}

fn extrair_token_do_corpo(corpo: &str) -> String {
    corpo
        .split("?redefinir=")
        .nth(1)
        .expect("link de redefinição não encontrado no corpo")
        .split("&escola=")
        .next()
        .expect("token malformado no link")
        .to_string()
}

#[tokio::test]
async fn email_existente_gera_email_e_link_funciona_uma_vez() {
    let (pool, admin, db_name) = create_test_pool().await;
    let state = make_state(&pool);
    let slug = "escola-rec-test";
    let (tenant_id, _user_id, email, _old_password) = criar_escola_com_gestor(&pool, slug).await;

    let resp = esqueci_senha(
        State(state.clone()),
        Json(EsqueciSenhaDto {
            tenant_slug: slug.to_string(),
            email: email.clone(),
        }),
    )
    .await
    .expect("esqueci-senha deve retornar 200");
    assert_eq!(
        resp.mensagem,
        "Se o e-mail estiver cadastrado, enviaremos as instruções."
    );

    let mut conn = escolar_backend::db::acquire_tenant(&pool, tenant_id)
        .await
        .unwrap();
    let emails = listar_emails_saida(&mut *conn, tenant_id, 10)
        .await
        .unwrap();
    assert_eq!(
        emails.len(),
        1,
        "deve haver 1 e-mail na caixa de saída simulada"
    );
    let email_saida = &emails[0];
    assert_eq!(email_saida.destinatario, email);
    assert!(email_saida.corpo.contains("?redefinir="));
    assert!(email_saida.corpo.contains(&format!("&escola={slug}")));

    let token = extrair_token_do_corpo(&email_saida.corpo);
    let nova_senha = "NovaSenhaSegura2026!";

    let resp = redefinir_senha_publico(
        State(state.clone()),
        Json(RedefinirSenhaDto {
            tenant_slug: slug.to_string(),
            token: token.clone(),
            nova_senha: nova_senha.to_string(),
        }),
    )
    .await
    .expect("redefinir-senha deve funcionar na primeira vez");
    assert_eq!(resp.mensagem, "Senha redefinida com sucesso.");

    let login_resp = login(
        State(state.clone()),
        axum::http::HeaderMap::new(),
        Json(LoginDto {
            tenant_slug: slug.to_string(),
            email: email.clone(),
            password: nova_senha.to_string(),
        }),
    )
    .await
    .expect("login com nova senha deve funcionar");
    assert!(!login_resp.token.is_empty());

    let resp = redefinir_senha_publico(
        State(state.clone()),
        Json(RedefinirSenhaDto {
            tenant_slug: slug.to_string(),
            token,
            nova_senha: "OutraSenha2026!".to_string(),
        }),
    )
    .await;
    assert!(resp.is_err(), "segundo uso do token deve falhar");
    match resp.unwrap_err() {
        escolar_backend::error::AppError::BadRequest(msg) => {
            assert_eq!(msg, "Link inválido ou expirado. Peça um novo.");
        }
        other => panic!("esperado BadRequest, obtido {other:?}"),
    }

    pool.close().await;
    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn email_inexistente_responde_200_e_nao_grava_email() {
    let (pool, admin, db_name) = create_test_pool().await;
    let state = make_state(&pool);
    let slug = "escola-rec-inexistente";
    let (tenant_id, _user_id, _email, _password) = criar_escola_com_gestor(&pool, slug).await;

    let resp = esqueci_senha(
        State(state.clone()),
        Json(EsqueciSenhaDto {
            tenant_slug: slug.to_string(),
            email: "naoexiste@escola.test".to_string(),
        }),
    )
    .await
    .expect("esqueci-senha deve retornar 200 mesmo para e-mail inexistente");
    assert_eq!(
        resp.mensagem,
        "Se o e-mail estiver cadastrado, enviaremos as instruções."
    );

    let mut conn = escolar_backend::db::acquire_tenant(&pool, tenant_id)
        .await
        .unwrap();
    let emails = listar_emails_saida(&mut *conn, tenant_id, 10)
        .await
        .unwrap();
    assert!(
        emails.is_empty(),
        "não deve gravar e-mail para destinatário inexistente"
    );

    pool.close().await;
    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn token_expirado_retorna_400() {
    let (pool, admin, db_name) = create_test_pool().await;
    let state = make_state(&pool);
    let slug = "escola-rec-expirado";
    let (tenant_id, _user_id, email, _password) = criar_escola_com_gestor(&pool, slug).await;

    let _ = esqueci_senha(
        State(state.clone()),
        Json(EsqueciSenhaDto {
            tenant_slug: slug.to_string(),
            email: email.clone(),
        }),
    )
    .await
    .unwrap();

    // Força a expiração do token no banco
    sqlx::query(
        "UPDATE tokens_recuperacao_senha SET expires_at = NOW() - INTERVAL '1 minute' WHERE tenant_id = $1"
    )
    .bind(tenant_id)
    .execute(&pool)
    .await
    .unwrap();

    let mut conn = escolar_backend::db::acquire_tenant(&pool, tenant_id)
        .await
        .unwrap();
    let emails = listar_emails_saida(&mut *conn, tenant_id, 10)
        .await
        .unwrap();
    let token = extrair_token_do_corpo(&emails[0].corpo);

    let resp = redefinir_senha_publico(
        State(state.clone()),
        Json(RedefinirSenhaDto {
            tenant_slug: slug.to_string(),
            token,
            nova_senha: "NovaSenhaSegura2026!".to_string(),
        }),
    )
    .await;
    assert!(resp.is_err(), "token expirado deve falhar");
    match resp.unwrap_err() {
        escolar_backend::error::AppError::BadRequest(msg) => {
            assert_eq!(msg, "Link inválido ou expirado. Peça um novo.");
        }
        other => panic!("esperado BadRequest, obtido {other:?}"),
    }

    pool.close().await;
    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn redefinir_senha_revoga_refresh_tokens_antigos() {
    let (pool, admin, db_name) = create_test_pool().await;
    let state = make_state(&pool);
    let slug = "escola-rec-revoga";
    let (tenant_id, user_id, email, _password) = criar_escola_com_gestor(&pool, slug).await;

    // Cria um refresh token ativo para o usuário
    {
        let mut conn = escolar_backend::db::acquire_tenant(&pool, tenant_id)
            .await
            .unwrap();
        issue_session_conn(
            &mut conn,
            user_id,
            tenant_id,
            "gestor",
            &state.config.jwt_private_pem,
        )
        .await
        .expect("criar sessão");
    }

    let _ = esqueci_senha(
        State(state.clone()),
        Json(EsqueciSenhaDto {
            tenant_slug: slug.to_string(),
            email: email.clone(),
        }),
    )
    .await
    .unwrap();

    let mut conn = escolar_backend::db::acquire_tenant(&pool, tenant_id)
        .await
        .unwrap();
    let emails = listar_emails_saida(&mut *conn, tenant_id, 10)
        .await
        .unwrap();
    let token = extrair_token_do_corpo(&emails[0].corpo);

    let _ = redefinir_senha_publico(
        State(state.clone()),
        Json(RedefinirSenhaDto {
            tenant_slug: slug.to_string(),
            token,
            nova_senha: "NovaSenhaSegura2026!".to_string(),
        }),
    )
    .await
    .unwrap();

    let ativos: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL",
    )
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        ativos, 0,
        "todos os refresh tokens antigos devem estar revogados"
    );

    pool.close().await;
    drop_database(&admin, &db_name).await;
}

#[tokio::test]
async fn isolamento_entre_escolas() {
    let (pool, admin, db_name) = create_test_pool().await;
    let state = make_state(&pool);
    let slug_a = "escola-rec-a";
    let slug_b = "escola-rec-b";
    let (tenant_a, _user_a, email_a, _password_a) = criar_escola_com_gestor(&pool, slug_a).await;
    let (tenant_b, _user_b, _email_b, _password_b) = criar_escola_com_gestor(&pool, slug_b).await;

    let _ = esqueci_senha(
        State(state.clone()),
        Json(EsqueciSenhaDto {
            tenant_slug: slug_a.to_string(),
            email: email_a.clone(),
        }),
    )
    .await
    .unwrap();

    let mut conn_a = escolar_backend::db::acquire_tenant(&pool, tenant_a)
        .await
        .unwrap();
    let emails_a = listar_emails_saida(&mut *conn_a, tenant_a, 10)
        .await
        .unwrap();
    assert_eq!(emails_a.len(), 1);
    drop(conn_a);

    let mut conn_b = escolar_backend::db::acquire_tenant(&pool, tenant_b)
        .await
        .unwrap();
    let emails_b = listar_emails_saida(&mut *conn_b, tenant_b, 10)
        .await
        .unwrap();
    assert!(
        emails_b.is_empty(),
        "escola B não deve enxergar e-mails da escola A"
    );

    pool.close().await;
    drop_database(&admin, &db_name).await;
}
