use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::secretaria::{CreateSalaDto, Sala},
};

pub async fn listar_salas(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Sala>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let salas =
        sqlx::query_as::<_, Sala>("SELECT * FROM salas WHERE tenant_id = $1 ORDER BY nome ASC")
            .bind(tenant_id)
            .fetch_all(&mut *db)
            .await?;

    Ok(Json(salas))
}

pub async fn criar_sala(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateSalaDto>,
) -> Result<Json<Sala>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;
    let cap = dto.capacidade.unwrap_or(30);

    let sala = sqlx::query_as::<_, Sala>(
        r#"
        INSERT INTO salas (tenant_id, nome, capacidade)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.nome)
    .bind(cap)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_SALA",
        "salas",
        Some(sala.id.to_string()),
        Some(json!({ "nome": sala.nome, "capacidade": sala.capacidade })),
    )
    .await;

    Ok(Json(sala))
}

pub async fn deletar_sala(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(sala_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let res = sqlx::query("DELETE FROM salas WHERE id = $1 AND tenant_id = $2")
        .bind(sala_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DELETAR_SALA",
        "salas",
        Some(sala_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Sala removida com sucesso." }),
    ))
}
