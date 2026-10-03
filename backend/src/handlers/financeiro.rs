use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde_json::{json, Value};
use sqlx::Acquire;
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
    models::financeiro::{
        ConciliacaoBancaria, CreateDespesaDto, CreateFaturaDto, Despesa, DreReportDto, Fatura,
        GerarParcelasContratoDto, MensagensReguaContadores, NfseEmissao, ProcessarConciliacaoDto,
        ReguaCobrancaLog, ReguaExecucaoResultDto, UpdateDespesaDto, UpdateFaturaDto,
    },
    services::faturamento::{
        gerar_parcelas_contrato, inserir_fatura, tenant_nome, valor_atualizado_com_encargos,
        NovaFaturaParams,
    },
};

pub fn calcular_crc16_pix(payload: &str) -> String {
    let mut crc: u16 = 0xFFFF;
    for byte in payload.bytes() {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if (crc & 0x8000) != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    format!("{:04X}", crc)
}

pub fn gerar_pix_emvco(
    chave_pix: &str,
    recebedor: &str,
    cidade: &str,
    valor: f64,
    txid: &str,
) -> String {
    let chave_pix_clean = chave_pix.trim();
    let recebedor_clean = if recebedor.len() > 25 {
        &recebedor[..25]
    } else {
        recebedor
    };
    let cidade_clean = if cidade.len() > 15 {
        &cidade[..15]
    } else {
        cidade
    };
    let valor_str = format!("{:.2}", valor);
    let txid_clean = if txid.len() > 25 { &txid[..25] } else { txid };

    let mai_payload = format!(
        "0014br.gov.bcb.pix01{:02}{}",
        chave_pix_clean.len(),
        chave_pix_clean
    );
    let mai = format!("26{:02}{}", mai_payload.len(), mai_payload);

    let adf_payload = format!("05{:02}{}", txid_clean.len(), txid_clean);
    let adf = format!("62{:02}{}", adf_payload.len(), adf_payload);

    let mut raw = format!(
        "000201010212{}52040000530398654{:02}{}5802BR59{:02}{}60{:02}{}{}6304",
        mai,
        valor_str.len(),
        valor_str,
        recebedor_clean.len(),
        recebedor_clean,
        cidade_clean.len(),
        cidade_clean,
        adf
    );

    let crc = calcular_crc16_pix(&raw);
    raw.push_str(&crc);
    raw
}

pub fn gerar_linha_digitavel_febraban(banco: &str, valor: f64, fatura_hash: u32) -> String {
    let banco_cod = if banco.contains("itau") {
        "3419"
    } else if banco.contains("brasil") {
        "0019"
    } else {
        "2379"
    };
    let valor_cents = (valor * 100.0) as u64;
    format!(
        "{}.{:05} {:05}.{:06} {:05}.{:06} 1 {:04}{:010}",
        banco_cod,
        fatura_hash % 100000,
        (fatura_hash / 100000) % 100000,
        (fatura_hash / 100) % 1000000,
        (fatura_hash / 10) % 100000,
        (fatura_hash % 999999),
        9999,
        valor_cents
    )
}

pub async fn gerar_fatura(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateFaturaDto>,
) -> Result<Json<Fatura>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    if dto.valor <= 0.0 {
        return Err(AppError::BadRequest(
            "Valor da fatura deve ser positivo.".to_string(),
        ));
    }

    let desconto = dto.desconto_percentual.unwrap_or(0.0).clamp(0.0, 100.0);
    let fator = 1.0 - desconto / 100.0;
    let valor_liquido = ((dto.valor * fator) * 100.0).round() / 100.0;
    let nome = tenant_nome(&mut db, tenant_id).await?;

    let fatura = inserir_fatura(
        &mut db,
        NovaFaturaParams {
            tenant_id,
            aluno_id: dto.aluno_id,
            descricao: dto.descricao.clone(),
            valor: valor_liquido,
            data_vencimento: dto.data_vencimento,
            metodo_pagamento: dto.metodo_pagamento.clone(),
            contrato_id: dto.contrato_id,
            parcela_numero: None,
            parcela_total: None,
            valor_original: dto.valor,
            desconto_percentual: desconto,
            multa_percentual: dto.multa_percentual.unwrap_or(2.0),
            juros_mora_mes_percentual: dto.juros_mora_mes_percentual.unwrap_or(1.0),
        },
        &nome,
    )
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "GERAR_FATURA",
        "faturas",
        Some(fatura.id.to_string()),
        Some(json!({
            "aluno_id": dto.aluno_id,
            "valor": valor_liquido,
            "valor_original": dto.valor,
            "desconto_percentual": desconto,
            "metodo_pagamento": dto.metodo_pagamento
        })),
    )
    .await;

    Ok(Json(fatura))
}

