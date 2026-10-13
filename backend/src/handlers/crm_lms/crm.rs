use axum::{
    extract::{Path, Query, State},
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
    models::crm_lms::{
        CreateInteracaoDto, CreateLeadDto, Lead, LeadInteracao, RelatorioFunilResponse,
        UpdateLeadDto,
    },
};

#[derive(Debug, serde::Deserialize)]
pub struct ListLeadsQuery {
    pub estagio: Option<String>,
    pub canal: Option<String>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct CreateLeadPublicDto {
    pub tenant_id: Option<Uuid>,
    pub tenant_slug: Option<String>,
    pub nome: String,
    pub email: String,
    pub telefone: String,
    pub canal_aquisicao: Option<String>,
    pub observacoes: Option<String>,
}

pub async fn criar_lead(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateLeadDto>,
) -> Result<Json<Lead>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let estagio = dto.estagio_funil.unwrap_or_else(|| "novo_lead".to_string());
    let custo = dto.custo_aquisicao.unwrap_or(0.0);
    let canal = dto.canal_aquisicao.unwrap_or_else(|| "site".to_string());

    // Desduplicação de leads no tenant
    let existing_lead = sqlx::query_as::<_, Lead>(
        "SELECT * FROM leads WHERE tenant_id = $1 AND (email = $2 OR telefone = $3) ORDER BY created_at ASC LIMIT 1"
    )
    .bind(tenant_id)
    .bind(&dto.email)
    .bind(&dto.telefone)
    .fetch_optional(&mut *db)
    .await?;

    if let Some(mut lead) = existing_lead {
        let _ = sqlx::query("UPDATE leads SET updated_at = NOW() WHERE id = $1")
            .bind(lead.id)
            .execute(&mut *db)
            .await;

        let _ = sqlx::query(
            r#"
            INSERT INTO lead_interacoes (tenant_id, lead_id, tipo, descricao, usuario_id)
            VALUES ($1, $2, 'retorno', 'Contato subsequente registrado no funil comercial', $3)
            "#,
        )
        .bind(tenant_id)
        .bind(lead.id)
        .bind(auth_user.id)
        .execute(&mut *db)
        .await;

        lead.updated_at = Some(chrono::Utc::now());
        return Ok(Json(lead));
    }

    let lead = sqlx::query_as::<_, Lead>(
        r#"
        INSERT INTO leads (tenant_id, nome, email, telefone, estagio_funil, custo_aquisicao, canal_aquisicao, observacoes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, tenant_id, nome, email, telefone, estagio_funil, custo_aquisicao, canal_aquisicao, observacoes, created_at, updated_at
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.nome)
    .bind(&dto.email)
    .bind(&dto.telefone)
    .bind(&estagio)
    .bind(custo)
    .bind(&canal)
    .bind(&dto.observacoes)
    .fetch_one(&mut *db)
    .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO lead_interacoes (tenant_id, lead_id, tipo, descricao, usuario_id)
        VALUES ($1, $2, 'criacao', 'Lead registrado no funil comercial', $3)
        "#,
    )
    .bind(tenant_id)
    .bind(lead.id)
    .bind(auth_user.id)
    .execute(&mut *db)
    .await;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_LEAD_CRM",
        "leads",
        Some(lead.id.to_string()),
        Some(json!({ "nome": lead.nome, "email": lead.email, "estagio": lead.estagio_funil })),
    )
    .await;

    Ok(Json(lead))
}

