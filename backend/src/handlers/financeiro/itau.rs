use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Acquire, PgConnection};
use uuid::Uuid;

use crate::{
    config::{AppState, Config, ItauMode},
    db::TenantDb,
    error::AppError,
    middleware::{auth::AuthUser, rbac::check_roles, tenant::ActiveTenant},
    services::{
        audit::log_audit,
        itau_api::{
            emitir_bolecode, validar_pagador, BoletoEmitido, DadosBolecodeParams, DadosPagador,
            ItauApiError, RespostaEmissao,
        },
    },
};

#[derive(Debug, Deserialize, Default)]
pub struct EmitirItauDto {}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FaturaItauView {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub descricao: String,
    pub valor: f64,
    pub data_vencimento: chrono::NaiveDate,
    pub status: String,
    pub gateway_name: Option<String>,
    pub gateway_invoice_id: Option<String>,
    pub gateway_digitable_line: Option<String>,
    pub gateway_pix_code: Option<String>,
    pub codigo_barras: Option<String>,
    pub nosso_numero: Option<String>,
    pub gateway_txid: Option<String>,
    pub gateway_emissao_pendente: bool,
    pub multa_percentual: f64,
    pub juros_mora_mes_percentual: f64,
}

fn corpo_indica_nosso_numero_duplicado(corpo: &serde_json::Value) -> bool {
    let s = corpo.to_string().to_lowercase();
    s.contains("já existe")
        || s.contains("ja existe")
        || s.contains("duplicad")
        || s.contains("já cadastrado")
        || s.contains("ja cadastrado")
        || s.contains("existente")
        || s.contains("nosso_numero_existente")
}

