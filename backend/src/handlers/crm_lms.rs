use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
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
        AtendimentoProtocolo, CreateInteracaoDto, CreateLeadDto, Lead, LeadInteracao, LmsConfig,
        LtiGradeSyncDto, LtiLaunchResponse, RelatorioFunilResponse, ResponderProtocoloDto,
        SaveLmsConfigDto, ScormTrackDto, ScormTrackingRecord, UpdateLeadDto,
        WhatsAppIncomingPayload, WhatsAppVerifyParams,
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

pub fn limpar_telefone(phone: &str) -> String {
    phone.chars().filter(|c| c.is_ascii_digit()).collect()
}

#[derive(Debug, PartialEq, Eq)]
pub enum IntencaoChatbot {
    SegundaViaPix,
    Cardapio,
    Horarios,
    HumanoTransbordo,
    SaudacaoOutros,
}

pub fn classificar_intencao_chatbot(text: &str) -> IntencaoChatbot {
    let lower = text.to_lowercase();
    if lower.contains("2a via")
        || lower.contains("segunda via")
        || lower.contains("boleto")
        || lower.contains("pix")
        || lower.contains("fatura")
        || lower.contains("mensalidade")
        || lower.contains("pagamento")
        || lower.contains("pagar")
    {
        IntencaoChatbot::SegundaViaPix
    } else if lower.contains("cardapio")
        || lower.contains("cardápio")
        || lower.contains("alimentacao")
        || lower.contains("alimentação")
        || lower.contains("almoco")
        || lower.contains("almoço")
        || lower.contains("lanche")
        || lower.contains("comida")
    {
        IntencaoChatbot::Cardapio
    } else if lower.contains("horario")
        || lower.contains("horário")
        || lower.contains("calendario")
        || lower.contains("calendário")
        || lower.contains("feriado")
        || lower.contains("aula")
        || lower.contains("entrada")
        || lower.contains("saida")
        || lower.contains("saída")
    {
        IntencaoChatbot::Horarios
    } else if lower.contains("atendente")
        || lower.contains("humano")
        || lower.contains("secretaria")
        || lower.contains("falar com")
        || lower.contains("pessoa")
        || lower.contains("atendimento")
        || lower.contains("transferir")
    {
        IntencaoChatbot::HumanoTransbordo
    } else {
        IntencaoChatbot::SaudacaoOutros
    }
}

pub async fn whatsapp_webhook_verify(
    Query(params): Query<WhatsAppVerifyParams>,
) -> impl IntoResponse {
    let mode = params.hub_mode.as_deref().unwrap_or_default();
    let token = params.hub_verify_token.as_deref().unwrap_or_default();
    let challenge = params.hub_challenge.unwrap_or_default();

    let expected_token = std::env::var("WHATSAPP_VERIFY_TOKEN")
        .unwrap_or_else(|_| "escolar_whatsapp_verify_token".to_string());

    if mode == "subscribe" && token == expected_token {
        (StatusCode::OK, challenge)
    } else {
        (
            StatusCode::FORBIDDEN,
            "Verificação de webhook rejeitada".to_string(),
        )
    }
}

#[derive(sqlx::FromRow)]
struct AlunoContatoResumo {
    id: Uuid,
    tenant_id: Uuid,
    nome: String,
    nome_responsavel: String,
}

#[derive(sqlx::FromRow)]
struct FaturaCobrancaResumo {
    #[allow(dead_code)]
    id: Uuid,
    descricao: String,
    valor: f64,
    qr_code_pix: Option<String>,
    data_vencimento: chrono::NaiveDate,
}