pub async fn capturar_lead_publico(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<CreateLeadPublicDto>,
) -> Result<Json<Lead>, AppError> {
    let header_tenant = headers.get("x-tenant-id").and_then(|h| h.to_str().ok());
    let tenant_id = crate::db::resolve_public_tenant(
        &state.pool,
        dto.tenant_id,
        dto.tenant_slug.as_deref(),
        header_tenant,
    )
    .await?;
    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    let canal = dto
        .canal_aquisicao
        .unwrap_or_else(|| "landing_page".to_string());

    // Desduplicação de lead público
    let existing_lead = sqlx::query_as::<_, Lead>(
        "SELECT * FROM leads WHERE tenant_id = $1 AND (email = $2 OR telefone = $3) ORDER BY created_at ASC LIMIT 1"
    )
    .bind(tenant_id)
    .bind(&dto.email)
    .bind(&dto.telefone)
    .fetch_optional(&mut *db)
    .await?;

    if let Some(mut lead) = existing_lead {
        let _ = sqlx::query("UPDATE leads SET updated_at = NOW() WHERE id = $1")
            .bind(lead.id)
            .execute(&mut *db)
            .await;

        let _ = sqlx::query(
            r#"
            INSERT INTO lead_interacoes (tenant_id, lead_id, tipo, descricao, usuario_id)
            VALUES ($1, $2, 'retorno', 'Novo contato recebido via formulário público', NULL)
            "#,
        )
        .bind(tenant_id)
        .bind(lead.id)
        .execute(&mut *db)
        .await;

        lead.updated_at = Some(chrono::Utc::now());
        return Ok(Json(lead));
    }

    let lead = sqlx::query_as::<_, Lead>(
        r#"
        INSERT INTO leads (tenant_id, nome, email, telefone, estagio_funil, custo_aquisicao, canal_aquisicao, observacoes)
        VALUES ($1, $2, $3, $4, 'novo_lead', 0.0, $5, $6)
        RETURNING id, tenant_id, nome, email, telefone, estagio_funil, custo_aquisicao, canal_aquisicao, observacoes, created_at, updated_at
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.nome)
    .bind(&dto.email)
    .bind(&dto.telefone)
    .bind(&canal)
    .bind(&dto.observacoes)
    .fetch_one(&mut *db)
    .await?;

    let _ = sqlx::query(
        r#"
        INSERT INTO lead_interacoes (tenant_id, lead_id, tipo, descricao, usuario_id)
        VALUES ($1, $2, 'criacao', 'Lead capturado via formulário público', NULL)
        "#,
    )
    .bind(tenant_id)
    .bind(lead.id)
    .execute(&mut *db)
    .await;

    Ok(Json(lead))
}

pub async fn listar_leads(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<ListLeadsQuery>,
) -> Result<Json<Vec<Lead>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let leads = sqlx::query_as::<_, Lead>(
        r#"
        SELECT id, tenant_id, nome, email, telefone, estagio_funil, custo_aquisicao, canal_aquisicao, observacoes, created_at, updated_at
        FROM leads
        WHERE tenant_id = $1
          AND ($2::TEXT IS NULL OR estagio_funil = $2)
          AND ($3::TEXT IS NULL OR canal_aquisicao = $3)
        ORDER BY created_at DESC
        "#,
    )
    .bind(tenant_id)
    .bind(query.estagio)
    .bind(query.canal)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(leads))
}

