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
        AtendimentoProtocolo, ResponderProtocoloDto, WhatsAppIncomingPayload, WhatsAppVerifyParams,
    },
};

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
            let proto = format!("ATD-2026-{}", Uuid::new_v4().to_string()[..8].to_uppercase());

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