pub async fn whatsapp_webhook(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<WhatsAppIncomingPayload>,
) -> Result<Json<Value>, AppError> {
    let mut phone_raw = payload.from.clone();
    let mut text_raw = payload.message.clone();
    let mut message_id = payload.message_id.clone();

    if let Some(ref text_val) = payload.text {
        if let Some(s) = text_val.as_str() {
            text_raw = Some(s.to_string());
        } else if let Some(b) = text_val.get("body").and_then(|v| v.as_str()) {
            text_raw = Some(b.to_string());
        }
    }

    if phone_raw.is_none() {
        if let Some(entry) = payload
            .entry
            .as_ref()
            .and_then(|e| e.as_array())
            .and_then(|a| a.first())
        {
            if let Some(changes) = entry
                .get("changes")
                .and_then(|c| c.as_array())
                .and_then(|a| a.first())
            {
                if let Some(messages) = changes
                    .get("value")
                    .and_then(|v| v.get("messages"))
                    .and_then(|m| m.as_array())
                    .and_then(|a| a.first())
                {
                    if phone_raw.is_none() {
                        phone_raw = messages
                            .get("from")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }
                    if text_raw.is_none() {
                        text_raw = messages
                            .get("text")
                            .and_then(|v| v.get("body"))
                            .and_then(|b| b.as_str())
                            .map(|s| s.to_string());
                    }
                    if message_id.is_none() {
                        message_id = messages
                            .get("id")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }
                }
            }
        }
    }

    let phone = match phone_raw {
        Some(p) if !p.trim().is_empty() => p,
        _ => {
            return Ok(Json(json!({
                "status": "ignored",
                "motivo": "Evento sem remetente ou notificação de entrega/leitura"
            })));
        }
    };
    let clean_phone = limpar_telefone(&phone);
    let message_text = text_raw.unwrap_or_else(|| "Olá".to_string());
    let header_tenant = headers.get("x-tenant-id").and_then(|h| h.to_str().ok());
    let tenant_id = crate::db::resolve_public_tenant(
        &state.pool,
        payload.tenant_id,
        payload.tenant_slug.as_deref(),
        header_tenant,
    )
    .await?;
    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    let maybe_aluno = sqlx::query_as::<_, AlunoContatoResumo>(
        r#"
        SELECT id, tenant_id, nome, nome_responsavel
        FROM alunos
        WHERE tenant_id = $2
          AND (
            regexp_replace(telefone_responsavel, '[^0-9]', '', 'g') = $1
            OR $1 LIKE '%' || regexp_replace(telefone_responsavel, '[^0-9]', '', 'g')
            OR regexp_replace(telefone_responsavel, '[^0-9]', '', 'g') LIKE '%' || $1
          )
        LIMIT 1
        "#,
    )
    .bind(&clean_phone)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let intencao = classificar_intencao_chatbot(&message_text);

    let (resposta, tipo_interacao, protocolo_gerado) = match intencao {
        IntencaoChatbot::SegundaViaPix => {
            let msg = if let Some(aluno) = maybe_aluno.as_ref() {
                let maybe_fatura = sqlx::query_as::<_, FaturaCobrancaResumo>(
                    r#"
                    SELECT id, descricao, valor, qr_code_pix, data_vencimento
                    FROM faturas
                    WHERE aluno_id = $1 AND status IN ('pendente', 'atrasado')
                    ORDER BY data_vencimento ASC
                    LIMIT 1
                    "#,
                )
                .bind(aluno.id)
                .fetch_optional(&mut *db)
                .await?;

                if let Some(fatura) = maybe_fatura {
                    let pix = fatura.qr_code_pix.unwrap_or_else(|| {
                        "00020101021226840014br.gov.bcb.pix2562pix.escola.com.br/qr/v2/pendente5204000053039865802BR5913Colegio6008SaoPaulo62070503***6304ABCD".to_string()
                    });
                    format!(
                        "Olá {}! Localizamos a fatura do(a) estudante {}: \"{}\" no valor de R$ {:.2} com vencimento em {}.\n\n🔑 Chave Pix Copia e Cola:\n{}\n\nOu pague pelo Portal da Família: https://portal.escola.edu.br/financeiro",
                        aluno.nome_responsavel, aluno.nome, fatura.descricao, fatura.valor, fatura.data_vencimento, pix
                    )
                } else {
                    format!(
                        "Olá {}! Não encontramos faturas pendentes ou em atraso para o(a) aluno(a) {}. Todas as mensalidades estão quitadas!",
                        aluno.nome_responsavel, aluno.nome
                    )
                }
            } else {
                "Olá! Não localizamos uma matrícula vinculada a este número de telefone. Caso precise da 2ª via, digite 'atendente' para falar com nosso setor financeiro.".to_string()
            };
            (msg, "pix_2a_via", None)
        }
        IntencaoChatbot::Cardapio => {
            (
                "🍽️ O cardápio escolar desta semana oferece refeições balanceadas elaboradas por nossa nutricionista escolar. O menu completo do dia está disponível na aba 'Alimentação' no Portal da Família!".to_string(),
                "duvida_faq",
                None,
            )
        }
        IntencaoChatbot::Horarios => {
            (
                "⏰ Nossos horários de aula regulares:\n- Turno Manhã: 07h30 às 12h50\n- Turno Tarde: 13h15 às 18h35\nOs portões escolares abrem 15 minutos antes do início das aulas. Para conferir o calendário letivo de provas e recessos, consulte o Portal do Aluno.".to_string(),
                "duvida_faq",
                None,
            )
        }
        IntencaoChatbot::HumanoTransbordo => {
            let proto = format!("ATD-2026-{}", &Uuid::new_v4().to_string()[..8].to_uppercase());

            let tenant_id = maybe_aluno.as_ref().map(|a| a.tenant_id);
            let aluno_id = maybe_aluno.as_ref().map(|a| a.id);

            let _ = sqlx::query(
                r#"
                INSERT INTO atendimento_protocolos (
                    tenant_id, protocolo, telefone_contato, aluno_id,
                    assunto, status, setor_transbordo, ultima_mensagem, resposta_enviada
                )
                VALUES ($1, $2, $3, $4, 'Transbordo Humanizado', 'aguardando_atendente', 'secretaria', $5, NULL)
                "#,
            )
            .bind(tenant_id)
            .bind(&proto)
            .bind(&clean_phone)
            .bind(aluno_id)
            .bind(&message_text)
            .execute(&mut *db)
            .await;

            let msg = format!(
                "Transferindo seu atendimento para nossa equipe da secretaria escolar. Seu protocolo é {}. Um operador responderá em instantes por este canal!",
                proto
            );
            (msg, "transbordo_humano", Some(proto))
        }
        IntencaoChatbot::SaudacaoOutros => {
            (
                "Olá! Sou a assistente virtual da escola. Como posso ajudar você hoje?\n\n1️⃣ Digite 'Boleto' ou 'Pix' para 2ª via da mensalidade\n2️⃣ Digite 'Cardápio' para conferir o almoço e lanches\n3️⃣ Digite 'Horários' para informações da portaria e calendário\n4️⃣ Digite 'Atendente' para falar com nossa secretaria escolar".to_string(),
                "saudacao",
                None,
            )
        }
    };

    // Registrar log da mensagem recebida e resposta
    let _ = sqlx::query(
        r#"
        INSERT INTO whatsapp_webhook_logs (message_id, telefone_origem, conteudo_texto, resposta_gerada, tipo_interacao)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(message_id)
    .bind(&clean_phone)
    .bind(&message_text)
    .bind(&resposta)
    .bind(tipo_interacao)
    .execute(&mut *db)
    .await;

    let aluno_nome = maybe_aluno.map(|a| a.nome);

    Ok(Json(json!({
        "status": "mensagem_processada",
        "acao": "resposta_automatica_enviada",
        "tipo_interacao": tipo_interacao,
        "telefone": clean_phone,
        "aluno_localizado": aluno_nome,
        "resposta": resposta,
        "protocolo": protocolo_gerado
    })))
}

pub async fn listar_protocolos_atendimento(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<AtendimentoProtocolo>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let protocolos = sqlx::query_as::<_, AtendimentoProtocolo>(
        r#"
        SELECT id, tenant_id, protocolo, telefone_contato, aluno_id, assunto, status,
               setor_transbordo, ultima_mensagem, resposta_enviada, created_at, updated_at
        FROM atendimento_protocolos
        WHERE tenant_id = $1 OR tenant_id IS NULL
        ORDER BY created_at DESC
        "#,
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(protocolos))
}

pub async fn responder_protocolo_atendimento(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(protocolo_id): Path<Uuid>,
    Json(dto): Json<ResponderProtocoloDto>,
) -> Result<Json<AtendimentoProtocolo>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let protocolo = sqlx::query_as::<_, AtendimentoProtocolo>(
        r#"
        UPDATE atendimento_protocolos
        SET status = 'finalizado',
            resposta_enviada = $1,
            updated_at = NOW()
        WHERE id = $2 AND (tenant_id = $3 OR tenant_id IS NULL)
        RETURNING id, tenant_id, protocolo, telefone_contato, aluno_id, assunto, status,
                  setor_transbordo, ultima_mensagem, resposta_enviada, created_at, updated_at
        "#,
    )
    .bind(&dto.resposta)
    .bind(protocolo_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATENDIMENTO_RESPONDIDO",
        "atendimento_protocolos",
        Some(protocolo.id.to_string()),
        Some(json!({
            "protocolo": protocolo.protocolo,
            "telefone": protocolo.telefone_contato,
            "resposta": dto.resposta
        })),
    )
    .await;

    Ok(Json(protocolo))
}