pub async fn obter_lead(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(lead_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let lead = sqlx::query_as::<_, Lead>(
        r#"
        SELECT id, tenant_id, nome, email, telefone, estagio_funil, custo_aquisicao, canal_aquisicao, observacoes, created_at, updated_at
        FROM leads
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(lead_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let interacoes = sqlx::query_as::<_, LeadInteracao>(
        r#"
        SELECT id, tenant_id, lead_id, tipo, descricao, usuario_id, created_at
        FROM lead_interacoes
        WHERE lead_id = $1 AND tenant_id = $2
        ORDER BY created_at ASC
        "#,
    )
    .bind(lead_id)
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(json!({
        "lead": lead,
        "interacoes": interacoes
    })))
}

pub async fn atualizar_lead(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(lead_id): Path<Uuid>,
    Json(dto): Json<UpdateLeadDto>,
) -> Result<Json<Lead>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let lead_atual = sqlx::query_as::<_, Lead>(
        r#"
        SELECT id, tenant_id, nome, email, telefone, estagio_funil, custo_aquisicao, canal_aquisicao, observacoes, created_at, updated_at
        FROM leads
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(lead_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(ref novo_estagio) = dto.estagio_funil {
        if novo_estagio != &lead_atual.estagio_funil {
            let _ = sqlx::query(
                r#"
                INSERT INTO lead_interacoes (tenant_id, lead_id, tipo, descricao, usuario_id)
                VALUES ($1, $2, 'mudanca_estagio', $3, $4)
                "#,
            )
            .bind(tenant_id)
            .bind(lead_id)
            .bind(format!(
                "Estágio alterado de '{}' para '{}'",
                lead_atual.estagio_funil, novo_estagio
            ))
            .bind(auth_user.id)
            .execute(&mut *db)
            .await;
        }
    }

    let lead_atualizado = sqlx::query_as::<_, Lead>(
        r#"
        UPDATE leads
        SET nome = COALESCE($1, nome),
            email = COALESCE($2, email),
            telefone = COALESCE($3, telefone),
            estagio_funil = COALESCE($4, estagio_funil),
            custo_aquisicao = COALESCE($5, custo_aquisicao),
            canal_aquisicao = COALESCE($6, canal_aquisicao),
            observacoes = COALESCE($7, observacoes),
            updated_at = NOW()
        WHERE id = $8 AND tenant_id = $9
        RETURNING id, tenant_id, nome, email, telefone, estagio_funil, custo_aquisicao, canal_aquisicao, observacoes, created_at, updated_at
        "#,
    )
    .bind(dto.nome)
    .bind(dto.email)
    .bind(dto.telefone)
    .bind(dto.estagio_funil)
    .bind(dto.custo_aquisicao)
    .bind(dto.canal_aquisicao)
    .bind(dto.observacoes)
    .bind(lead_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_LEAD_CRM",
        "leads",
        Some(lead_id.to_string()),
        Some(json!({ "novo_estagio": lead_atualizado.estagio_funil })),
    )
    .await;

    Ok(Json(lead_atualizado))
}

pub async fn adicionar_interacao_lead(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(lead_id): Path<Uuid>,
    Json(dto): Json<CreateInteracaoDto>,
) -> Result<Json<LeadInteracao>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let interacao = sqlx::query_as::<_, LeadInteracao>(
        r#"
        INSERT INTO lead_interacoes (tenant_id, lead_id, tipo, descricao, usuario_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, tenant_id, lead_id, tipo, descricao, usuario_id, created_at
        "#,
    )
    .bind(tenant_id)
    .bind(lead_id)
    .bind(&dto.tipo)
    .bind(&dto.descricao)
    .bind(auth_user.id)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "REGISTRAR_INTERACAO_LEAD",
        "lead_interacoes",
        Some(interacao.id.to_string()),
        Some(json!({ "tipo": interacao.tipo, "lead_id": lead_id })),
    )
    .await;

    Ok(Json(interacao))
}

pub fn calcular_cac(custo_total: f64, matriculados: i64) -> f64 {
    if matriculados <= 0 {
        0.0
    } else {
        (custo_total / matriculados as f64 * 100.0).round() / 100.0
    }
}

pub fn calcular_taxa_conversao(total_leads: i64, matriculados: i64) -> f64 {
    if total_leads <= 0 {
        0.0
    } else {
        (matriculados as f64 / total_leads as f64 * 100.0 * 100.0).round() / 100.0
    }
}

#[derive(sqlx::FromRow)]
struct FunilAggregates {
    total_leads: i64,
    novo_lead: i64,
    visita_agendada: i64,
    proposta_enviada: i64,
    matriculado: i64,
    perdido: i64,
    custo_total_aquisicao: f64,
}

pub async fn relatorio_funil_crm(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<RelatorioFunilResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let agg = sqlx::query_as::<_, FunilAggregates>(
        r#"
        SELECT
            COUNT(*)::BIGINT as total_leads,
            COUNT(*) FILTER (WHERE estagio_funil = 'novo_lead')::BIGINT as novo_lead,
            COUNT(*) FILTER (WHERE estagio_funil = 'visita_agendada')::BIGINT as visita_agendada,
            COUNT(*) FILTER (WHERE estagio_funil = 'proposta_enviada')::BIGINT as proposta_enviada,
            COUNT(*) FILTER (WHERE estagio_funil = 'matriculado')::BIGINT as matriculado,
            COUNT(*) FILTER (WHERE estagio_funil = 'perdido')::BIGINT as perdido,
            COALESCE(SUM(custo_aquisicao), 0.0)::FLOAT8 as custo_total_aquisicao
        FROM leads
        WHERE tenant_id = $1
        "#,
    )
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    let cac = calcular_cac(agg.custo_total_aquisicao, agg.matriculado);
    let taxa_conversao = calcular_taxa_conversao(agg.total_leads, agg.matriculado);

    Ok(Json(RelatorioFunilResponse {
        total_leads: agg.total_leads,
        novo_lead: agg.novo_lead,
        visita_agendada: agg.visita_agendada,
        proposta_enviada: agg.proposta_enviada,
        matriculado: agg.matriculado,
        perdido: agg.perdido,
        taxa_conversao_pct: taxa_conversao,
        custo_total_aquisicao: agg.custo_total_aquisicao,
        cac_medio: cac,
    }))
}