async fn limpar_fatura_pendente(
    db: &mut PgConnection,
    fatura_id: Uuid,
    tenant_id: Uuid,
) -> Result<(), ItauApiError> {
    sqlx::query(
        r#"
        UPDATE faturas
        SET gateway_name = NULL,
            nosso_numero = NULL,
            gateway_emissao_pendente = false,
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(fatura_id)
    .bind(tenant_id)
    .execute(db)
    .await?;

    Ok(())
}

async fn gravar_sucesso_emissao(
    db: &mut PgConnection,
    tenant_id: Uuid,
    user_id: Uuid,
    fatura_id: Uuid,
    boleto: &BoletoEmitido,
) -> Result<Response, ItauApiError> {
    let updated: FaturaItauView = sqlx::query_as(
        r#"
        UPDATE faturas
        SET gateway_name = 'itau',
            gateway_invoice_id = $1,
            gateway_digitable_line = $2,
            gateway_pix_code = COALESCE($3, gateway_pix_code),
            codigo_barras = $4,
            nosso_numero = $5,
            gateway_txid = COALESCE($6, gateway_txid),
            gateway_emissao_pendente = false,
            updated_at = NOW()
        WHERE id = $7 AND tenant_id = $8
        RETURNING id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name,
                  gateway_invoice_id, gateway_digitable_line, gateway_pix_code, codigo_barras, nosso_numero,
                  gateway_txid, gateway_emissao_pendente, multa_percentual, juros_mora_mes_percentual
        "#,
    )
    .bind(&boleto.id_boleto_individual)
    .bind(&boleto.numero_linha_digitavel)
    .bind(&boleto.gateway_pix_code)
    .bind(&boleto.codigo_barras)
    .bind(&boleto.nosso_numero)
    .bind(&boleto.gateway_txid)
    .bind(fatura_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(user_id),
        "itau_emissao",
        "faturas",
        Some(fatura_id.to_string()),
        Some(json!({
            "fatura_id": fatura_id,
            "nosso_numero": boleto.nosso_numero,
            "gateway_invoice_id": boleto.id_boleto_individual,
        })),
    )
    .await;

    let mut resp_json = json!(updated);
    if boleto.simulado {
        resp_json["simulado"] = json!(true);
    }
    Ok((StatusCode::OK, Json(resp_json)).into_response())
}

async fn gravar_resposta_pendente(
    db: &mut PgConnection,
    tenant_id: Uuid,
    user_id: Uuid,
    fatura_id: Uuid,
    nosso_numero: &str,
) -> Result<Response, ItauApiError> {
    log_audit(
        &mut *db,
        tenant_id,
        Some(user_id),
        "itau_emissao",
        "faturas",
        Some(fatura_id.to_string()),
        Some(json!({
            "fatura_id": fatura_id,
            "nosso_numero": nosso_numero,
            "status": "pendente"
        })),
    )
    .await;

    Ok((
        StatusCode::ACCEPTED,
        Json(json!({
            "status": "pendente",
            "mensagem": "emissão em andamento",
            "nosso_numero": nosso_numero
        })),
    )
        .into_response())
}

async fn obter_e_validar_pagador(
    db: &mut PgConnection,
    fatura_id: Uuid,
    tenant_id: Uuid,
) -> Result<DadosPagador, ItauApiError> {
    #[derive(sqlx::FromRow)]
    struct PagadorAlunoRow {
        nome: Option<String>,
        documento: Option<String>,
        logradouro: Option<String>,
        numero: Option<String>,
        complemento: Option<String>,
        bairro: Option<String>,
        cidade: Option<String>,
        estado: Option<String>,
        cep: Option<String>,
    }

    let pagador_row = sqlx::query_as::<_, PagadorAlunoRow>(
        r#"
        SELECT
            COALESCE(NULLIF(TRIM(a.nome_responsavel_financeiro), ''), NULLIF(TRIM(a.nome_responsavel), '')) AS nome,
            COALESCE(NULLIF(a.cpf_responsavel_financeiro, ''), NULLIF(a.cpf_responsavel_legal, '')) AS documento,
            a.logradouro, a.numero, a.complemento, a.bairro, a.cidade, a.estado, a.cep
        FROM faturas f
        JOIN alunos a ON a.id = f.aluno_id AND a.tenant_id = f.tenant_id
        WHERE f.id = $1 AND f.tenant_id = $2
        "#,
    )
    .bind(fatura_id)
    .bind(tenant_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| {
        ItauApiError::App(AppError::BadRequest(
            "A fatura não está ligada a um aluno cadastrado.".to_string(),
        ))
    })?;

    let pagador = DadosPagador {
        nome: pagador_row.nome.unwrap_or_default(),
        documento: pagador_row.documento.unwrap_or_default(),
        logradouro: pagador_row.logradouro.unwrap_or_default(),
        numero: pagador_row.numero,
        complemento: pagador_row.complemento,
        bairro: pagador_row.bairro.unwrap_or_default(),
        cidade: pagador_row.cidade.unwrap_or_default(),
        uf: pagador_row.estado.unwrap_or_default(),
        cep: pagador_row.cep.unwrap_or_default(),
    };

    validar_pagador(&pagador)?;
    Ok(pagador)
}

fn validar_vencimento(data_vencimento: chrono::NaiveDate) -> Result<(), ItauApiError> {
    let hoje = chrono::Utc::now().date_naive();
    if data_vencimento < hoje {
        return Err(ItauApiError::App(AppError::BadRequest(
            "Data de vencimento não pode estar no passado.".to_string(),
        )));
    }
    Ok(())
}

struct ContextoProcessamento<'a> {
    db: &'a mut PgConnection,
    config: &'a Config,
    tenant_id: Uuid,
    user_id: Uuid,
    fatura_id: Uuid,
    id_beneficiario: &'a str,
    nosso_numero: &'a str,
}