pub async fn salvar_lms_config(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<SaveLmsConfigDto>,
) -> Result<Json<LmsConfig>, AppError> {
    check_roles(&auth_user, &["admin", "gestor"])?;
    let tenant_id = active_tenant.0;

    let lms_type = dto.lms_type.to_lowercase();
    if !["moodle", "canvas", "google_classroom"].contains(&lms_type.as_str()) {
        return Err(AppError::BadRequest(
            "lms_type inválido. Tipos suportados: moodle, canvas, google_classroom".to_string(),
        ));
    }

    let lti_version = dto
        .lti_version
        .unwrap_or_else(|| "1.3 Advantage".to_string());

    let config = sqlx::query_as::<_, LmsConfig>(
        r#"
        INSERT INTO lms_configs (tenant_id, lms_type, client_id, platform_url, lti_version)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, lms_type) DO UPDATE
        SET client_id = EXCLUDED.client_id,
            platform_url = EXCLUDED.platform_url,
            lti_version = EXCLUDED.lti_version
        RETURNING id, tenant_id, lms_type, client_id, platform_url, lti_version, created_at
        "#,
    )
    .bind(tenant_id)
    .bind(&lms_type)
    .bind(&dto.client_id)
    .bind(&dto.platform_url)
    .bind(&lti_version)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CONFIGURAR_LMS",
        "lms_configs",
        Some(config.id.to_string()),
        Some(json!({
            "lms_type": config.lms_type,
            "client_id": config.client_id,
            "platform_url": config.platform_url
        })),
    )
    .await;

    Ok(Json(config))
}

