use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    config::{AppState, ItauMode},
    db::TenantDb,
    error::AppError,
    middleware::{auth::AuthUser, rbac::check_roles, tenant::ActiveTenant},
    services::{
        audit::log_audit,
        itau_api::{
            emitir_bolecode, validar_pagador, DadosBolecodeParams, DadosPagador, ItauApiError,
            RespostaEmissao,
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

    let id_beneficiario = itau_cfg
        .as_ref()
        .and_then(|c| c.id_beneficiario.clone())
        .unwrap_or_else(|| "150000052061".to_string());
    let especie_padrao = itau_cfg
        .as_ref()
        .map(|c| c.especie_padrao.clone())
        .unwrap_or_else(|| "04".to_string());
    let chave_pix = itau_cfg
        .as_ref()
        .and_then(|c| c.chave_pix.clone())
        .unwrap_or_else(|| "12345678000190".to_string());

    // Se já tem nosso_numero e está pendente: consulta em vez de reemitir
    if fatura.gateway_name.as_deref() == Some("itau")
        && fatura.gateway_emissao_pendente
        && fatura.nosso_numero.is_some()
    {
        let nosso_numero = fatura.nosso_numero.clone().unwrap();
        let consulta = crate::services::itau_api::consultar_boleto(
            &state.config,
            &mut db,
            tenant_id,
            &id_beneficiario,
            &nosso_numero,
        )
        .await?;

        if let Some(boleto) = consulta {
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
                Some(auth_user.id),
                "itau_emissao",
                "faturas",
                Some(fatura_id.to_string()),
                Some(json!({
                    "fatura_id": fatura_id,
                    "nosso_numero": boleto.nosso_numero,
                    "gateway_invoice_id": boleto.id_boleto_individual
                })),
            )
            .await;

            return Ok((StatusCode::OK, Json(json!(updated))).into_response());
        } else {
            return Ok((
                StatusCode::ACCEPTED,
                Json(json!({
                    "status": "pendente",
                    "mensagem": "emissão em andamento",
                    "nosso_numero": nosso_numero
                })),
            )
                .into_response());
        }
    }

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
    .fetch_optional(&mut *db)
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

    let hoje = chrono::Utc::now().date_naive();
    if fatura.data_vencimento < hoje {
        return Err(ItauApiError::App(AppError::BadRequest(
            "Data de vencimento não pode estar no passado.".to_string(),
        )));
    }

    let seq: i64 = sqlx::query_scalar(
        r#"
        UPDATE tenant_itau_config
        SET proximo_nosso_numero = proximo_nosso_numero + 1
        WHERE tenant_id = $1
        RETURNING proximo_nosso_numero - 1
        "#,
    )
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if seq > 99_999_999 {
        return Err(ItauApiError::App(AppError::BadRequest(
            "Limite de nosso_numero excedido (máximo 99999999)".to_string(),
        )));
    }
    let nosso_numero = format!("{:08}", seq);

    let params = DadosBolecodeParams {
        fatura_id,
        id_beneficiario,
        especie_padrao,
        chave_pix,
        nosso_numero: nosso_numero.clone(),
        valor: fatura.valor,
        data_vencimento: fatura.data_vencimento,
        multa_percentual: fatura.multa_percentual,
        juros_mora_mes_percentual: fatura.juros_mora_mes_percentual,
        pagador,
    };

    let resposta = emitir_bolecode(&state.config, &mut db, tenant_id, &params).await?;

    match resposta {
        RespostaEmissao::Sucesso(boleto) => {
            let updated: FaturaItauView = sqlx::query_as(
                r#"
                UPDATE faturas
                SET gateway_name = 'itau',
                    gateway_invoice_id = $1,
                    gateway_digitable_line = $2,
                    gateway_pix_code = $3,
                    codigo_barras = $4,
                    nosso_numero = $5,
                    gateway_txid = $6,
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
                Some(auth_user.id),
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
        RespostaEmissao::Pendente { nosso_numero } => {
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
            .bind(&nosso_numero)
            .bind(fatura_id)
            .bind(tenant_id)
            .execute(&mut *db)
            .await?;

            log_audit(
                &mut *db,
                tenant_id,
                Some(auth_user.id),
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
        RespostaEmissao::Rejeitado { status, corpo } => Ok((
            StatusCode::from_u16(status).unwrap_or(StatusCode::UNPROCESSABLE_ENTITY),
            Json(corpo),
        )
            .into_response()),
    }
}
