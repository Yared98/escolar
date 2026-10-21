use axum::{
    extract::{Extension, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{auth::AuthUser, rbac::check_roles, tenant::ActiveTenant},
};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ItauStatusDto {
    pub modo: String,
    pub ativo: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CoraStatusDto {
    pub modo: String,
    pub disponivel: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct IntegracoesStatusDto {
    pub itau: ItauStatusDto,
    pub cora: CoraStatusDto,
}

/// GET /api/v1/financeiro/integracoes/status
pub async fn obter_status_integracoes(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<IntegracoesStatusDto>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "financeiro"])?;

    let ativo = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT ativo
        FROM tenant_itau_config
        WHERE tenant_id = $1
        "#,
    )
    .bind(active_tenant.0)
    .fetch_optional(&mut *db)
    .await?
    .unwrap_or(false);

    let disponivel = state.config.cora_configured_for(state.config.cora_mode);

    Ok(Json(IntegracoesStatusDto {
        itau: ItauStatusDto {
            modo: state.config.itau_mode.to_string(),
            ativo,
        },
        cora: CoraStatusDto {
            modo: state.config.cora_mode.to_string(),
            disponivel,
        },
    }))
}