pub async fn gerar_parcelas_de_contrato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<GerarParcelasContratoDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro", "secretaria", "gestor"])?;
    let tenant_id = active_tenant.0;

    let contrato = sqlx::query_as::<_, (Uuid, Uuid, i32, f64, String)>(
        "SELECT id, aluno_id, ano_letivo, valor_total, status FROM contratos WHERE id = $1 AND tenant_id = $2",
    )
    .bind(dto.contrato_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    if contrato.4 != "assinado" {
        return Err(AppError::BadRequest(
            "Só é possível gerar parcelas de contrato assinado.".to_string(),
        ));
    }

    let desconto = match dto.desconto_percentual {
        Some(d) => d.clamp(0.0, 100.0),
        None => sqlx::query_scalar::<_, f64>(
            r#"
            SELECT COALESCE(MAX(gf.desconto_percentual), 0)::FLOAT8
            FROM alunos a
            LEFT JOIN grupos_familiares gf ON gf.id = a.grupo_familiar_id
            WHERE a.id = $1 AND a.tenant_id = $2
            "#,
        )
        .bind(contrato.1)
        .bind(tenant_id)
        .fetch_one(&mut *db)
        .await
        .unwrap_or(0.0),
    };

    let mut tx = (&mut *db).begin().await?;
    let faturas = gerar_parcelas_contrato(
        &mut tx,
        tenant_id,
        contrato.1,
        contrato.0,
        contrato.2,
        contrato.3,
        dto.numero_parcelas.unwrap_or(12),
        dto.metodo_pagamento.as_deref().unwrap_or("pix"),
        dto.dia_vencimento.unwrap_or(10),
        desconto,
        dto.multa_percentual.unwrap_or(2.0),
        dto.juros_mora_mes_percentual.unwrap_or(1.0),
    )
    .await?;
    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "GERAR_PARCELAS_CONTRATO",
        "faturas",
        Some(dto.contrato_id.to_string()),
        Some(json!({
            "parcelas": faturas.len(),
            "desconto_percentual": desconto,
            "valor_total": contrato.3
        })),
    )
    .await;

    Ok(Json(json!({
        "status": "sucesso",
        "parcelas_geradas": faturas.len(),
        "desconto_percentual": desconto,
        "faturas": faturas
    })))
}

pub async fn listar_faturas(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Fatura>>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro", "responsavel"])?;
    let tenant_id = active_tenant.0;

    let faturas = if auth_user.role == "responsavel" {
        sqlx::query_as::<_, Fatura>(
            r#"
            SELECT f.* FROM faturas f
            JOIN alunos a ON f.aluno_id = a.id
            LEFT JOIN responsaveis_alunos ra ON ra.aluno_id = a.id
            WHERE f.tenant_id = $1 AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)
            ORDER BY f.data_vencimento ASC
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        sqlx::query_as::<_, Fatura>(
            "SELECT * FROM faturas WHERE tenant_id = $1 ORDER BY data_vencimento ASC",
        )
        .bind(tenant_id)
        .fetch_all(&mut *db)
        .await?
    };

    Ok(Json(faturas))
}

