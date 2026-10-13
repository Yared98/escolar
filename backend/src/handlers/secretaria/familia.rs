use axum::{extract::State, Extension};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{auth::AuthUser, tenant::ActiveTenant},
};

pub async fn criar_autorizado_retirada(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<
        crate::models::secretaria::CreateAutorizadoRetiradaDto,
    >,
) -> Result<axum::Json<crate::models::secretaria::AutorizadoRetirada>, AppError> {
    crate::middleware::rbac::check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, dto.aluno_id).await?;

    let autorizado = sqlx::query_as::<_, crate::models::secretaria::AutorizadoRetirada>(
        r#"
        INSERT INTO autorizados_retirada (tenant_id, aluno_id, nome, rg_cpf, grau_parentesco, foto_url, telefone, autorizado_por)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.nome)
    .bind(&dto.rg_cpf)
    .bind(&dto.grau_parentesco)
    .bind(&dto.foto_url)
    .bind(&dto.telefone)
    .bind(auth_user.id)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_AUTORIZADO_RETIRADA",
        "autorizados_retirada",
        Some(autorizado.id.to_string()),
        Some(serde_json::json!({"aluno_id": dto.aluno_id, "nome": dto.nome})),
    )
    .await;

    Ok(axum::Json(autorizado))
}

pub async fn listar_autorizados_retirada(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(aluno_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::secretaria::AutorizadoRetirada>>, AppError> {
    crate::middleware::rbac::check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let autorizados = sqlx::query_as::<_, crate::models::secretaria::AutorizadoRetirada>(
        "SELECT * FROM autorizados_retirada WHERE tenant_id = $1 AND aluno_id = $2 AND ativo = true"
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(axum::Json(autorizados))
}

pub async fn atualizar_autorizado_retirada(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path((aluno_id, autorizado_id)): axum::extract::Path<(Uuid, Uuid)>,
    axum::extract::Json(dto): axum::extract::Json<
        crate::models::secretaria::CreateAutorizadoRetiradaDto,
    >,
) -> Result<axum::Json<crate::models::secretaria::AutorizadoRetirada>, AppError> {
    crate::middleware::rbac::check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let autorizado = sqlx::query_as::<_, crate::models::secretaria::AutorizadoRetirada>(
        r#"
        UPDATE autorizados_retirada
        SET nome = $1, rg_cpf = $2, grau_parentesco = $3, foto_url = $4, telefone = $5
        WHERE id = $6 AND tenant_id = $7 AND aluno_id = $8
        RETURNING *
        "#,
    )
    .bind(&dto.nome)
    .bind(&dto.rg_cpf)
    .bind(&dto.grau_parentesco)
    .bind(&dto.foto_url)
    .bind(&dto.telefone)
    .bind(autorizado_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_AUTORIZADO_RETIRADA",
        "autorizados_retirada",
        Some(autorizado.id.to_string()),
        Some(serde_json::json!({"aluno_id": aluno_id, "nome": dto.nome})),
    )
    .await;

    Ok(axum::Json(autorizado))
}

pub async fn deletar_autorizado_retirada(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path((aluno_id, autorizado_id)): axum::extract::Path<(Uuid, Uuid)>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    crate::middleware::rbac::check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    sqlx::query(
        "UPDATE autorizados_retirada SET ativo = false WHERE id = $1 AND tenant_id = $2 AND aluno_id = $3"
    )
    .bind(autorizado_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .execute(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DELETAR_AUTORIZADO_RETIRADA",
        "autorizados_retirada",
        Some(autorizado_id.to_string()),
        Some(serde_json::json!({"aluno_id": aluno_id})),
    )
    .await;

    Ok(axum::Json(serde_json::json!({"status": "sucesso"})))
}

pub async fn criar_grupo_familiar(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<
        crate::models::secretaria::CreateGrupoFamiliarDto,
    >,
) -> Result<axum::Json<crate::models::secretaria::GrupoFamiliar>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let grupo = sqlx::query_as::<_, crate::models::secretaria::GrupoFamiliar>(
        r#"
        INSERT INTO grupos_familiares (tenant_id, responsavel_financeiro_id, nome_familia, desconto_percentual)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.responsavel_financeiro_id)
    .bind(&dto.nome_familia)
    .bind(dto.desconto_percentual)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_GRUPO_FAMILIAR",
        "grupos_familiares",
        Some(grupo.id.to_string()),
        Some(serde_json::json!({"nome": dto.nome_familia})),
    )
    .await;

    Ok(axum::Json(grupo))
}

pub async fn listar_grupos_familiares(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<axum::Json<Vec<crate::models::secretaria::GrupoFamiliar>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let grupos = sqlx::query_as::<_, crate::models::secretaria::GrupoFamiliar>(
        "SELECT * FROM grupos_familiares WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(axum::Json(grupos))
}
