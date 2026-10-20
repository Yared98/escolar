use escolar_backend::config::ChaveMestra;
use escolar_backend::db::acquire_tenant;
use escolar_backend::services::secrets::{apagar, existe, ler, salvar, TipoSegredo};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use uuid::Uuid;

const HEX_CHAVE: &str = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const GATEWAY: &str = "itau";

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

    let db_name = format!("escolar_gateway_secrets_{}", Uuid::new_v4().simple());
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
            drop_database(&admin, &db_name).await;
            return None;
        }
    };

    if let Err(e) = sqlx::migrate!("./migrations").run(&pool).await {
        eprintln!("Falha ao rodar migrations de teste ({e}); teste ignorado.");
        drop(pool);
        drop_database(&admin, &db_name).await;
        return None;
    }

    Some((admin, db_name, pool))
}

async fn criar_tenant(pool: &PgPool, nome: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(nome)
        .bind(format!("escola-{}", &id.to_string()[..8]))
        .execute(pool)
        .await
        .expect("criar tenant de teste");
    id
}

#[tokio::test]
async fn segredo_salvo_le_upsert_existe_apagar_e_isola_tenants() {
    let Some((admin, db_name, pool)) = setup_pool().await else {
        eprintln!("ESCOLAR_TEST_DATABASE_URL ausente; teste de segredos de gateway ignorado.");
        return;
    };

    let chave = ChaveMestra::from_hex(HEX_CHAVE).expect("chave de teste");
    let tenant_a = criar_tenant(&pool, "Escola A").await;
    let tenant_b = criar_tenant(&pool, "Escola B").await;

    let mut conn_a = acquire_tenant(&pool, tenant_a)
        .await
        .expect("conexão tenant A");
    sqlx::query("SET ROLE escolar_runtime")
        .execute(&mut *conn_a)
        .await
        .expect("assumir papel de runtime");

    assert!(ler(
        &mut conn_a,
        &chave,
        tenant_a,
        GATEWAY,
        TipoSegredo::ClientSecret
    )
    .await
    .expect("ler vazio")
    .is_none());
    assert!(
        !existe(&mut conn_a, tenant_a, GATEWAY, TipoSegredo::ClientSecret)
            .await
            .expect("existe vazio")
    );

    salvar(
        &mut conn_a,
        &chave,
        tenant_a,
        GATEWAY,
        TipoSegredo::ClientSecret,
        b"segredo-a",
        None,
    )
    .await
    .expect("salvar segredo A");
    assert_eq!(
        ler(
            &mut conn_a,
            &chave,
            tenant_a,
            GATEWAY,
            TipoSegredo::ClientSecret
        )
        .await
        .expect("ler segredo A"),
        Some(b"segredo-a".to_vec())
    );
    assert!(
        existe(&mut conn_a, tenant_a, GATEWAY, TipoSegredo::ClientSecret)
            .await
            .expect("existe segredo A")
    );

    salvar(
        &mut conn_a,
        &chave,
        tenant_a,
        GATEWAY,
        TipoSegredo::ClientSecret,
        b"segredo-a-novo",
        None,
    )
    .await
    .expect("upsert segredo A");
    assert_eq!(
        ler(
            &mut conn_a,
            &chave,
            tenant_a,
            GATEWAY,
            TipoSegredo::ClientSecret
        )
        .await
        .expect("ler após upsert"),
        Some(b"segredo-a-novo".to_vec())
    );

    let linhas: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM tenant_gateway_secrets WHERE tenant_id = $1 AND tipo = 'client_secret'",
    )
    .bind(tenant_a)
    .fetch_one(&pool)
    .await
    .expect("contar linhas");
    assert_eq!(linhas, 1);

    let bruto: Vec<u8> = sqlx::query_scalar(
        "SELECT ciphertext FROM tenant_gateway_secrets WHERE tenant_id = $1 AND tipo = 'client_secret'",
    )
    .bind(tenant_a)
    .fetch_one(&pool)
    .await
    .expect("ler ciphertext bruto");
    assert_ne!(bruto, b"segredo-a-novo".to_vec());

    let mut conn_b = acquire_tenant(&pool, tenant_b)
        .await
        .expect("conexão tenant B");
    sqlx::query("SET ROLE escolar_runtime")
        .execute(&mut *conn_b)
        .await
        .expect("assumir papel de runtime B");

    assert!(ler(
        &mut conn_b,
        &chave,
        tenant_a,
        GATEWAY,
        TipoSegredo::ClientSecret
    )
    .await
    .expect("tenant B lendo tenant A")
    .is_none());
    assert!(
        !existe(&mut conn_b, tenant_a, GATEWAY, TipoSegredo::ClientSecret)
            .await
            .expect("tenant B existe tenant A")
    );
    assert!(salvar(
        &mut conn_b,
        &chave,
        tenant_a,
        GATEWAY,
        TipoSegredo::ClientSecret,
        b"invasao",
        None,
    )
    .await
    .is_err());

    salvar(
        &mut conn_b,
        &chave,
        tenant_b,
        GATEWAY,
        TipoSegredo::ClientSecret,
        b"segredo-b",
        None,
    )
    .await
    .expect("salvar segredo B");
    assert_eq!(
        ler(
            &mut conn_b,
            &chave,
            tenant_b,
            GATEWAY,
            TipoSegredo::ClientSecret
        )
        .await
        .expect("ler segredo B"),
        Some(b"segredo-b".to_vec())
    );
    assert_eq!(
        ler(
            &mut conn_a,
            &chave,
            tenant_a,
            GATEWAY,
            TipoSegredo::ClientSecret
        )
        .await
        .expect("tenant A continua com o seu"),
        Some(b"segredo-a-novo".to_vec())
    );

    apagar(&mut conn_a, tenant_a, GATEWAY, TipoSegredo::ClientSecret)
        .await
        .expect("apagar segredo A");
    assert!(
        !existe(&mut conn_a, tenant_a, GATEWAY, TipoSegredo::ClientSecret)
            .await
            .expect("existe após apagar")
    );
    assert!(ler(
        &mut conn_a,
        &chave,
        tenant_a,
        GATEWAY,
        TipoSegredo::ClientSecret
    )
    .await
    .expect("ler após apagar")
    .is_none());
    assert!(
        existe(&mut conn_b, tenant_b, GATEWAY, TipoSegredo::ClientSecret)
            .await
            .expect("segredo B preservado")
    );

    drop(conn_a);
    drop(conn_b);
    drop_database(&admin, &db_name).await;
}