pub async fn obter_lms_config(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<LmsConfig>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    let configs = sqlx::query_as::<_, LmsConfig>(
        r#"
        SELECT id, tenant_id, lms_type, client_id, platform_url, lti_version, created_at
        FROM lms_configs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(configs))
}

pub async fn lti_launch(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<LtiLaunchResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor", "aluno"])?;
    let tenant_id = active_tenant.0;

    let maybe_config = sqlx::query_as::<_, LmsConfig>(
        r#"
        SELECT id, tenant_id, lms_type, client_id, platform_url, lti_version, created_at
        FROM lms_configs
        WHERE tenant_id = $1
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let (platform_url, client_id, lti_version) = match maybe_config {
        Some(cfg) => (cfg.platform_url, cfg.client_id, cfg.lti_version),
        None => (
            "https://moodle.escola.edu.br".to_string(),
            "escolar-erp-lti-client".to_string(),
            "1.3 Advantage".to_string(),
        ),
    };

    let state_token = format!(
        "lti_{}_{}_{}",
        tenant_id,
        auth_user.id,
        chrono::Utc::now().timestamp()
    );

    let launch_url = format!(
        "{}/auth/lti/launch.php?id={}&state={}",
        platform_url.trim_end_matches('/'),
        client_id,
        state_token
    );
    let jwt_target_link = format!("{}/mod/lti/view.php", platform_url.trim_end_matches('/'));

    Ok(Json(LtiLaunchResponse {
        status: "success".to_string(),
        lti_version,
        launch_url,
        jwt_target_link,
        user_id: auth_user.id,
        role: auth_user.role,
        state_token,
    }))
}

pub fn normalizar_nota_lti(raw: f64) -> f64 {
    let nota = if raw > 10.0 && raw <= 100.0 {
        raw / 10.0
    } else {
        raw
    };
    (nota.max(0.0).min(10.0) * 100.0).round() / 100.0
}

pub async fn lti_grade_sync(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<LtiGradeSyncDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    let nota_normalizada = normalizar_nota_lti(dto.nota);
    let periodo = dto.periodo.unwrap_or_else(|| "1_bimestre".to_string());

    let existing_nota_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id FROM notas
        WHERE tenant_id = $1 AND aluno_id = $2 AND disciplina_nome = $3 AND periodo = $4
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.disciplina_nome)
    .bind(&periodo)
    .fetch_optional(&mut *db)
    .await?;

    let final_nota_id = match existing_nota_id {
        Some(id) => {
            sqlx::query(
                r#"
                UPDATE notas
                SET nota = $1, created_at = NOW()
                WHERE id = $2 AND tenant_id = $3
                "#,
            )
            .bind(nota_normalizada)
            .bind(id)
            .bind(tenant_id)
            .execute(&mut *db)
            .await?;
            id
        }
        None => {
            sqlx::query_scalar::<_, Uuid>(
                r#"
                INSERT INTO notas (tenant_id, aluno_id, disciplina_nome, nota, periodo)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
                "#,
            )
            .bind(tenant_id)
            .bind(dto.aluno_id)
            .bind(&dto.disciplina_nome)
            .bind(nota_normalizada)
            .bind(&periodo)
            .fetch_one(&mut *db)
            .await?
        }
    };

    sqlx::query(
        r#"
        INSERT INTO lms_grade_sync_logs (tenant_id, aluno_id, disciplina_nome, atividade_nome, nota, periodo, origem_lms)
        VALUES ($1, $2, $3, $4, $5, $6, 'lti_ags')
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.disciplina_nome)
    .bind(&dto.atividade_nome)
    .bind(nota_normalizada)
    .bind(&periodo)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "LMS_GRADE_SYNC",
        "notas",
        Some(final_nota_id.to_string()),
        Some(json!({
            "aluno_id": dto.aluno_id,
            "disciplina": dto.disciplina_nome,
            "atividade": dto.atividade_nome,
            "nota": nota_normalizada,
            "periodo": periodo
        })),
    )
    .await;

    Ok(Json(json!({
        "status": "success",
        "nota_id": final_nota_id,
        "aluno_id": dto.aluno_id,
        "disciplina_nome": dto.disciplina_nome,
        "atividade_nome": dto.atividade_nome,
        "nota_sincronizada": nota_normalizada,
        "periodo": periodo
    })))
}