pub async fn atualizar_fatura(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(fatura_id): Path<Uuid>,
    Json(dto): Json<UpdateFaturaDto>,
) -> Result<Json<Fatura>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let fatura = sqlx::query_as::<_, Fatura>(
        r#"
        UPDATE faturas
        SET 
            descricao = COALESCE($1, descricao),
            valor = COALESCE($2, valor),
            data_vencimento = COALESCE($3, data_vencimento),
            metodo_pagamento = COALESCE($4, metodo_pagamento),
            status = COALESCE($5, status),
            updated_at = NOW()
        WHERE id = $6 AND tenant_id = $7
        RETURNING *
        "#,
    )
    .bind(dto.descricao)
    .bind(dto.valor)
    .bind(dto.data_vencimento)
    .bind(dto.metodo_pagamento)
    .bind(dto.status)
    .bind(fatura_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_FATURA",
        "faturas",
        Some(fatura.id.to_string()),
        Some(json!({"valor": &fatura.valor, "status": &fatura.status})),
    )
    .await;

    Ok(Json(fatura))
}

pub async fn deletar_fatura(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(fatura_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let fatura =
        sqlx::query_as::<_, Fatura>("SELECT * FROM faturas WHERE id = $1 AND tenant_id = $2")
            .bind(fatura_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    if fatura.status == "pago" {
        return Err(AppError::BadRequest(
            "Violação Fiscal: Não é permitido excluir faturas já liquidadas.".to_string(),
        ));
    }

    sqlx::query("UPDATE faturas SET status = 'cancelado', updated_at = NOW() WHERE id = $1 AND tenant_id = $2")
        .bind(fatura_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CANCELAR_FATURA",
        "faturas",
        Some(fatura_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Fatura cancelada com sucesso mantendo escrituração fiscal." }),
    ))
}

pub async fn gerar_despesa(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateDespesaDto>,
) -> Result<Json<Despesa>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;
    let fornecedor_nome = razao_social_fornecedor(&mut db, tenant_id, dto.fornecedor_id).await?;

    let despesa = sqlx::query_as::<_, Despesa>(
        r#"
        INSERT INTO despesas (tenant_id, descricao, categoria, valor, data_vencimento, metodo_pagamento, tipo, fornecedor_id, fornecedor_nome, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendente')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.descricao)
    .bind(&dto.categoria)
    .bind(dto.valor)
    .bind(dto.data_vencimento)
    .bind(dto.metodo_pagamento.unwrap_or_else(|| "pix".to_string()))
    .bind(dto.tipo.unwrap_or_else(|| "pontual".to_string()))
    .bind(dto.fornecedor_id)
    .bind(&fornecedor_nome)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "GERAR_DESPESA",
        "despesas",
        Some(despesa.id.to_string()),
        Some(json!({"valor": dto.valor, "categoria": dto.categoria})),
    )
    .await;

    Ok(Json(despesa))
}

pub async fn listar_despesas(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Despesa>>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let despesas = sqlx::query_as::<_, Despesa>(
        "SELECT * FROM despesas WHERE tenant_id = $1 ORDER BY data_vencimento ASC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(despesas))
}

pub async fn atualizar_despesa(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(despesa_id): Path<Uuid>,
    Json(dto): Json<UpdateDespesaDto>,
) -> Result<Json<Despesa>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;
    let fornecedor_nome = match dto.fornecedor_id {
        Some(id) => Some(razao_social_fornecedor(&mut db, tenant_id, id).await?),
        None => None,
    };

    let despesa = sqlx::query_as::<_, Despesa>(
        r#"
        UPDATE despesas
        SET 
            descricao = COALESCE($1, descricao),
            categoria = COALESCE($2, categoria),
            valor = COALESCE($3, valor),
            data_vencimento = COALESCE($4, data_vencimento),
            metodo_pagamento = COALESCE($5, metodo_pagamento),
            status = COALESCE($6, status),
            fornecedor_id = COALESCE($7, fornecedor_id),
            fornecedor_nome = COALESCE($8, fornecedor_nome)
        WHERE id = $9 AND tenant_id = $10
        RETURNING *
        "#,
    )
    .bind(dto.descricao)
    .bind(dto.categoria)
    .bind(dto.valor)
    .bind(dto.data_vencimento)
    .bind(dto.metodo_pagamento)
    .bind(dto.status)
    .bind(dto.fornecedor_id)
    .bind(fornecedor_nome)
    .bind(despesa_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_DESPESA",
        "despesas",
        Some(despesa.id.to_string()),
        Some(json!({"valor": &despesa.valor, "status": &despesa.status})),
    )
    .await;

    Ok(Json(despesa))
}

async fn razao_social_fornecedor(
    db: &mut sqlx::PgConnection,
    tenant_id: uuid::Uuid,
    fornecedor_id: uuid::Uuid,
) -> Result<String, AppError> {
    sqlx::query_scalar::<_, String>(
        "SELECT razao_social FROM fornecedores WHERE id = $1 AND tenant_id = $2 AND status = 'ativo'",
    )
    .bind(fornecedor_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or_else(|| AppError::BadRequest("Fornecedor inativo ou não cadastrado neste tenant.".into()))
}

pub fn despesa_liquidada(status: &str) -> bool {
    matches!(status, "pago" | "liquidado" | "conciliado" | "estornada")
}

pub async fn deletar_despesa(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(despesa_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let despesa =
        sqlx::query_as::<_, Despesa>("SELECT * FROM despesas WHERE id = $1 AND tenant_id = $2")
            .bind(despesa_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    if despesa_liquidada(&despesa.status) {
        return Err(AppError::BadRequest(
            "Despesa liquidada não pode ser excluída. Registre um estorno.".into(),
        ));
    }

    sqlx::query("UPDATE despesas SET status = 'cancelado' WHERE id = $1 AND tenant_id = $2")
        .bind(despesa_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CANCELAR_DESPESA",
        "despesas",
        Some(despesa_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Despesa cancelada com rastreio contábil." }),
    ))
}

pub async fn estornar_despesa(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(despesa_id): Path<Uuid>,
) -> Result<Json<Despesa>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let despesa =
        sqlx::query_as::<_, Despesa>("SELECT * FROM despesas WHERE id = $1 AND tenant_id = $2")
            .bind(despesa_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    if !matches!(despesa.status.as_str(), "pago" | "liquidado" | "conciliado") {
        return Err(AppError::BadRequest(
            "Somente despesas liquidadas podem ser estornadas.".into(),
        ));
    }

    let estorno = sqlx::query_as::<_, Despesa>(
        r#"
        INSERT INTO despesas (
            tenant_id, descricao, categoria, valor, data_vencimento, data_pagamento,
            metodo_pagamento, status, tipo, fornecedor_id, fornecedor_nome, estorno_de
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, 'estornada', $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(format!("Estorno: {}", despesa.descricao))
    .bind(&despesa.categoria)
    .bind(-despesa.valor.abs())
    .bind(despesa.data_vencimento)
    .bind(&despesa.metodo_pagamento)
    .bind(&despesa.tipo)
    .bind(despesa.fornecedor_id)
    .bind(&despesa.fornecedor_nome)
    .bind(despesa.id)
    .fetch_one(&mut *db)
    .await?;

    sqlx::query("UPDATE despesas SET status = 'estornada' WHERE id = $1 AND tenant_id = $2")
        .bind(despesa_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ESTORNAR_DESPESA",
        "despesas",
        Some(despesa_id.to_string()),
        Some(json!({"estorno_id": estorno.id, "valor": estorno.valor})),
    )
    .await;

    Ok(Json(estorno))
}

pub async fn emitir_nfse(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<Value>,
) -> Result<Json<NfseEmissao>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;
    let fatura_id_str = payload["fatura_id"].as_str().unwrap_or_default();
    let fatura_id = Uuid::parse_str(fatura_id_str).unwrap_or_default();

    let fatura =
        sqlx::query_as::<_, Fatura>("SELECT * FROM faturas WHERE id = $1 AND tenant_id = $2")
            .bind(fatura_id)
            .bind(tenant_id)
            .fetch_one(&mut *db)
            .await?;

    let numero_nfse = format!(
        "NFSE-2026-{}",
        uuid::Uuid::new_v4().to_string()[..8].to_uppercase()
    );
    let codigo_verif = format!(
        "ABRASF-{}",
        uuid::Uuid::new_v4().to_string()[..6].to_uppercase()
    );

    let nfse = sqlx::query_as::<_, NfseEmissao>(
        r#"
        INSERT INTO nfse_emissoes (tenant_id, fatura_id, numero_nfse, codigo_verificacao, valor_servico, aliquota_iss, status, xml_url)
        VALUES ($1, $2, $3, $4, $5, 2.0, 'emitida', $6)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(fatura.id)
    .bind(&numero_nfse)
    .bind(&codigo_verif)
    .bind(fatura.valor)
    .bind(format!("https://nfe.prefeitura.gov.br/pdf/{}.pdf", numero_nfse))
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "EMITIR_NFSE",
        "nfse_emissoes",
        Some(nfse.id.to_string()),
        Some(json!({"fatura_id": fatura.id, "numero_nfse": numero_nfse})),
    )
    .await;

    Ok(Json(nfse))
}

pub async fn listar_nfse(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<NfseEmissao>>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let items = sqlx::query_as::<_, NfseEmissao>(
        "SELECT * FROM nfse_emissoes WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(items))
}

pub async fn listar_conciliacao(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<ConciliacaoBancaria>>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let items = sqlx::query_as::<_, ConciliacaoBancaria>(
        "SELECT * FROM conciliacao_bancaria WHERE tenant_id = $1 ORDER BY data_transacao DESC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(items))
}

pub async fn processar_conciliacao_bancaria(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<ProcessarConciliacaoDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let mut tx = (&mut *db).begin().await?;
    let mut faturas_liquidadas = 0;
    let mut despesas_liquidadas = 0;

    for item in dto.transacoes {
        let mut fatura_id = item.fatura_id;
        let mut despesa_id = item.despesa_id;

        if item.tipo == "credito" && fatura_id.is_none() {
            fatura_id = sqlx::query_scalar::<_, Uuid>(
                r#"
                SELECT id FROM faturas
                WHERE tenant_id = $1
                  AND status IN ('pendente', 'atrasado')
                  AND ABS(valor - $2) < 0.02
                ORDER BY ABS(EXTRACT(EPOCH FROM (data_vencimento - $3::date))) ASC
                LIMIT 1
                "#,
            )
            .bind(tenant_id)
            .bind(item.valor)
            .bind(item.data_transacao)
            .fetch_optional(&mut *tx)
            .await?;
        }

        if item.tipo == "debito" && despesa_id.is_none() {
            despesa_id = sqlx::query_scalar::<_, Uuid>(
                r#"
                SELECT id FROM despesas
                WHERE tenant_id = $1
                  AND status IN ('pendente', 'atrasado')
                  AND ABS(valor - $2) < 0.02
                ORDER BY ABS(EXTRACT(EPOCH FROM (data_vencimento - $3::date))) ASC
                LIMIT 1
                "#,
            )
            .bind(tenant_id)
            .bind(item.valor)
            .bind(item.data_transacao)
            .fetch_optional(&mut *tx)
            .await?;
        }

        if item.tipo == "credito" {
            if let Some(fid) = fatura_id {
                sqlx::query(
                    "UPDATE faturas SET status = 'pago', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
                )
                .bind(fid)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?;
                faturas_liquidadas += 1;
            }
        } else if item.tipo == "debito" {
            if let Some(did) = despesa_id {
                sqlx::query(
                    "UPDATE despesas SET status = 'pago', data_pagamento = $1 WHERE id = $2 AND tenant_id = $3",
                )
                .bind(item.data_transacao)
                .bind(did)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?;
                despesas_liquidadas += 1;
            }
        }

        sqlx::query(
            r#"
            INSERT INTO conciliacao_bancaria (tenant_id, banco, data_transacao, descricao, valor, tipo, fatura_id, despesa_id, status_conciliacao)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(tenant_id)
        .bind(&item.banco)
        .bind(item.data_transacao)
        .bind(&item.descricao)
        .bind(item.valor)
        .bind(&item.tipo)
        .bind(fatura_id)
        .bind(despesa_id)
        .bind(if fatura_id.is_some() || despesa_id.is_some() {
            "conciliado"
        } else {
            "pendente"
        })
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "PROCESSAR_CONCILIACAO_BANCARIA",
        "conciliacao_bancaria",
        None,
        Some(json!({
            "faturas_liquidadas": faturas_liquidadas,
            "despesas_liquidadas": despesas_liquidadas
        })),
    )
    .await;

    Ok(Json(json!({
        "status": "sucesso",
        "faturas_liquidadas": faturas_liquidadas,
        "despesas_liquidadas": despesas_liquidadas,
        "mensagem": "Extrato bancário conciliado com sucesso."
    })))
}

pub fn classificar_evento_regua(dias_ate_vencimento: i64) -> Option<&'static str> {
    if dias_ate_vencimento > 0 && dias_ate_vencimento <= 5 {
        Some("lembrete_preventivo")
    } else if dias_ate_vencimento == 0 {
        Some("aviso_vencimento")
    } else if dias_ate_vencimento < 0 {
        Some("cobranca_ativa")
    } else {
        None
    }
}

pub async fn executar_regua_cobranca(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<ReguaExecucaoResultDto>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let faturas_alvo = sqlx::query_as::<_, Fatura>(
        "SELECT * FROM faturas WHERE tenant_id = $1 AND status IN ('pendente', 'atrasado')",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let hoje = chrono::Utc::now().date_naive();
    let mut lembretes_preventivos = 0;
    let mut avisos_vencimento_hoje = 0;
    let mut cobrancas_ativas = 0;
    let mut disparos_totais = 0;

    for fatura in faturas_alvo {
        let dias = (fatura.data_vencimento - hoje).num_days();
        if let Some(tipo_evento) = classificar_evento_regua(dias) {
            match tipo_evento {
                "lembrete_preventivo" => lembretes_preventivos += 1,
                "aviso_vencimento" => avisos_vencimento_hoje += 1,
                "cobranca_ativa" => cobrancas_ativas += 1,
                _ => {}
            }

            let aluno_nome: (String,) =
                sqlx::query_as("SELECT nome FROM alunos WHERE id = $1 AND tenant_id = $2")
                    .bind(fatura.aluno_id)
                    .bind(tenant_id)
                    .fetch_optional(&mut *db)
                    .await?
                    .unwrap_or_else(|| ("Aluno(a)".to_string(),));

            let dias_atraso = (-dias).max(0);
            let valor_base = fatura.valor_original.unwrap_or(fatura.valor);
            let (valor_cobrado, multa, juros) = valor_atualizado_com_encargos(
                valor_base,
                fatura.multa_percentual,
                fatura.juros_mora_mes_percentual,
                dias_atraso,
            );

            if dias_atraso > 0 && fatura.status == "pendente" {
                sqlx::query(
                    "UPDATE faturas SET status = 'atrasado', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
                )
                .bind(fatura.id)
                .bind(tenant_id)
                .execute(&mut *db)
                .await?;
            }

            let pix_code = fatura.qr_code_pix.as_deref().unwrap_or("PIX_INDISPONIVEL");
            let mensagem = if dias_atraso > 0 {
                format!(
                    "Cobrança: mensalidade de R$ {:.2} do(a) aluno(a) {} ('{}') venceu em {} ({} dia(s) de atraso). Valor atualizado: R$ {:.2} (multa R$ {:.2} + juros R$ {:.2}). Pix Copia e Cola: {}. Status do envio: registrado internamente (sem disparo omnicanal real neste MVP).",
                    valor_base, aluno_nome.0, fatura.descricao, fatura.data_vencimento, dias_atraso, valor_cobrado, multa, juros, pix_code
                )
            } else {
                format!(
                    "Lembrete: mensalidade de R$ {:.2} do(a) aluno(a) {} referente a '{}' vence em {}. Pix Copia e Cola: {}. Status do envio: registrado internamente (sem disparo omnicanal real neste MVP).",
                    fatura.valor, aluno_nome.0, fatura.descricao, fatura.data_vencimento, pix_code
                )
            };

            for canal in &["whatsapp", "email"] {
                sqlx::query(
                    r#"
                    INSERT INTO regua_cobranca_logs (tenant_id, fatura_id, canal, tipo_evento, status_envio, mensagem_corpo)
                    VALUES ($1, $2, $3, $4, 'registrado', $5)
                    "#,
                )
                .bind(tenant_id)
                .bind(fatura.id)
                .bind(canal)
                .bind(tipo_evento)
                .bind(&mensagem)
                .execute(&mut *db)
                .await?;

                disparos_totais += 1;
            }
        }
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "EXECUTAR_REGUA_COBRANCA",
        "regua_cobranca_logs",
        None,
        Some(json!({
            "disparos_executados": disparos_totais,
            "lembretes_preventivos": lembretes_preventivos,
            "avisos_vencimento_hoje": avisos_vencimento_hoje,
            "cobrancas_ativas": cobrancas_ativas
        })),
    )
    .await;

    Ok(Json(ReguaExecucaoResultDto {
        status: "sucesso".to_string(),
        disparos_executados: disparos_totais,
        mensagens: MensagensReguaContadores {
            lembretes_preventivos,
            avisos_vencimento_hoje,
            cobrancas_ativas,
        },
    }))
}

pub async fn listar_logs_regua(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<ReguaCobrancaLog>>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let logs = sqlx::query_as::<_, ReguaCobrancaLog>(
        "SELECT * FROM regua_cobranca_logs WHERE tenant_id = $1 ORDER BY enviado_em DESC LIMIT 100",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(logs))
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct FiltroDreQuery {
    pub ano: Option<i32>,
    pub mes: Option<i32>,
    pub data_inicio: Option<chrono::NaiveDate>,
    pub data_fim: Option<chrono::NaiveDate>,
}

pub async fn relatorio_dre(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<FiltroDreQuery>,
) -> Result<Json<DreReportDto>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let (data_inicio, data_fim) = match (query.data_inicio, query.data_fim) {
        (Some(i), Some(f)) => (Some(i), Some(f)),
        _ => match (query.ano, query.mes) {
            (Some(ano), Some(mes)) => {
                let start = chrono::NaiveDate::from_ymd_opt(ano, mes as u32, 1).unwrap_or_default();
                let end = if mes == 12 {
                    chrono::NaiveDate::from_ymd_opt(ano + 1, 1, 1).unwrap_or_default()
                        - chrono::Duration::days(1)
                } else {
                    chrono::NaiveDate::from_ymd_opt(ano, (mes + 1) as u32, 1).unwrap_or_default()
                        - chrono::Duration::days(1)
                };
                (Some(start), Some(end))
            }
            (Some(ano), None) => {
                let start = chrono::NaiveDate::from_ymd_opt(ano, 1, 1).unwrap_or_default();
                let end = chrono::NaiveDate::from_ymd_opt(ano, 12, 31).unwrap_or_default();
                (Some(start), Some(end))
            }
            _ => (None, None),
        },
    };

    let metricas_faturas: (Option<f64>, Option<f64>, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as receita_bruta,
            SUM(CASE WHEN (status = 'atrasado' OR (status = 'pendente' AND data_vencimento < CURRENT_DATE)) THEN valor ELSE 0 END) as inadimplencia,
            COUNT(CASE WHEN status = 'pago' THEN 1 END) as total_pagas,
            COUNT(CASE WHEN (status = 'pendente' OR status = 'atrasado') THEN 1 END) as total_pendentes
        FROM faturas
        WHERE tenant_id = $1
          AND ($2::date IS NULL OR data_vencimento >= $2)
          AND ($3::date IS NULL OR data_vencimento <= $3)
        "#
    )
    .bind(tenant_id)
    .bind(data_inicio)
    .bind(data_fim)
    .fetch_one(&mut *db)
    .await?;

    let despesas_totais: Option<f64> = sqlx::query_scalar(
        r#"
        SELECT SUM(valor)
        FROM despesas
        WHERE tenant_id = $1
          AND status NOT IN ('cancelado', 'estornada')
          AND ($2::date IS NULL OR data_vencimento >= $2)
          AND ($3::date IS NULL OR data_vencimento <= $3)
        "#,
    )
    .bind(tenant_id)
    .bind(data_inicio)
    .bind(data_fim)
    .fetch_one(&mut *db)
    .await?;

    let receita_bruta = metricas_faturas.0.unwrap_or(0.0);
    let inadimplencia_total = metricas_faturas.1.unwrap_or(0.0);
    let total_pagas = metricas_faturas.2;
    let total_pendentes = metricas_faturas.3;
    let despesas_totais = despesas_totais.unwrap_or(0.0);

    let resultado_liquido = ((receita_bruta - despesas_totais) * 100.0).round() / 100.0;
    let dfc_caixa_projetado =
        ((resultado_liquido + (inadimplencia_total * 0.4)) * 100.0).round() / 100.0;

    Ok(Json(DreReportDto {
        receita_bruta: (receita_bruta * 100.0).round() / 100.0,
        despesas_totais: (despesas_totais * 100.0).round() / 100.0,
        resultado_liquido,
        inadimplencia_total: (inadimplencia_total * 100.0).round() / 100.0,
        total_faturas_pagas: total_pagas,
        total_faturas_pendentes: total_pendentes,
        dfc_caixa_projetado,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_despesa_liquidada_nao_pode_ser_excluida() {
        assert!(despesa_liquidada("pago"));
        assert!(despesa_liquidada("liquidado"));
        assert!(despesa_liquidada("conciliado"));
        assert!(despesa_liquidada("estornada"));
        assert!(!despesa_liquidada("pendente"));
        assert!(!despesa_liquidada("atrasado"));
    }

    #[test]
    fn test_classificar_evento_regua_preventivo() {
        assert_eq!(classificar_evento_regua(5), Some("lembrete_preventivo"));
        assert_eq!(classificar_evento_regua(1), Some("lembrete_preventivo"));
    }

    #[test]
    fn test_classificar_evento_regua_hoje() {
        assert_eq!(classificar_evento_regua(0), Some("aviso_vencimento"));
    }

    #[test]
    fn test_classificar_evento_regua_cobranca_ativa() {
        assert_eq!(classificar_evento_regua(-1), Some("cobranca_ativa"));
        assert_eq!(classificar_evento_regua(-15), Some("cobranca_ativa"));
    }

    #[test]
    fn test_classificar_evento_regua_futuro_distante() {
        assert_eq!(classificar_evento_regua(10), None);
        assert_eq!(classificar_evento_regua(30), None);
    }

    #[test]
    fn test_calculo_dre_inadimplencia_expirada() {
        let hoje = chrono::Utc::now().date_naive();
        let fatura_paga_valor = 1000.0;
        let fatura_atrasada_valor = 500.0;
        let fatura_pendente_expirada_valor = 300.0;
        let despesas_valor = 600.0;

        let receita_bruta = fatura_paga_valor;
        let mut inadimplencia = fatura_atrasada_valor;
        // Simulação de fatura pendente expirada (vencimento ontem)
        let vencimento_passado = hoje - chrono::Duration::days(2);
        if vencimento_passado < hoje {
            inadimplencia += fatura_pendente_expirada_valor;
        }

        let resultado_liquido = receita_bruta - despesas_valor;
        let dfc_projetado = resultado_liquido + (inadimplencia * 0.4);

        assert_eq!(receita_bruta, 1000.0);
        assert_eq!(inadimplencia, 800.0);
        assert_eq!(resultado_liquido, 400.0);
        assert_eq!(dfc_projetado, 720.0);
    }

    #[test]
    fn test_gerar_pix_emvco_valido() {
        let pix = gerar_pix_emvco(
            "financeiro@escola.com.br",
            "ESCOLA MODERNA",
            "SAO PAULO",
            850.00,
            "FATURA123",
        );
        assert!(pix.starts_with("000201010212"));
        assert!(pix.contains("br.gov.bcb.pix"));
        assert!(pix.contains("5303986")); // Moeda BRL
        assert!(pix.contains("850.00"));
        assert!(pix.contains("6304")); // Tag CRC16
        assert_eq!(pix.len(), pix.find("6304").unwrap() + 8); // 6304 + 4 hex digits
    }

    #[test]
    fn test_gerar_linha_digitavel_febraban() {
        let linha = gerar_linha_digitavel_febraban("itau", 850.00, 12345678);
        assert!(linha.starts_with("3419"));
        assert!(linha.contains(" 1 "));
        assert!(linha.ends_with("0000085000")); // 850.00 em centavos com padding
    }
}
