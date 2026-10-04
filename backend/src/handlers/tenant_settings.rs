use crate::db::TenantDb;
use crate::error::AppError;
use crate::middleware::{auth::AuthUser, tenant::ActiveTenant};
use crate::AppState;
use axum::{
    extract::{Extension, State},
    Json,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct BankIntegrationDto {
    pub gateway_name: String,
    pub client_id: String,
    #[serde(default)]
    pub client_secret: String,
    pub webhook_secret: Option<String>,
    pub is_active: bool,
}

#[derive(Serialize)]
pub struct BankIntegrationView {
    pub gateway_name: String,
    pub client_id: String,
    pub has_client_secret: bool,
    pub has_webhook_secret: bool,
    pub is_active: bool,
    pub modo_gateway: String,
}

pub async fn get_bank_integrations(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<BankIntegrationView>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor"])?;

    let rows = sqlx::query_as::<_, (String, String, bool, bool, bool)>(
        r#"
        SELECT gateway_name, client_id,
               client_secret <> '',
               webhook_secret IS NOT NULL AND webhook_secret <> '',
               is_active
        FROM tenant_bank_integrations
        WHERE tenant_id = $1
        "#,
    )
    .bind(active_tenant.0)
    .fetch_all(&mut *db)
    .await?;

    let modo_gateway = state.config.cora_mode.to_string();

    let integrations = rows
        .into_iter()
        .map(
            |(g, ci, has_secret, has_webhook, act)| BankIntegrationView {
                gateway_name: g,
                client_id: ci,
                has_client_secret: has_secret,
                has_webhook_secret: has_webhook,
                is_active: act,
                modo_gateway: modo_gateway.clone(),
            },
        )
        .collect();

    Ok(Json(integrations))
}

pub async fn save_bank_integration(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<BankIntegrationDto>,
) -> Result<Json<serde_json::Value>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor"])?;

    if dto.is_active {
        // Desativa outras caso essa esteja sendo ativada
        sqlx::query("UPDATE tenant_bank_integrations SET is_active = false WHERE tenant_id = $1")
            .bind(active_tenant.0)
            .execute(&mut *db)
            .await?;
    }

    sqlx::query(
        r#"
        INSERT INTO tenant_bank_integrations (tenant_id, gateway_name, client_id, client_secret, webhook_secret, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id, gateway_name) 
        DO UPDATE SET
            client_id = EXCLUDED.client_id,
            client_secret = CASE
                WHEN EXCLUDED.client_secret = '' THEN tenant_bank_integrations.client_secret
                ELSE EXCLUDED.client_secret
            END,
            webhook_secret = COALESCE(EXCLUDED.webhook_secret, tenant_bank_integrations.webhook_secret),
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
        "#
    )
    .bind(active_tenant.0)
    .bind(&dto.gateway_name)
    .bind(&dto.client_id)
    .bind(&dto.client_secret)
    .bind(&dto.webhook_secret)
    .bind(dto.is_active)
    .execute(&mut *db)
    .await?;

    Ok(Json(serde_json::json!({"status": "success"})))
}