async fn processar_resposta_emissao(
    resposta: Result<RespostaEmissao, ItauApiError>,
    ctx: ContextoProcessamento<'_>,
) -> Result<Response, ItauApiError> {
    match resposta {
        Ok(RespostaEmissao::Sucesso(boleto)) => {
            gravar_sucesso_emissao(ctx.db, ctx.tenant_id, ctx.user_id, ctx.fatura_id, &boleto).await
        }
        Ok(RespostaEmissao::Pendente {
            nosso_numero: n_num,
        }) => {
            gravar_resposta_pendente(ctx.db, ctx.tenant_id, ctx.user_id, ctx.fatura_id, &n_num)
                .await
        }
        Ok(RespostaEmissao::Rejeitado { status, corpo }) => {
            if corpo_indica_nosso_numero_duplicado(&corpo) || status == 409 {
                let consulta = crate::services::itau_api::consultar_boleto(
                    ctx.config,
                    ctx.db,
                    ctx.tenant_id,
                    ctx.id_beneficiario,
                    ctx.nosso_numero,
                )
                .await?;

                if let Some(boleto) = consulta {
                    return gravar_sucesso_emissao(
                        ctx.db,
                        ctx.tenant_id,
                        ctx.user_id,
                        ctx.fatura_id,
                        &boleto,
                    )
                    .await;
                }
            }

            limpar_fatura_pendente(ctx.db, ctx.fatura_id, ctx.tenant_id).await?;
            Ok((
                StatusCode::from_u16(status).unwrap_or(StatusCode::UNPROCESSABLE_ENTITY),
                Json(corpo),
            )
                .into_response())
        }
        Err(e) => {
            tracing::error!(
                error = %e,
                fatura_id = %ctx.fatura_id,
                nosso_numero = %ctx.nosso_numero,
                "erro de rede/timeout/5xx na emissão Itaú; fatura mantida como pendente"
            );
            Err(ItauApiError::BadGateway(
                "não foi possível confirmar a emissão; tente de novo para consultar".to_string(),
            ))
        }
    }
}

