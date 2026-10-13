use super::*;

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

#[derive(serde::Deserialize)]
pub struct EmitirCoraDto {
    #[serde(default)]
    pub payment_forms: Option<Vec<String>>,
}

fn limpar_documento(doc: &str) -> String {
    doc.chars()
        .filter(|c| c.is_ascii_digit())
        .take(14)
        .collect()
}

fn tipo_documento(doc: &str) -> &'static str {
    if doc.len() > 11 {
        "CNPJ"
    } else {
        "CPF"
    }
}

fn stable_idempotency_key_for_fatura(fatura_id: Uuid) -> String {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, fatura_id.as_bytes()).to_string()
}

pub async fn emitir_cora_fatura(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(fatura_id): Path<Uuid>,
    Json(_dto): Json<EmitirCoraDto>,
) -> Result<Json<Fatura>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    if state.config.cora_mode == crate::config::CoraMode::Mock {
        return Err(AppError::BadRequest(
            "No modo simulado use o QR Code Pix local gerado pelo sistema.".to_string(),
        ));
    }

    let gateway = gateway_for(&state.config);

    let fatura =
        sqlx::query_as::<_, Fatura>("SELECT * FROM faturas WHERE id = $1 AND tenant_id = $2")
            .bind(fatura_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    if fatura.status == "pago" {
        return Err(AppError::Conflict(
            "Fatura já está paga; não é possível emitir nova cobrança.".to_string(),
        ));
    }

    if fatura.gateway_name.as_deref() == Some("cora") && fatura.gateway_invoice_id.is_some() {
        return Ok(Json(fatura));
    }

    let responsavel = sqlx::query_as::<
        _,
        (
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        ),
    >(
        r#"
        SELECT
            COALESCE(NULLIF(a.nome_responsavel_financeiro, ''), a.nome_responsavel) AS nome,
            COALESCE(NULLIF(a.cpf_responsavel_financeiro, ''), a.cpf) AS cpf,
            COALESCE(NULLIF(a.email_responsavel_financeiro, ''), a.email_responsavel) AS email,
            a.nome AS aluno_nome,
            a.cpf AS aluno_cpf
        FROM faturas f
        JOIN alunos a ON a.id = f.aluno_id AND a.tenant_id = f.tenant_id
        WHERE f.id = $1 AND f.tenant_id = $2
        "#,
    )
    .bind(fatura_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .unwrap_or((None, None, None, None, None));

    let nome = responsavel
        .0
        .clone()
        .or(responsavel.3.clone())
        .unwrap_or_else(|| "Responsável".to_string())
        .trim()
        .chars()
        .take(60)
        .collect::<String>();
    let documento_raw = responsavel
        .1
        .clone()
        .or(responsavel.4.clone())
        .unwrap_or_else(|| "00000000000".to_string());
    let documento = limpar_documento(&documento_raw);
    let email = responsavel
        .2
        .clone()
        .unwrap_or_else(|| "financeiro@escola.test".to_string())
        .trim()
        .chars()
        .take(60)
        .collect::<String>();

    let amount_cents = (fatura.valor * 100.0).round() as i64;
    let due_date = fatura.data_vencimento.format("%Y-%m-%d").to_string();

    let invoice_request = CoraCreateInvoiceRequest {
        code: fatura.id.to_string(),
        customer: CoraCustomer {
            name: nome,
            email,
            document: CoraDocument {
                identity: documento.clone(),
                document_type: tipo_documento(&documento).to_string(),
            },
        },
        services: vec![CoraService {
            name: "Mensalidade".to_string(),
            description: fatura.descricao.clone().chars().take(100).collect(),
            amount: amount_cents,
        }],
        payment_terms: CoraPaymentTerms {
            due_date,
            fine: Some(CoraFine {
                amount: None,
                rate: Some(fatura.multa_percentual),
            }),
            interest: Some(CoraInterest {
                rate: fatura.juros_mora_mes_percentual,
            }),
        },
        payment_forms: Some(vec!["BANK_SLIP".to_string(), "PIX".to_string()]),
    };

    let idempotency_key = stable_idempotency_key_for_fatura(fatura.id);

    let cora_invoice = gateway
        .create_invoice(&idempotency_key, invoice_request)
        .await?;

    let updated = sqlx::query_as::<_, Fatura>(
        r#"
        UPDATE faturas
        SET gateway_name = 'cora',
            gateway_invoice_id = $1,
            gateway_invoice_url = $2,
            gateway_pix_code = $3,
            gateway_digitable_line = $4,
            updated_at = NOW()
        WHERE id = $5 AND tenant_id = $6
        RETURNING *
        "#,
    )
    .bind(&cora_invoice.id)
    .bind(cora_invoice.boleto_url())
    .bind(cora_invoice.pix_emv())
    .bind(cora_invoice.digitable_line())
    .bind(fatura_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "EMITIR_COBRANCA_CORA",
        "faturas",
        Some(fatura_id.to_string()),
        Some(json!({
            "gateway_invoice_id": cora_invoice.id,
            "valor": fatura.valor,
            "responsavel_documento": documento
        })),
    )
    .await;

    Ok(Json(updated))
}

pub async fn simular_pagamento_cora_fatura(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(fatura_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    if state.config.cora_mode != crate::config::CoraMode::Sandbox {
        return Err(AppError::BadRequest(
            "Simulação de pagamento só é permitida no ambiente de testes (sandbox) da Cora."
                .to_string(),
        ));
    }

    let gateway = gateway_for(&state.config);

    let fatura = sqlx::query_as::<_, Fatura>(
        "SELECT * FROM faturas WHERE id = $1 AND tenant_id = $2 AND gateway_name = 'cora'",
    )
    .bind(fatura_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let cora_id = fatura.gateway_invoice_id.ok_or_else(|| {
        AppError::BadRequest("Fatura não possui identificador da Cora.".to_string())
    })?;

    gateway.simulate_payment(&cora_id).await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "SIMULAR_PAGAMENTO_CORA",
        "faturas",
        Some(fatura_id.to_string()),
        Some(json!({ "gateway_invoice_id": cora_id })),
    )
    .await;

    Ok(Json(json!({
        "status": "simulado",
        "gateway_invoice_id": cora_id
    })))
}