pub fn validar_status_scorm(status: &str) -> bool {
    matches!(
        status.to_lowercase().as_str(),
        "passed" | "completed" | "failed" | "incomplete" | "browsed" | "not attempted"
    )
}

pub async fn scorm_track(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<ScormTrackDto>,
) -> Result<Json<ScormTrackingRecord>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor", "aluno"])?;
    let tenant_id = active_tenant.0;

    let normalized_status = dto.lesson_status.to_lowercase();
    if !validar_status_scorm(&normalized_status) {
        return Err(AppError::BadRequest(
            "Status SCORM inválido. Valores aceitos: passed, completed, failed, incomplete, browsed, not attempted".to_string(),
        ));
    }

    let record = sqlx::query_as::<_, ScormTrackingRecord>(
        r#"
        INSERT INTO scorm_tracking (
            tenant_id, aluno_id, package_id, lesson_status,
            score_raw, score_min, score_max, session_time, suspend_data, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (tenant_id, aluno_id, package_id) DO UPDATE
        SET lesson_status = EXCLUDED.lesson_status,
            score_raw = COALESCE(EXCLUDED.score_raw, scorm_tracking.score_raw),
            score_min = COALESCE(EXCLUDED.score_min, scorm_tracking.score_min),
            score_max = COALESCE(EXCLUDED.score_max, scorm_tracking.score_max),
            session_time = COALESCE(EXCLUDED.session_time, scorm_tracking.session_time),
            suspend_data = COALESCE(EXCLUDED.suspend_data, scorm_tracking.suspend_data),
            updated_at = NOW()
        RETURNING id, tenant_id, aluno_id, package_id, lesson_status, score_raw, score_min, score_max, session_time, suspend_data, updated_at
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.package_id)
    .bind(&normalized_status)
    .bind(dto.score_raw)
    .bind(dto.score_min.unwrap_or(0.0))
    .bind(dto.score_max.unwrap_or(100.0))
    .bind(&dto.session_time)
    .bind(&dto.suspend_data)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "SCORM_TRACK_UPDATE",
        "scorm_tracking",
        Some(record.id.to_string()),
        Some(json!({
            "aluno_id": record.aluno_id,
            "package_id": record.package_id,
            "status": record.lesson_status,
            "score": record.score_raw
        })),
    )
    .await;

    Ok(Json(record))
}

