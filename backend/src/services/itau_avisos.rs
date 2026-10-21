use sha2::Digest;
use sqlx::Acquire;
use uuid::Uuid;

use crate::config::AppState;
use crate::error::AppError;

pub fn iniciar_reprocessador_avisos(state: AppState) {
    tokio::spawn(async move {
        let mut intervalo = tokio::time::interval(std::time::Duration::from_secs(300));
        loop {
            intervalo.tick().await;
            if let Err(e) = executar_ciclo_reprocessamento(&state).await {
                tracing::warn!(error = %e, "erro no ciclo periódico de reprocessamento de avisos Itaú");
            }
        }
    });
}

pub async fn executar_ciclo_reprocessamento(state: &AppState) -> Result<(), AppError> {
    let tenants: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM tenants")
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    for tenant_id in tenants {
        if let Err(e) = processar_pendentes(state, tenant_id).await {
            tracing::warn!(tenant_id = %tenant_id, error = %e, "falha ao processar avisos pendentes do tenant");
        }
    }
    Ok(())
}

pub async fn processar_pendentes(state: &AppState, tenant_id: Uuid) -> Result<(), AppError> {
    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    let config_row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT id_beneficiario FROM tenant_itau_config WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;

    let id_beneficiario = config_row.and_then(|r| r.0).unwrap_or_default();

    let avisos = sqlx::query_as::<_, (Uuid, String, String, serde_json::Value, i32)>(
        r#"
        SELECT id, tipo, event_id, payload, tentativas
        FROM gateway_avisos
        WHERE tenant_id = $1
          AND gateway_name = 'itau'
          AND status = 'pendente'
          AND proxima_tentativa_em <= NOW()
        ORDER BY created_at ASC
        LIMIT 50
        "#,
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    for (aviso_id, tipo, event_id, payload, tentativas) in avisos {
        let status_atual: Option<String> = sqlx::query_scalar(
            "SELECT status FROM gateway_avisos WHERE id = $1 AND tenant_id = $2",
        )
        .bind(aviso_id)
        .bind(tenant_id)
        .fetch_optional(&mut *db)
        .await?;

        if status_atual.as_deref() != Some("pendente") {
            continue;
        }

        if tipo == "pix" {
            let consulta_res = crate::services::itau_api::consultar_pix(
                &state.config,
                &mut db,
                tenant_id,
                &event_id,
            )
            .await;

            let pix_detalhe = match consulta_res {
                Ok(Some(p)) if p.end_to_end_id == event_id => p,
                Ok(Some(_)) | Ok(None) | Err(_) => {
                    let novas_tentativas = tentativas + 1;
                    if novas_tentativas >= 12 {
                        let mut tx = db.begin().await?;
                        sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                            .bind(tenant_id.to_string())
                            .execute(&mut *tx)
                            .await?;

                        let res = sqlx::query(
                            "UPDATE gateway_avisos SET status = 'descartado', tentativas = $1, ultimo_erro = 'Limite de 12 tentativas atingido na consulta do Itaú', updated_at = NOW() WHERE id = $2 AND tenant_id = $3 AND status = 'pendente'",
                        )
                        .bind(novas_tentativas)
                        .bind(aviso_id)
                        .bind(tenant_id)
                        .execute(&mut *tx)
                        .await?;

                        if res.rows_affected() == 0 {
                            tx.commit().await?;
                            continue;
                        }

                        sqlx::query(
                            r#"
                            INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                            VALUES ($1, 'itau_aviso_descartado', 'gateway_avisos', $2, $3)
                            "#,
                        )
                        .bind(tenant_id)
                        .bind(aviso_id.to_string())
                        .bind(serde_json::json!({
                            "event_id": event_id,
                            "motivo": "consulta_falhou_repetidamente"
                        }))
                        .execute(&mut *tx)
                        .await?;

                        tx.commit().await?;
                    } else {
                        let proxima = chrono::Utc::now()
                            + chrono::Duration::minutes((novas_tentativas * 5) as i64);
                        let erro_msg = "Falha ao consultar pix no Itaú".to_string();
                        sqlx::query(
                            "UPDATE gateway_avisos SET tentativas = $1, proxima_tentativa_em = $2, ultimo_erro = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5",
                        )
                        .bind(novas_tentativas)
                        .bind(proxima)
                        .bind(erro_msg)
                        .bind(aviso_id)
                        .bind(tenant_id)
                        .execute(&mut *db)
                        .await?;
                    }
                    continue;
                }
            };

            let status_recheck: Option<String> = sqlx::query_scalar(
                "SELECT status FROM gateway_avisos WHERE id = $1 AND tenant_id = $2",
            )
            .bind(aviso_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;

            if status_recheck.as_deref() != Some("pendente") {
                continue;
            }

            let txid_consulta = pix_detalhe.txid.as_deref().unwrap_or("");
            let fatura_opt = if !txid_consulta.is_empty() {
                sqlx::query_as::<_, (Uuid, f64, String)>(
                    r#"
                    SELECT id, valor, status
                    FROM faturas
                    WHERE tenant_id = $1
                      AND gateway_txid IS NOT NULL
                      AND gateway_txid = $2
                    LIMIT 1
                    "#,
                )
                .bind(tenant_id)
                .bind(txid_consulta)
                .fetch_optional(&mut *db)
                .await?
            } else {
                None
            };

            let (fatura_id, fatura_valor, fatura_status) = match fatura_opt {
                Some(f) => f,
                None => {
                    let mut tx = db.begin().await?;
                    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                        .bind(tenant_id.to_string())
                        .execute(&mut *tx)
                        .await?;

                    let res = sqlx::query(
                        "UPDATE gateway_avisos SET status = 'descartado', ultimo_erro = 'Fatura não encontrada', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'",
                    )
                    .bind(aviso_id)
                    .bind(tenant_id)
                    .execute(&mut *tx)
                    .await?;

                    if res.rows_affected() == 0 {
                        tx.commit().await?;
                        continue;
                    }

                    sqlx::query(
                        r#"
                        INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                        VALUES ($1, 'itau_aviso_descartado', 'gateway_avisos', $2, $3)
                        "#,
                    )
                    .bind(tenant_id)
                    .bind(aviso_id.to_string())
                    .bind(serde_json::json!({
                        "event_id": event_id,
                        "motivo": "fatura_nao_encontrada",
                        "txid": txid_consulta
                    }))
                    .execute(&mut *tx)
                    .await?;

                    tx.commit().await?;
                    continue;
                }
            };

            if fatura_status == "pago" {
                let payload_hash = hex::encode(sha2::Sha256::digest(
                    serde_json::to_string(&payload)
                        .unwrap_or_default()
                        .as_bytes(),
                ));
                let mut tx = db.begin().await?;
                sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                    .bind(tenant_id.to_string())
                    .execute(&mut *tx)
                    .await?;

                sqlx::query(
                    "INSERT INTO webhook_events (tenant_id, gateway_name, event_id, payload_hash) VALUES ($1, 'itau', $2, $3) ON CONFLICT (tenant_id, gateway_name, event_id) DO NOTHING",
                )
                .bind(tenant_id)
                .bind(&event_id)
                .bind(&payload_hash)
                .execute(&mut *tx)
                .await?;

                sqlx::query(
                    "UPDATE gateway_avisos SET status = 'confirmado', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
                )
                .bind(aviso_id)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?;

                tx.commit().await?;
                continue;
            }

            let valor_pago = pix_detalhe.valor;
            if valor_pago < fatura_valor - 0.01 {
                let mut tx = db.begin().await?;
                sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                    .bind(tenant_id.to_string())
                    .execute(&mut *tx)
                    .await?;

                let res = sqlx::query(
                    "UPDATE gateway_avisos SET status = 'descartado', ultimo_erro = 'Valor pago menor que o valor da fatura', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'",
                )
                .bind(aviso_id)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?;

                if res.rows_affected() == 0 {
                    tx.commit().await?;
                    continue;
                }

                sqlx::query(
                    r#"
                    INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                    VALUES ($1, 'webhook_valor_divergente', 'faturas', $2, $3)
                    "#,
                )
                .bind(tenant_id)
                .bind(fatura_id.to_string())
                .bind(serde_json::json!({
                    "fatura_id": fatura_id,
                    "fatura_valor": fatura_valor,
                    "valor_pago": valor_pago,
                    "event_id": event_id,
                    "gateway_name": "itau"
                }))
                .execute(&mut *tx)
                .await?;

                tx.commit().await?;
                continue;
            }

            let payload_hash = hex::encode(sha2::Sha256::digest(
                serde_json::to_string(&payload)
                    .unwrap_or_default()
                    .as_bytes(),
            ));
            let mut tx = db.begin().await?;
            sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                .bind(tenant_id.to_string())
                .execute(&mut *tx)
                .await?;

            let insert_res = sqlx::query(
                "INSERT INTO webhook_events (tenant_id, gateway_name, event_id, payload_hash) VALUES ($1, 'itau', $2, $3) ON CONFLICT (tenant_id, gateway_name, event_id) DO NOTHING",
            )
            .bind(tenant_id)
            .bind(&event_id)
            .bind(&payload_hash)
            .execute(&mut *tx)
            .await?;

            if insert_res.rows_affected() == 0 {
                sqlx::query(
                    "UPDATE gateway_avisos SET status = 'confirmado', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
                )
                .bind(aviso_id)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?;
                tx.commit().await?;
                continue;
            }

            sqlx::query(
                "UPDATE faturas SET status = 'pago', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status != 'pago'",
            )
            .bind(fatura_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                r#"
                INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                VALUES ($1, 'itau_baixa_pix', 'faturas', $2, $3)
                "#,
            )
            .bind(tenant_id)
            .bind(fatura_id.to_string())
            .bind(serde_json::json!({
                "fatura_id": fatura_id,
                "fatura_valor": fatura_valor,
                "valor_pago": valor_pago,
                "event_id": event_id,
                "gateway_name": "itau"
            }))
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                "UPDATE gateway_avisos SET status = 'confirmado', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
            )
            .bind(aviso_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
            continue;
        }

        let tipo_liquidacao = payload
            .get("tipoLiquidacao")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if tipo_liquidacao == "95" {
            let mut tx = db.begin().await?;
            sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                .bind(tenant_id.to_string())
                .execute(&mut *tx)
                .await?;

            let update_res = sqlx::query(
                "UPDATE gateway_avisos SET status = 'confirmado', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'",
            )
            .bind(aviso_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;

            if update_res.rows_affected() == 0 {
                tx.commit().await?;
                continue;
            }

            let id_boleto = payload
                .get("idBoleto")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            sqlx::query(
                r#"
                INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                VALUES ($1, 'itau_pagamento_informado', 'gateway_avisos', $2, $3)
                "#,
            )
            .bind(tenant_id)
            .bind(aviso_id.to_string())
            .bind(serde_json::json!({
                "event_id": event_id,
                "id_boleto": id_boleto,
                "tipo_liquidacao": "95"
            }))
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
            continue;
        }

        if tipo_liquidacao == "06" {
            let id_boleto = payload
                .get("idBoleto")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let nosso_numero_fmt = if let Some(n) = payload.get("numeroNossoNumero") {
                if let Some(num) = n.as_i64() {
                    format!("{:08}", num)
                } else if let Some(s) = n.as_str() {
                    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
                    if let Ok(num) = digits.parse::<i64>() {
                        format!("{:08}", num)
                    } else {
                        s.to_string()
                    }
                } else {
                    String::new()
                }
            } else {
                String::new()
            };

            let fatura_opt = sqlx::query_as::<_, (Uuid, f64, String, Option<String>)>(
                r#"
                SELECT id, valor, status, nosso_numero
                FROM faturas
                WHERE tenant_id = $1
                  AND (
                    (gateway_invoice_id IS NOT NULL AND gateway_invoice_id = $2)
                    OR (nosso_numero IS NOT NULL AND nosso_numero = $3)
                  )
                LIMIT 1
                "#,
            )
            .bind(tenant_id)
            .bind(id_boleto)
            .bind(&nosso_numero_fmt)
            .fetch_optional(&mut *db)
            .await?;

            let (fatura_id, fatura_valor, fatura_status, fatura_nosso_numero) = match fatura_opt {
                Some(f) => f,
                None => {
                    let mut tx = db.begin().await?;
                    sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                        .bind(tenant_id.to_string())
                        .execute(&mut *tx)
                        .await?;

                    let res = sqlx::query(
                        "UPDATE gateway_avisos SET status = 'descartado', ultimo_erro = 'Fatura não encontrada', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'",
                    )
                    .bind(aviso_id)
                    .bind(tenant_id)
                    .execute(&mut *tx)
                    .await?;

                    if res.rows_affected() == 0 {
                        tx.commit().await?;
                        continue;
                    }

                    sqlx::query(
                        r#"
                        INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                        VALUES ($1, 'itau_aviso_descartado', 'gateway_avisos', $2, $3)
                        "#,
                    )
                    .bind(tenant_id)
                    .bind(aviso_id.to_string())
                    .bind(serde_json::json!({
                        "event_id": event_id,
                        "motivo": "fatura_nao_encontrada",
                        "id_boleto": id_boleto,
                        "nosso_numero": nosso_numero_fmt
                    }))
                    .execute(&mut *tx)
                    .await?;

                    tx.commit().await?;
                    continue;
                }
            };

            if fatura_status == "pago" {
                let payload_hash = hex::encode(sha2::Sha256::digest(
                    serde_json::to_string(&payload)
                        .unwrap_or_default()
                        .as_bytes(),
                ));
                let mut tx = db.begin().await?;
                sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                    .bind(tenant_id.to_string())
                    .execute(&mut *tx)
                    .await?;

                sqlx::query(
                    "INSERT INTO webhook_events (tenant_id, gateway_name, event_id, payload_hash) VALUES ($1, 'itau', $2, $3) ON CONFLICT (tenant_id, gateway_name, event_id) DO NOTHING",
                )
                .bind(tenant_id)
                .bind(&event_id)
                .bind(&payload_hash)
                .execute(&mut *tx)
                .await?;

                sqlx::query(
                    "UPDATE gateway_avisos SET status = 'confirmado', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
                )
                .bind(aviso_id)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?;

                tx.commit().await?;
                continue;
            }

            let nosso_num_consulta = fatura_nosso_numero.unwrap_or(nosso_numero_fmt);
            let consulta_res = crate::services::itau_api::consultar_situacao_boleto(
                &state.config,
                &mut db,
                tenant_id,
                &id_beneficiario,
                &nosso_num_consulta,
            )
            .await;

            let situacao = match consulta_res {
                Ok(Some(s)) if s.esta_pago => s,
                Ok(Some(s)) => {
                    let novas_tentativas = tentativas + 1;
                    if novas_tentativas >= 12 {
                        let mut tx = db.begin().await?;
                        sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                            .bind(tenant_id.to_string())
                            .execute(&mut *tx)
                            .await?;

                        sqlx::query(
                            "UPDATE gateway_avisos SET status = 'descartado', tentativas = $1, ultimo_erro = 'Limite de 12 tentativas atingido sem confirmação de pagamento', updated_at = NOW() WHERE id = $2 AND tenant_id = $3",
                        )
                        .bind(novas_tentativas)
                        .bind(aviso_id)
                        .bind(tenant_id)
                        .execute(&mut *tx)
                        .await?;

                        sqlx::query(
                            r#"
                            INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                            VALUES ($1, 'itau_aviso_descartado', 'gateway_avisos', $2, $3)
                            "#,
                        )
                        .bind(tenant_id)
                        .bind(aviso_id.to_string())
                        .bind(serde_json::json!({
                            "event_id": event_id,
                            "motivo": "limite_tentativas_atingido",
                            "situacao": s.situacao
                        }))
                        .execute(&mut *tx)
                        .await?;

                        tx.commit().await?;
                    } else {
                        let proxima = chrono::Utc::now()
                            + chrono::Duration::minutes((novas_tentativas * 5) as i64);
                        let erro_msg = format!("Situação no Itaú ainda não paga: {}", s.situacao);
                        sqlx::query(
                            "UPDATE gateway_avisos SET tentativas = $1, proxima_tentativa_em = $2, ultimo_erro = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5",
                        )
                        .bind(novas_tentativas)
                        .bind(proxima)
                        .bind(erro_msg)
                        .bind(aviso_id)
                        .bind(tenant_id)
                        .execute(&mut *db)
                        .await?;
                    }
                    continue;
                }
                Ok(None) | Err(_) => {
                    let novas_tentativas = tentativas + 1;
                    if novas_tentativas >= 12 {
                        let mut tx = db.begin().await?;
                        sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                            .bind(tenant_id.to_string())
                            .execute(&mut *tx)
                            .await?;

                        let res = sqlx::query(
                            "UPDATE gateway_avisos SET status = 'descartado', tentativas = $1, ultimo_erro = 'Limite de 12 tentativas atingido na consulta do Itaú', updated_at = NOW() WHERE id = $2 AND tenant_id = $3 AND status = 'pendente'",
                        )
                        .bind(novas_tentativas)
                        .bind(aviso_id)
                        .bind(tenant_id)
                        .execute(&mut *tx)
                        .await?;

                        if res.rows_affected() == 0 {
                            tx.commit().await?;
                            continue;
                        }

                        sqlx::query(
                            r#"
                            INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                            VALUES ($1, 'itau_aviso_descartado', 'gateway_avisos', $2, $3)
                            "#,
                        )
                        .bind(tenant_id)
                        .bind(aviso_id.to_string())
                        .bind(serde_json::json!({
                            "event_id": event_id,
                            "motivo": "consulta_falhou_repetidamente"
                        }))
                        .execute(&mut *tx)
                        .await?;

                        tx.commit().await?;
                    } else {
                        let proxima = chrono::Utc::now()
                            + chrono::Duration::minutes((novas_tentativas * 5) as i64);
                        let erro_msg = "Falha ao consultar situação do boleto no Itaú".to_string();
                        sqlx::query(
                            "UPDATE gateway_avisos SET tentativas = $1, proxima_tentativa_em = $2, ultimo_erro = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5",
                        )
                        .bind(novas_tentativas)
                        .bind(proxima)
                        .bind(erro_msg)
                        .bind(aviso_id)
                        .bind(tenant_id)
                        .execute(&mut *db)
                        .await?;
                    }
                    continue;
                }
            };

            let status_recheck: Option<String> = sqlx::query_scalar(
                "SELECT status FROM gateway_avisos WHERE id = $1 AND tenant_id = $2",
            )
            .bind(aviso_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;

            if status_recheck.as_deref() != Some("pendente") {
                continue;
            }

            let valor_pago = situacao
                .valor_pago
                .or_else(|| {
                    payload.get("valorPagoTotalCobranca").and_then(|v| {
                        if let Some(s) = v.as_str() {
                            s.trim().parse::<f64>().ok()
                        } else {
                            v.as_f64()
                        }
                    })
                })
                .unwrap_or(fatura_valor);

            if valor_pago < fatura_valor - 0.01 {
                let mut tx = db.begin().await?;
                sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                    .bind(tenant_id.to_string())
                    .execute(&mut *tx)
                    .await?;

                let res = sqlx::query(
                    "UPDATE gateway_avisos SET status = 'descartado', ultimo_erro = 'Valor pago menor que o valor da fatura', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'",
                )
                .bind(aviso_id)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?;

                if res.rows_affected() == 0 {
                    tx.commit().await?;
                    continue;
                }

                sqlx::query(
                    r#"
                    INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                    VALUES ($1, 'webhook_valor_divergente', 'faturas', $2, $3)
                    "#,
                )
                .bind(tenant_id)
                .bind(fatura_id.to_string())
                .bind(serde_json::json!({
                    "fatura_id": fatura_id,
                    "fatura_valor": fatura_valor,
                    "valor_pago": valor_pago,
                    "event_id": event_id,
                    "gateway_name": "itau"
                }))
                .execute(&mut *tx)
                .await?;

                tx.commit().await?;
                continue;
            }

            let payload_hash = hex::encode(sha2::Sha256::digest(
                serde_json::to_string(&payload)
                    .unwrap_or_default()
                    .as_bytes(),
            ));
            let mut tx = db.begin().await?;
            sqlx::query("SELECT set_config('app.current_tenant', $1, true)")
                .bind(tenant_id.to_string())
                .execute(&mut *tx)
                .await?;

            let insert_res = sqlx::query(
                "INSERT INTO webhook_events (tenant_id, gateway_name, event_id, payload_hash) VALUES ($1, 'itau', $2, $3) ON CONFLICT (tenant_id, gateway_name, event_id) DO NOTHING",
            )
            .bind(tenant_id)
            .bind(&event_id)
            .bind(&payload_hash)
            .execute(&mut *tx)
            .await?;

            if insert_res.rows_affected() == 0 {
                sqlx::query(
                    "UPDATE gateway_avisos SET status = 'confirmado', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
                )
                .bind(aviso_id)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?;
                tx.commit().await?;
                continue;
            }

            sqlx::query(
                "UPDATE faturas SET status = 'pago', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status != 'pago'",
            )
            .bind(fatura_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                r#"
                INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json)
                VALUES ($1, 'itau_baixa_boleto', 'faturas', $2, $3)
                "#,
            )
            .bind(tenant_id)
            .bind(fatura_id.to_string())
            .bind(serde_json::json!({
                "fatura_id": fatura_id,
                "fatura_valor": fatura_valor,
                "valor_pago": valor_pago,
                "event_id": event_id,
                "gateway_name": "itau"
            }))
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                "UPDATE gateway_avisos SET status = 'confirmado', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
            )
            .bind(aviso_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
        }
    }

    Ok(())
}
