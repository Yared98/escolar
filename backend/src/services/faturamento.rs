//! Geração de cobranças (Pix EMVCo local + boleto sintético) e parcelamento de contratos.

use chrono::NaiveDate;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::error::AppError;
use crate::handlers::financeiro::{gerar_linha_digitavel_febraban, gerar_pix_emvco};
use crate::models::financeiro::Fatura;

#[derive(Debug, Clone)]
pub struct NovaFaturaParams {
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub descricao: String,
    pub valor: f64,
    pub data_vencimento: NaiveDate,
    pub metodo_pagamento: String,
    pub contrato_id: Option<Uuid>,
    pub parcela_numero: Option<i32>,
    pub parcela_total: Option<i32>,
    pub valor_original: f64,
    pub desconto_percentual: f64,
    pub multa_percentual: f64,
    pub juros_mora_mes_percentual: f64,
}

pub async fn tenant_nome(db: &mut PgConnection, tenant_id: Uuid) -> Result<String, AppError> {
    Ok(
        sqlx::query_scalar::<_, String>("SELECT name FROM tenants WHERE id = $1")
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .unwrap_or_else(|| "ESCOLA MODELO".to_string()),
    )
}

pub fn montar_cobranca(
    tenant_nome: &str,
    valor: f64,
    metodo: &str,
) -> (Option<String>, Option<String>) {
    let txid = format!("ESC{}", &Uuid::new_v4().to_string().replace('-', "")[..16]);
    let pix_key = format!(
        "financeiro@{}.edu.br",
        tenant_nome.to_lowercase().replace([' ', '-'], "")
    );
    let qr = gerar_pix_emvco(
        &pix_key,
        &tenant_nome.to_uppercase(),
        "SAO PAULO",
        valor,
        &txid,
    );
    let linha = if metodo == "boleto" {
        Some(gerar_linha_digitavel_febraban("itau", valor, 12345678))
    } else {
        None
    };
    (linha, Some(qr))
}

pub async fn inserir_fatura(
    db: &mut PgConnection,
    params: NovaFaturaParams,
    tenant_nome: &str,
) -> Result<Fatura, AppError> {
    let (linha, qr) = montar_cobranca(tenant_nome, params.valor, &params.metodo_pagamento);

    let fatura = sqlx::query_as::<_, Fatura>(
        r#"
        INSERT INTO faturas (
            tenant_id, aluno_id, descricao, valor, data_vencimento, metodo_pagamento, status,
            linha_digitavel, qr_code_pix,
            contrato_id, parcela_numero, parcela_total, valor_original,
            desconto_percentual, multa_percentual, juros_mora_mes_percentual
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, 'pendente',
            $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15
        )
        RETURNING *
        "#,
    )
    .bind(params.tenant_id)
    .bind(params.aluno_id)
    .bind(&params.descricao)
    .bind(params.valor)
    .bind(params.data_vencimento)
    .bind(&params.metodo_pagamento)
    .bind(linha)
    .bind(qr)
    .bind(params.contrato_id)
    .bind(params.parcela_numero)
    .bind(params.parcela_total)
    .bind(params.valor_original)
    .bind(params.desconto_percentual)
    .bind(params.multa_percentual)
    .bind(params.juros_mora_mes_percentual)
    .fetch_one(&mut *db)
    .await?;

    Ok(fatura)
}

/// Valor devido com multa (fixa após vencimento) + juros pro-rata dia (taxa mensal / 30).
pub fn valor_atualizado_com_encargos(
    valor_base: f64,
    multa_percentual: f64,
    juros_mora_mes_percentual: f64,
    dias_atraso: i64,
) -> (f64, f64, f64) {
    if dias_atraso <= 0 {
        return (valor_base, 0.0, 0.0);
    }
    let multa = ((valor_base * multa_percentual / 100.0) * 100.0).round() / 100.0;
    let juros =
        ((valor_base * juros_mora_mes_percentual / 100.0) * (dias_atraso as f64 / 30.0) * 100.0)
            .round()
            / 100.0;
    let total = ((valor_base + multa + juros) * 100.0).round() / 100.0;
    (total, multa, juros)
}

#[allow(clippy::too_many_arguments)] // API publica mantida para geracao de parcelas de contrato escolar
pub async fn gerar_parcelas_contrato(
    db: &mut PgConnection,
    tenant_id: Uuid,
    aluno_id: Uuid,
    contrato_id: Uuid,
    ano_letivo: i32,
    valor_total: f64,
    numero_parcelas: i32,
    metodo_pagamento: &str,
    dia_vencimento: u32,
    desconto_percentual: f64,
    multa_percentual: f64,
    juros_mora_mes_percentual: f64,
) -> Result<Vec<Fatura>, AppError> {
    if !(1..=24).contains(&numero_parcelas) {
        return Err(AppError::BadRequest(
            "Número de parcelas deve estar entre 1 e 24.".to_string(),
        ));
    }
    if valor_total <= 0.0 {
        return Err(AppError::BadRequest(
            "Valor total do contrato deve ser positivo.".to_string(),
        ));
    }

    let existentes = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM faturas WHERE tenant_id = $1 AND contrato_id = $2 AND status <> 'cancelado'",
    )
    .bind(tenant_id)
    .bind(contrato_id)
    .fetch_one(&mut *db)
    .await?;

    if existentes > 0 {
        return Err(AppError::BadRequest(
            "Este contrato já possui parcelas geradas.".to_string(),
        ));
    }

    let nome = tenant_nome(db, tenant_id).await?;
    let fator = (1.0 - desconto_percentual / 100.0).max(0.0);
    let valor_liquido = ((valor_total * fator) * 100.0).round() / 100.0;
    let parcela_base = ((valor_liquido / numero_parcelas as f64) * 100.0).floor() / 100.0;
    let mut resto =
        ((valor_liquido - parcela_base * numero_parcelas as f64) * 100.0).round() / 100.0;

    let mut faturas = Vec::with_capacity(numero_parcelas as usize);
    let dia = dia_vencimento.clamp(1, 28);

    for i in 1..=numero_parcelas {
        let mut valor = parcela_base;
        if resto > 0.0 {
            valor = ((valor + 0.01) * 100.0).round() / 100.0;
            resto = ((resto - 0.01) * 100.0).round() / 100.0;
        }

        let mes = i;
        let ano = ano_letivo;
        let data_vencimento = NaiveDate::from_ymd_opt(ano, mes as u32, dia).unwrap_or_else(|| {
            NaiveDate::from_ymd_opt(ano, mes.min(12) as u32, 28)
                .unwrap_or(NaiveDate::from_ymd_opt(ano, 1, 10).unwrap())
        });

        let fatura = inserir_fatura(
            db,
            NovaFaturaParams {
                tenant_id,
                aluno_id,
                descricao: format!(
                    "Mensalidade {}/{} — Anuidade {}",
                    i, numero_parcelas, ano_letivo
                ),
                valor,
                data_vencimento,
                metodo_pagamento: metodo_pagamento.to_string(),
                contrato_id: Some(contrato_id),
                parcela_numero: Some(i),
                parcela_total: Some(numero_parcelas),
                valor_original: valor,
                desconto_percentual,
                multa_percentual,
                juros_mora_mes_percentual,
            },
            &nome,
        )
        .await?;
        faturas.push(fatura);
    }

    Ok(faturas)
}