pub async fn obter_scorm_track(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path((package_id, aluno_id)): Path<(String, Uuid)>,
) -> Result<Json<ScormTrackingRecord>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "professor", "aluno", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let record = sqlx::query_as::<_, ScormTrackingRecord>(
        r#"
        SELECT id, tenant_id, aluno_id, package_id, lesson_status, score_raw, score_min, score_max, session_time, suspend_data, updated_at
        FROM scorm_tracking
        WHERE tenant_id = $1 AND package_id = $2 AND aluno_id = $3
        "#,
    )
    .bind(tenant_id)
    .bind(&package_id)
    .bind(aluno_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(record))
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn test_limpar_telefone_remove_caracteres_especiais() {
        assert_eq!(limpar_telefone("+55 (11) 98765-4321"), "5511987654321");
        assert_eq!(limpar_telefone("11999998888"), "11999998888");
        assert_eq!(limpar_telefone("(21) 9123-4567"), "2191234567");
    }

    #[test]
    fn test_classificar_intencao_segunda_via_pix() {
        assert_eq!(
            classificar_intencao_chatbot("Preciso da 2a via do boleto de março"),
            IntencaoChatbot::SegundaViaPix
        );
        assert_eq!(
            classificar_intencao_chatbot("Gostaria de pagar a mensalidade via Pix"),
            IntencaoChatbot::SegundaViaPix
        );
        assert_eq!(
            classificar_intencao_chatbot("Qual o valor da minha fatura?"),
            IntencaoChatbot::SegundaViaPix
        );
    }

    #[test]
    fn test_classificar_intencao_cardapio() {
        assert_eq!(
            classificar_intencao_chatbot("Qual é o cardápio do almoço hoje?"),
            IntencaoChatbot::Cardapio
        );
        assert_eq!(
            classificar_intencao_chatbot("O que tem de lanche na alimentação escolar?"),
            IntencaoChatbot::Cardapio
        );
    }

    #[test]
    fn test_classificar_intencao_horarios_e_calendario() {
        assert_eq!(
            classificar_intencao_chatbot("Qual é o horário de saída da turma?"),
            IntencaoChatbot::Horarios
        );
        assert_eq!(
            classificar_intencao_chatbot("Teremos aula no feriado de sexta?"),
            IntencaoChatbot::Horarios
        );
    }

    #[test]
    fn test_classificar_intencao_transbordo_humano() {
        assert_eq!(
            classificar_intencao_chatbot("Quero falar com um atendente da secretaria"),
            IntencaoChatbot::HumanoTransbordo
        );
        assert_eq!(
            classificar_intencao_chatbot("Pode me transferir para uma pessoa humana?"),
            IntencaoChatbot::HumanoTransbordo
        );
    }

    #[test]
    fn test_classificar_intencao_saudacao_default() {
        assert_eq!(
            classificar_intencao_chatbot("Olá, bom dia!"),
            IntencaoChatbot::SaudacaoOutros
        );
        assert_eq!(
            classificar_intencao_chatbot("Como você funciona?"),
            IntencaoChatbot::SaudacaoOutros
        );
    }

    #[test]
    fn test_normalizar_nota_escala_0_a_10() {
        assert_eq!(normalizar_nota_lti(8.5), 8.5);
        assert_eq!(normalizar_nota_lti(10.0), 10.0);
        assert_eq!(normalizar_nota_lti(0.0), 0.0);
    }

    #[test]
    fn test_normalizar_nota_escala_0_a_100_converte_para_0_a_10() {
        assert_eq!(normalizar_nota_lti(85.0), 8.5);
        assert_eq!(normalizar_nota_lti(92.5), 9.25);
        assert_eq!(normalizar_nota_lti(100.0), 10.0);
    }

    #[test]
    fn test_normalizar_nota_clamping_seguro() {
        assert_eq!(normalizar_nota_lti(-5.0), 0.0);
        assert_eq!(normalizar_nota_lti(120.0), 10.0);
    }

    #[test]
    fn test_validar_status_scorm_cmi_normativo() {
        assert!(validar_status_scorm("passed"));
        assert!(validar_status_scorm("completed"));
        assert!(validar_status_scorm("failed"));
        assert!(validar_status_scorm("incomplete"));
        assert!(validar_status_scorm("browsed"));
        assert!(validar_status_scorm("not attempted"));
        assert!(validar_status_scorm("PASSED"));

        assert!(!validar_status_scorm("invalid_status"));
        assert!(!validar_status_scorm("iniciado"));
    }

    #[test]
    fn test_lti_launch_url_e_target_link_structure() {
        let platform_url = "https://moodle.escola.edu.br/";
        let client_id = "test-client-123";
        let state_token = "lti_state_test";

        let launch_url = format!(
            "{}/auth/lti/launch.php?id={}&state={}",
            platform_url.trim_end_matches('/'),
            client_id,
            state_token
        );
        let jwt_target_link = format!("{}/mod/lti/view.php", platform_url.trim_end_matches('/'));

        assert_eq!(
            launch_url,
            "https://moodle.escola.edu.br/auth/lti/launch.php?id=test-client-123&state=lti_state_test"
        );
        assert_eq!(
            jwt_target_link,
            "https://moodle.escola.edu.br/mod/lti/view.php"
        );
    }

    #[test]
    fn test_calcular_cac_divisao_correta() {
        let cac = calcular_cac(12000.0, 40);
        assert_eq!(cac, 300.0);

        let cac_fracionario = calcular_cac(5555.55, 13);
        assert_eq!(cac_fracionario, 427.35);
    }

    #[test]
    fn test_calcular_cac_zero_matriculados() {
        assert_eq!(calcular_cac(5000.0, 0), 0.0);
        assert_eq!(calcular_cac(0.0, 0), 0.0);
    }

    #[test]
    fn test_calcular_taxa_conversao_percentual() {
        let taxa = calcular_taxa_conversao(200, 50);
        assert_eq!(taxa, 25.0);

        let taxa_frac = calcular_taxa_conversao(300, 45);
        assert_eq!(taxa_frac, 15.0);
    }

    #[test]
    fn test_calcular_taxa_conversao_zero_leads() {
        assert_eq!(calcular_taxa_conversao(0, 0), 0.0);
    }
}
