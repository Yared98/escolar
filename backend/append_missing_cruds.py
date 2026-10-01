import os

secretaria_handlers = """
pub async fn atualizar_autorizado_retirada(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path((aluno_id, autorizado_id)): axum::extract::Path<(Uuid, Uuid)>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::secretaria::CreateAutorizadoRetiradaDto>,
) -> Result<axum::Json<crate::models::secretaria::AutorizadoRetirada>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "responsavel"])?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&state.pool, &auth_user, aluno_id).await?;

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
    .fetch_one(&state.pool)
    .await?;

    crate::middleware::rbac::log_audit(&state.pool, tenant_id, Some(auth_user.id), "ATUALIZAR_AUTORIZADO_RETIRADA", "autorizados_retirada", Some(autorizado.id.to_string()), Some(serde_json::json!({"aluno_id": aluno_id, "nome": dto.nome}))).await;

    Ok(axum::Json(autorizado))
}

pub async fn deletar_autorizado_retirada(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path((aluno_id, autorizado_id)): axum::extract::Path<(Uuid, Uuid)>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "responsavel"])?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&state.pool, &auth_user, aluno_id).await?;

    sqlx::query(
        "UPDATE autorizados_retirada SET ativo = false WHERE id = $1 AND tenant_id = $2 AND aluno_id = $3"
    )
    .bind(autorizado_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .execute(&state.pool)
    .await?;

    crate::middleware::rbac::log_audit(&state.pool, tenant_id, Some(auth_user.id), "DELETAR_AUTORIZADO_RETIRADA", "autorizados_retirada", Some(autorizado_id.to_string()), Some(serde_json::json!({"aluno_id": aluno_id}))).await;

    Ok(axum::Json(serde_json::json!({"status": "sucesso"})))
}

pub async fn criar_grupo_familiar(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::secretaria::CreateGrupoFamiliarDto>,
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
    .fetch_one(&state.pool)
    .await?;

    crate::middleware::rbac::log_audit(&state.pool, tenant_id, Some(auth_user.id), "CRIAR_GRUPO_FAMILIAR", "grupos_familiares", Some(grupo.id.to_string()), Some(serde_json::json!({"nome": dto.nome_familia}))).await;

    Ok(axum::Json(grupo))
}

pub async fn listar_grupos_familiares(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<axum::Json<Vec<crate::models::secretaria::GrupoFamiliar>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let grupos = sqlx::query_as::<_, crate::models::secretaria::GrupoFamiliar>(
        "SELECT * FROM grupos_familiares WHERE tenant_id = $1"
    )
    .bind(tenant_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(axum::Json(grupos))
}
"""

with open('src/handlers/secretaria.rs', 'a', encoding='utf-8') as f:
    f.write(secretaria_handlers)

agenda_handlers = """
pub async fn listar_autorizacoes_medicamento(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(aluno_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::agenda_admin::AutorizacaoMedicamento>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "professor", "responsavel"])?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&state.pool, &auth_user, aluno_id).await?;

    let auths = sqlx::query_as::<_, crate::models::agenda_admin::AutorizacaoMedicamento>(
        "SELECT * FROM autorizacoes_medicamento WHERE tenant_id = $1 AND aluno_id = $2 ORDER BY created_at DESC"
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(axum::Json(auths))
}

pub async fn atualizar_status_medicamento(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path((aluno_id, auth_id)): axum::extract::Path<(Uuid, Uuid)>,
    axum::extract::Json(payload): axum::extract::Json<serde_json::Value>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "professor"])?;
    let tenant_id = active_tenant.0;
    
    let status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("aplicado");

    sqlx::query(
        "UPDATE autorizacoes_medicamento SET status = $1 WHERE id = $2 AND tenant_id = $3 AND aluno_id = $4"
    )
    .bind(status)
    .bind(auth_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .execute(&state.pool)
    .await?;

    crate::middleware::rbac::log_audit(&state.pool, tenant_id, Some(auth_user.id), "ATUALIZAR_STATUS_MEDICAMENTO", "autorizacoes_medicamento", Some(auth_id.to_string()), Some(serde_json::json!({"aluno_id": aluno_id, "status": status}))).await;

    Ok(axum::Json(serde_json::json!({"status": "sucesso"})))
}
"""

with open('src/handlers/agenda_admin.rs', 'a', encoding='utf-8') as f:
    f.write(agenda_handlers)

academico_handlers = """
pub async fn listar_portfolio_infantil(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(aluno_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::academico::PortfolioInfantil>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "professor", "gestor", "responsavel"])?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&state.pool, &auth_user, aluno_id).await?;

    let port = sqlx::query_as::<_, crate::models::academico::PortfolioInfantil>(
        "SELECT * FROM portfolio_infantil WHERE tenant_id = $1 AND aluno_id = $2 ORDER BY data_registro DESC"
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(axum::Json(port))
}
"""

with open('src/handlers/academico.rs', 'a', encoding='utf-8') as f:
    f.write(academico_handlers)
