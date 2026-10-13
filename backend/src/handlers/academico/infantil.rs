use axum::{extract::State, Extension, Json};
use serde_json::json;
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
    models::academico::{
        Cardapio, CreateCardapioDto, CreateProjetoEducacionalDto, ProjetoEducacional,
    },
};

pub async fn criar_projeto_educacional(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateProjetoEducacionalDto>,
) -> Result<Json<ProjetoEducacional>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    let projeto = sqlx::query_as::<_, ProjetoEducacional>(
        r#"
        INSERT INTO projetos_educacionais (tenant_id, turma_id, professor_id, titulo, objetivo, habilidades_bncc, data_inicio, data_fim, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'em_andamento')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(auth_user.id)
    .bind(&dto.titulo)
    .bind(&dto.objetivo)
    .bind(&dto.habilidades_bncc)
    .bind(dto.data_inicio)
    .bind(dto.data_fim)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_PROJETO_EDUCACIONAL",
        "projetos_educacionais",
        Some(projeto.id.to_string()),
        Some(json!({ "titulo": projeto.titulo })),
    )
    .await;

    Ok(Json(projeto))
}

pub async fn listar_projetos_educacionais(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<ProjetoEducacional>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "professor", "secretaria", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let projetos = sqlx::query_as::<_, ProjetoEducacional>(
        "SELECT * FROM projetos_educacionais WHERE tenant_id = $1 ORDER BY data_inicio DESC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(projetos))
}

pub async fn criar_cardapio_nutricao(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateCardapioDto>,
) -> Result<Json<Cardapio>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    let tenant_id = active_tenant.0;
    let nutricionista_nome = sqlx::query_scalar::<_, String>(
        "SELECT nome FROM funcionarios WHERE id = $1 AND tenant_id = $2 AND status = 'ativo'",
    )
    .bind(dto.nutricionista_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Nutricionista inativo ou não cadastrado no RH deste tenant.".into())
    })?;

    let cardapio = sqlx::query_as::<_, Cardapio>(
        r#"
        INSERT INTO cardapios (tenant_id, turma_id, semana_ano, data_dia, tipo_refeicao, titulo_menu, descricao_ingredientes, alergicos_atencao, nutricionista_id, nutricionista_responsavel)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(&dto.semana_ano)
    .bind(dto.data_dia)
    .bind(&dto.tipo_refeicao)
    .bind(&dto.titulo_menu)
    .bind(&dto.descricao_ingredientes)
    .bind(&dto.alergicos_atencao)
    .bind(dto.nutricionista_id)
    .bind(&nutricionista_nome)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_CARDAPIO_NUTRICAO",
        "cardapios",
        Some(cardapio.id.to_string()),
        Some(json!({ "titulo_menu": cardapio.titulo_menu, "data_dia": cardapio.data_dia })),
    )
    .await;

    Ok(Json(cardapio))
}

pub async fn listar_cardapios_nutricao(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Cardapio>>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "nutricionista",
            "professor",
            "responsavel",
        ],
    )?;
    let tenant_id = active_tenant.0;

    let cardapios = sqlx::query_as::<_, Cardapio>(
        "SELECT * FROM cardapios WHERE tenant_id = $1 ORDER BY data_dia DESC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(cardapios))
}

pub async fn registrar_portfolio_infantil(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<
        crate::models::academico::CreatePortfolioInfantilDto,
    >,
) -> Result<axum::Json<crate::models::academico::PortfolioInfantil>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "professor", "gestor"])?;
    let tenant_id = active_tenant.0;
    let data_registro = dto
        .data_registro
        .unwrap_or_else(|| chrono::Utc::now().date_naive());

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
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "REGISTRAR_PORTFOLIO",
        "portfolio_infantil",
        Some(portfolio.id.to_string()),
        Some(serde_json::json!({"aluno_id": dto.aluno_id, "titulo": dto.titulo})),
    )
    .await;

    Ok(axum::Json(portfolio))
}

pub async fn listar_portfolio_infantil(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(aluno_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::academico::PortfolioInfantil>>, AppError> {
    crate::middleware::rbac::check_roles(
        &auth_user,
        &["admin", "professor", "gestor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let port = sqlx::query_as::<_, crate::models::academico::PortfolioInfantil>(
        "SELECT * FROM portfolio_infantil WHERE tenant_id = $1 AND aluno_id = $2 ORDER BY data_registro DESC"
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(axum::Json(port))
}
