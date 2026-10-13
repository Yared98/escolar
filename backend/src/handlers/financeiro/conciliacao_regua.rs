use super::*;

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
