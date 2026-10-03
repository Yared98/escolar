use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use escolar_backend::{
    config::{AppState, Config},
    db::{init_admin_pool, init_runtime_pool},
    routes::create_router,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "escolar_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Inicializando o servidor Escolar ERP Backend...");

    let config = Config::from_env()?;

    tracing::info!("Conectando ao PostgreSQL em: {}", config.database_url);
    let pool = match init_admin_pool(&config.database_url).await {
        Ok(admin_pool) => {
            tracing::info!("Conexão ativa com PostgreSQL estabelecida!");
            if let Err(e) = sqlx::migrate!("./migrations").run(&admin_pool).await {
                tracing::warn!("Aviso ao executar migrations SQLx: {}", e);
            } else {
                tracing::info!("Migrations SQLx executadas com sucesso!");
            }
            match init_runtime_pool(&config.database_url).await {
                Ok(runtime_pool) => {
                    tracing::info!("Pool de execução isolado com o papel escolar_runtime.");
                    runtime_pool
                }
                Err(e) => {
                    tracing::error!(
                        "Pool com SET ROLE escolar_runtime indisponível ({}). O isolamento RLS pode não ser aplicado.",
                        e
                    );
                    admin_pool
                }
            }
        }
        Err(e) => {
            tracing::warn!("PostgreSQL offline ({}) - utilizando Pool Laziest para manter o HTTP Server ativo.", e);
            sqlx::postgres::PgPoolOptions::new()
                .connect_lazy(&config.database_url)
                .expect("lazy pool creation")
        }
    };

    let state = AppState {
        pool,
        config: config.clone(),
        message_hub: escolar_backend::realtime::MessageHub::default(),
    };

    let app = create_router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Servidor Escolar ERP Backend rodando em http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
