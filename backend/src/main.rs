use std::net::SocketAddr;
use std::str::FromStr;

use sqlx::postgres::PgConnectOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use escolar_backend::{
    config::{AppState, Config},
    db::{init_admin_pool, init_runtime_pool, verify_pool_security},
    routes::create_router,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                escolar_backend::middleware::log_redaction::default_log_filter(
                    std::env::var("APP_ENV").ok().as_deref(),
                )
                .into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Inicializando o servidor Escolar ERP Backend...");

    let config = Config::from_env()?;

    if let Ok(opts) = PgConnectOptions::from_str(&config.database_url) {
        tracing::info!(
            "Conectando ao PostgreSQL em {}:{}/{}...",
            opts.get_host(),
            opts.get_port(),
            opts.get_database().unwrap_or("escolar_db")
        );
    } else {
        tracing::info!("Conectando ao PostgreSQL...");
    }

    let pool = match init_admin_pool(&config.database_url).await {
        Ok(admin_pool) => {
            tracing::info!("Conexão ativa com PostgreSQL estabelecida!");
            let migrator = escolar_backend::db::prepare_migrator(
                sqlx::migrate!("./migrations"),
                config.is_production(),
            );
            if let Err(e) = migrator.run(&admin_pool).await {
                if config.is_production() {
                    tracing::error!("Erro fatal ao executar migrations SQLx em produção: {}", e);
                    return Err(Box::new(e) as Box<dyn std::error::Error>);
                } else {
                    tracing::warn!("Aviso ao executar migrations SQLx: {}", e);
                }
            } else {
                tracing::info!("Migrations SQLx executadas com sucesso!");
            }

            if config.is_production() {
                let demo_exists: Option<bool> = sqlx::query_scalar(
                    "SELECT EXISTS(SELECT 1 FROM tenants WHERE slug = 'escola-modelo')",
                )
                .fetch_optional(&admin_pool)
                .await
                .ok()
                .flatten();

                if demo_exists == Some(true) {
                    tracing::error!(
                        "ALERTA DE SEGURANÇA: Tenant demo 'escola-modelo' (com senha conhecida) existe no banco em ambiente de produção!"
                    );
                }
            }

            match init_runtime_pool(&config.database_url).await {
                Ok(runtime_pool) => {
                    tracing::info!("Pool de execução isolado com o papel escolar_runtime.");
                    if let Err(e) =
                        verify_pool_security(&runtime_pool, config.is_production()).await
                    {
                        tracing::error!("{}", e);
                        return Err(e.into());
                    }
                    runtime_pool
                }
                Err(e) => {
                    if config.is_production() {
                        tracing::error!(
                            "Erro fatal: pool com SET ROLE escolar_runtime indisponível em produção: {}",
                            e
                        );
                        return Err(Box::new(e) as Box<dyn std::error::Error>);
                    } else {
                        tracing::error!(
                            "Pool com SET ROLE escolar_runtime indisponível ({}). O isolamento RLS pode não ser aplicado.",
                            e
                        );
                        if let Err(e_sec) =
                            verify_pool_security(&admin_pool, config.is_production()).await
                        {
                            tracing::error!("{}", e_sec);
                        }
                        admin_pool
                    }
                }
            }
        }
        Err(e) => {
            if config.is_production() {
                tracing::error!(
                    "Erro fatal: falha ao conectar no PostgreSQL em produção: {}",
                    e
                );
                return Err(Box::new(e) as Box<dyn std::error::Error>);
            } else {
                tracing::warn!(
                    "PostgreSQL offline ({}) - utilizando Pool Laziest para manter o HTTP Server ativo.",
                    e
                );
                sqlx::postgres::PgPoolOptions::new()
                    .connect_lazy(&config.database_url)
                    .expect("lazy pool creation")
            }
        }
    };

    let state = AppState {
        pool,
        config: config.clone(),
        message_hub: escolar_backend::realtime::MessageHub::default(),
        ip_rate_limiter: escolar_backend::middleware::security::IpRateLimiter::default(),
    };

    if config.itau_mode != escolar_backend::config::ItauMode::Mock {
        escolar_backend::services::itau_avisos::iniciar_reprocessador_avisos(state.clone());
    }

    let app = create_router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Servidor Escolar ERP Backend rodando em http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
