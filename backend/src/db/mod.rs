use axum::{extract::{FromRef, FromRequestParts}, http::request::Parts};
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;
use uuid::Uuid;

use crate::config::AppState;
use crate::error::AppError;
use crate::middleware::tenant::ActiveTenant;

fn pool_options() -> PgPoolOptions {
    PgPoolOptions::new()
        .max_connections(25)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .after_release(|conn, _meta| {
            Box::pin(async move {
                sqlx::query("SELECT set_config('app.current_tenant', '', false)")
                    .execute(&mut *conn)
                    .await?;
                Ok(true)
            })
        })
}

pub async fn init_admin_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    pool_options().connect(database_url).await
}

pub async fn init_runtime_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    pool_options()
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                sqlx::query("SET ROLE escolar_runtime")
                    .execute(&mut *conn)
                    .await?;
                Ok(())
            })
        })
        .connect(database_url)
        .await
}

async fn apply_tenant(
    conn: &mut sqlx::pool::PoolConnection<sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query("SELECT set_config('app.current_tenant', $1, false)")
        .bind(tenant_id.to_string())
        .execute(&mut **conn)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    Ok(())
}

pub async fn acquire_tenant(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<sqlx::pool::PoolConnection<sqlx::Postgres>, AppError> {
    let mut conn = pool
        .acquire()
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    apply_tenant(&mut conn, tenant_id).await?;
    Ok(conn)
}

pub async fn resolve_public_tenant(
    pool: &PgPool,
    tenant_id: Option<Uuid>,
    tenant_slug: Option<&str>,
    header_tenant: Option<&str>,
) -> Result<Uuid, AppError> {
    if let Some(id) = tenant_id {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tenants WHERE id = $1)")
            .bind(id)
            .fetch_one(pool)
            .await?;
        if !exists {
            return Err(AppError::TenantNotFound);
        }
        return Ok(id);
    }

    if let Some(slug) = tenant_slug.map(str::trim).filter(|slug| !slug.is_empty()) {
        return sqlx::query_scalar("SELECT id FROM tenants WHERE slug = $1")
            .bind(slug.to_lowercase())
            .fetch_optional(pool)
            .await?
            .ok_or(AppError::TenantNotFound);
    }

    if let Some(header) = header_tenant.map(str::trim).filter(|value| !value.is_empty()) {
        let id = Uuid::parse_str(header)
            .map_err(|_| AppError::BadRequest("Header X-Tenant-ID malformado.".into()))?;
        return Box::pin(resolve_public_tenant(pool, Some(id), None, None)).await;
    }

    Err(AppError::BadRequest(
        "Informe tenant_id, tenant_slug ou o header X-Tenant-ID.".into(),
    ))
}

pub struct TenantDb(pub sqlx::pool::PoolConnection<sqlx::Postgres>);

#[axum::async_trait]
impl<S> FromRequestParts<S> for TenantDb
where
    S: Send + Sync,
    AppState: FromRef<S>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);
        let active_tenant = parts
            .extensions
            .get::<ActiveTenant>()
            .ok_or_else(|| AppError::Unauthorized("Tenant não identificado".into()))?;

        let conn = acquire_tenant(&app_state.pool, active_tenant.0).await?;
        Ok(TenantDb(conn))
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn rls_migration_fails_closed_without_null_bypass() {
        let sql = include_str!("../../migrations/20260929000000_security_foundation.sql");
        assert!(!sql.contains("get_current_tenant() IS NULL"));
        assert!(sql.contains("FORCE ROW LEVEL SECURITY"));
        assert!(sql.contains("tenant_id = get_current_tenant()"));
        assert!(sql.contains("SET ROLE escolar_runtime") || sql.contains("CREATE ROLE escolar_runtime"));
    }
}
