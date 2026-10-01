import os

secretaria_handlers = """

pub async fn criar_autorizado_retirada(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::secretaria::CreateAutorizadoRetiradaDto>,
) -> Result<axum::Json<crate::models::secretaria::AutorizadoRetirada>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "responsavel"])?;
    let tenant_id = active_tenant.0;

    crate::middleware::rbac::check_aluno_ownership(&state.pool, &auth_user, dto.aluno_id).await?;

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
    .fetch_one(&state.pool)
    .await?;

    crate::middleware::rbac::log_audit(&state.pool, tenant_id, Some(auth_user.id), "CRIAR_AUTORIZADO_RETIRADA", "autorizados_retirada", Some(autorizado.id.to_string()), Some(serde_json::json!({"aluno_id": dto.aluno_id, "nome": dto.nome}))).await;

    Ok(axum::Json(autorizado))
}

pub async fn listar_autorizados_retirada(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(aluno_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::secretaria::AutorizadoRetirada>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor", "responsavel"])?;
    let tenant_id = active_tenant.0;

    crate::middleware::rbac::check_aluno_ownership(&state.pool, &auth_user, aluno_id).await?;

    let autorizados = sqlx::query_as::<_, crate::models::secretaria::AutorizadoRetirada>(
        "SELECT * FROM autorizados_retirada WHERE tenant_id = $1 AND aluno_id = $2 AND ativo = true"
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(axum::Json(autorizados))
}
"""

with open('src/handlers/secretaria.rs', 'a', encoding='utf-8') as f:
    f.write(secretaria_handlers)

agenda_handlers = """

pub async fn criar_autorizacao_medicamento(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::agenda_admin::CreateAutorizacaoMedicamentoDto>,
) -> Result<axum::Json<crate::models::agenda_admin::AutorizacaoMedicamento>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "responsavel"])?;
    let tenant_id = active_tenant.0;

    crate::middleware::rbac::check_aluno_ownership(&state.pool, &auth_user, dto.aluno_id).await?;

    let auth_med = sqlx::query_as::<_, crate::models::agenda_admin::AutorizacaoMedicamento>(
        r#"
        INSERT INTO autorizacoes_medicamento (tenant_id, aluno_id, responsavel_id, medicamento, dosagem, horario_aplicacao, receita_medica_url, observacoes, data_inicio, data_fim)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(auth_user.id)
    .bind(&dto.medicamento)
    .bind(&dto.dosagem)
    .bind(&dto.horario_aplicacao)
    .bind(&dto.receita_medica_url)
    .bind(&dto.observacoes)
    .bind(dto.data_inicio)
    .bind(dto.data_fim)
    .fetch_one(&state.pool)
    .await?;

    crate::middleware::rbac::log_audit(&state.pool, tenant_id, Some(auth_user.id), "CRIAR_AUTORIZACAO_MEDICAMENTO", "autorizacoes_medicamento", Some(auth_med.id.to_string()), Some(serde_json::json!({"aluno_id": dto.aluno_id, "medicamento": dto.medicamento}))).await;

    Ok(axum::Json(auth_med))
}
"""

with open('src/handlers/agenda_admin.rs', 'a', encoding='utf-8') as f:
    f.write(agenda_handlers)

academico_handlers = """

pub async fn registrar_portfolio_infantil(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::academico::CreatePortfolioInfantilDto>,
) -> Result<axum::Json<crate::models::academico::PortfolioInfantil>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "professor", "gestor"])?;
    let tenant_id = active_tenant.0;
    let data_registro = dto.data_registro.unwrap_or_else(|| chrono::Utc::now().date_naive());

    let portfolio = sqlx::query_as::<_, crate::models::academico::PortfolioInfantil>(
        r#"
        INSERT INTO portfolio_infantil (tenant_id, aluno_id, professor_id, turma_id, data_registro, titulo, descricao, midia_url, campos_experiencia_bncc)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(auth_user.id)
    .bind(dto.turma_id)
    .bind(data_registro)
    .bind(&dto.titulo)
    .bind(&dto.descricao)
    .bind(&dto.midia_url)
    .bind(&dto.campos_experiencia_bncc)
    .fetch_one(&state.pool)
    .await?;

    crate::middleware::rbac::log_audit(&state.pool, tenant_id, Some(auth_user.id), "REGISTRAR_PORTFOLIO", "portfolio_infantil", Some(portfolio.id.to_string()), Some(serde_json::json!({"aluno_id": dto.aluno_id, "titulo": dto.titulo}))).await;

    Ok(axum::Json(portfolio))
}
"""

with open('src/handlers/academico.rs', 'a', encoding='utf-8') as f:
    f.write(academico_handlers)