pub async fn emitir_itau_fatura(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(fatura_id): Path<Uuid>,
) -> Result<Response, ItauApiError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let fatura: FaturaItauView = sqlx::query_as(
        r#"
        SELECT id, tenant_id, aluno_id, descricao, valor, data_vencimento, status, gateway_name,
               gateway_invoice_id, gateway_digitable_line, gateway_pix_code, codigo_barras, nosso_numero,
               gateway_txid, gateway_emissao_pendente, multa_percentual, juros_mora_mes_percentual
        FROM faturas
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(fatura_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    if fatura.status == "pago" {
        return Err(ItauApiError::App(AppError::Conflict(
            "Fatura já está paga; não é possível emitir nova cobrança.".to_string(),
        )));
    }

    #[derive(sqlx::FromRow)]
    struct ItauConfigRow {
        id_beneficiario: Option<String>,
        chave_pix: Option<String>,
        especie_padrao: String,
        ativo: bool,
    }

    let itau_cfg: Option<ItauConfigRow> = sqlx::query_as(
        "SELECT id_beneficiario, chave_pix, especie_padrao, ativo FROM tenant_itau_config WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    if state.config.itau_mode != ItauMode::Mock {
        let is_ativo = itau_cfg.as_ref().map(|c| c.ativo).unwrap_or(false);
        if !is_ativo {
            return Err(ItauApiError::App(AppError::Conflict(
                "integração Itaú não ativada".to_string(),
            )));
        }
    } else {
        // Garantir linha no banco para a sequência em modo mock
        sqlx::query(
            "INSERT INTO tenant_itau_config (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING",
        )
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;
    }

    // Já emitida no Itaú e sem pendência: devolve existente
    if fatura.gateway_name.as_deref() == Some("itau")
        && !fatura.gateway_emissao_pendente
        && fatura.gateway_invoice_id.is_some()
    {
        return Ok((StatusCode::OK, Json(json!(fatura))).into_response());
    }

    let id_beneficiario_opt = itau_cfg
        .as_ref()
        .and_then(|c| c.id_beneficiario.as_deref())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let chave_pix_opt = itau_cfg
        .as_ref()
        .and_then(|c| c.chave_pix.as_deref())
        .map(str::trim)
        .filter(|s| !s.is_empty());

    let (id_beneficiario, chave_pix) = if state.config.itau_mode != ItauMode::Mock {
        match (id_beneficiario_opt, chave_pix_opt) {
            (Some(b), Some(p)) => (b.to_string(), p.to_string()),
            _ => {
                return Err(ItauApiError::App(AppError::Conflict(
                    "Preencha agência, conta e chave Pix na configuração do Itaú antes de emitir."
                        .to_string(),
                )));
            }
        }
    } else {
        (
            id_beneficiario_opt.unwrap_or("000000000000").to_string(),
            chave_pix_opt.unwrap_or("000000000000").to_string(),
        )
    };
    let especie_padrao = itau_cfg
        .as_ref()
        .map(|c| c.especie_padrao.clone())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "04".to_string());

    // Se já tem nosso_numero e está pendente: consulta primeiro
    if fatura.gateway_name.as_deref() == Some("itau")
        && fatura.gateway_emissao_pendente
        && fatura.nosso_numero.is_some()
    {
        let nosso_numero = fatura.nosso_numero.as_deref().ok_or_else(|| {
            ItauApiError::App(AppError::InternalServerError(
                "nosso_numero ausente".to_string(),
            ))
        })?;

        let consulta = crate::services::itau_api::consultar_boleto(
            &state.config,
            &mut db,
            tenant_id,
            &id_beneficiario,
            nosso_numero,
        )
        .await?;

        if let Some(boleto) = consulta {
            return gravar_sucesso_emissao(&mut db, tenant_id, auth_user.id, fatura_id, &boleto)
                .await;
        }

        // Não achou na consulta -> emitir de novo com o mesmo nosso_numero (não reservar outro)
        let pagador = obter_e_validar_pagador(&mut db, fatura_id, tenant_id).await?;
        validar_vencimento(fatura.data_vencimento)?;

        let params = DadosBolecodeParams {
            fatura_id,
            id_beneficiario: id_beneficiario.clone(),
            especie_padrao,
            chave_pix,
            nosso_numero: nosso_numero.to_string(),
            valor: fatura.valor,
            data_vencimento: fatura.data_vencimento,
            multa_percentual: fatura.multa_percentual,
            juros_mora_mes_percentual: fatura.juros_mora_mes_percentual,
            pagador,
        };

        let resposta = emitir_bolecode(&state.config, &mut db, tenant_id, &params).await;
        let ctx = ContextoProcessamento {
            db: &mut db,
            config: &state.config,
            tenant_id,
            user_id: auth_user.id,
            fatura_id,
            id_beneficiario: &id_beneficiario,
            nosso_numero,
        };
        return processar_resposta_emissao(resposta, ctx).await;
    }

    let pagador = obter_e_validar_pagador(&mut db, fatura_id, tenant_id).await?;
    validar_vencimento(fatura.data_vencimento)?;

    let nosso_numero = {
        let mut tx = db.begin().await?;
        let seq: i64 = sqlx::query_scalar(
            r#"
            UPDATE tenant_itau_config
            SET proximo_nosso_numero = proximo_nosso_numero + 1
            WHERE tenant_id = $1
            RETURNING proximo_nosso_numero - 1
            "#,
        )
        .bind(tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        if seq > 99_999_999 {
            return Err(ItauApiError::App(AppError::BadRequest(
                "Limite de nosso_numero excedido (máximo 99999999)".to_string(),
            )));
        }
        let n_num = format!("{:08}", seq);

        sqlx::query(
            r#"
            UPDATE faturas
            SET gateway_name = 'itau',
                nosso_numero = $1,
                gateway_emissao_pendente = true,
                updated_at = NOW()
            WHERE id = $2 AND tenant_id = $3
            "#,
        )
        .bind(&n_num)
        .bind(fatura_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        n_num
    };

    let params = DadosBolecodeParams {
        fatura_id,
        id_beneficiario: id_beneficiario.clone(),
        especie_padrao,
        chave_pix,
        nosso_numero: nosso_numero.clone(),
        valor: fatura.valor,
        data_vencimento: fatura.data_vencimento,
        multa_percentual: fatura.multa_percentual,
        juros_mora_mes_percentual: fatura.juros_mora_mes_percentual,
        pagador,
    };

    let resposta = emitir_bolecode(&state.config, &mut db, tenant_id, &params).await;
    let ctx = ContextoProcessamento {
        db: &mut db,
        config: &state.config,
        tenant_id,
        user_id: auth_user.id,
        fatura_id,
        id_beneficiario: &id_beneficiario,
        nosso_numero: &nosso_numero,
    };
    processar_resposta_emissao(resposta, ctx).await
}
