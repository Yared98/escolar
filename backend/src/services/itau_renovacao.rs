use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::config::{AppState, ItauMode};
use crate::error::AppError;
use crate::services::itau_sts::parse_certificado_validade;
use crate::services::secrets::{self, TipoSegredo};

/// Inicia a tarefa diária de renovação automática do certificado mTLS do Itaú.
/// Roda a cada 24 horas, com a primeira execução 1 minuto após subir.
/// Só inicia se `itau_mode == Production` e `itau_renovacao_automatica == true`.
pub fn iniciar_renovador(state: AppState) {
    if state.config.itau_mode != ItauMode::Production || !state.config.itau_renovacao_automatica() {
        return;
    }
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        let mut intervalo = tokio::time::interval(std::time::Duration::from_secs(86400));
        loop {
            if let Err(e) = executar_ciclo_renovacao(&state).await {
                tracing::warn!(error = %e, "erro no ciclo de renovação automática Itaú");
            }
            intervalo.tick().await;
        }
    });
}

/// Executa um ciclo completo de renovação automática para todos os tenants.
pub async fn executar_ciclo_renovacao(state: &AppState) -> Result<(), AppError> {
    if state.config.itau_mode != ItauMode::Production || !state.config.itau_renovacao_automatica() {
        return Ok(());
    }

    let tenants: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM tenants")
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    for tenant_id in tenants {
        if let Err(e) = processar_renovacao_tenant(state, tenant_id).await {
            tracing::warn!(tenant_id = %tenant_id, error = %e, "falha na rotina de renovação automática do tenant");
        }
    }

    Ok(())
}

/// Processa a verificação e renovação de um tenant individual.
pub async fn processar_renovacao_tenant(state: &AppState, tenant_id: Uuid) -> Result<(), AppError> {
    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    let config_row: Option<(bool, Option<DateTime<Utc>>)> = sqlx::query_as(
        "SELECT ativo, renovacao_alerta_enviado_em FROM tenant_itau_config WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let Some((ativo, alerta_enviado_em)) = config_row else {
        return Ok(());
    };

    if !ativo {
        return Ok(());
    }

    let chave_mestra = match secrets::exigir_chave(&state.config) {
        Ok(c) => c,
        Err(_) => return Ok(()),
    };

    let cert_bytes =
        secrets::ler(&mut db, chave_mestra, tenant_id, "itau", TipoSegredo::Cert).await?;
    let Some(cert_bytes) = cert_bytes else {
        return Ok(());
    };

    let cert_pem = match String::from_utf8(cert_bytes) {
        Ok(s) => s,
        Err(_) => return Ok(()),
    };

    let validade = match parse_certificado_validade(&cert_pem) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };

    // Janela de renovação automática: 1 dia < faltam <= 30 dias
    let agora = Utc::now();
    let falta = validade - agora;
    if falta <= chrono::Duration::days(1) || falta > chrono::Duration::days(30) {
        return Ok(());
    }

    match crate::handlers::itau_config::renovar_certificado(state, &mut db, tenant_id, "automatica")
        .await
    {
        Ok(nova_validade) => {
            sqlx::query(
                r#"
                UPDATE tenant_itau_config
                SET renovacao_ultimo_erro = NULL,
                    renovacao_ultima_tentativa_em = $2,
                    updated_at = NOW()
                WHERE tenant_id = $1
                "#,
            )
            .bind(tenant_id)
            .bind(agora)
            .execute(&mut *db)
            .await?;

            crate::services::audit::log_audit(
                &mut *db,
                tenant_id,
                None,
                "itau_renovacao_automatica",
                "tenant_itau_config",
                Some(tenant_id.to_string()),
                Some(serde_json::json!({
                    "resultado": "ok",
                    "nova_validade": nova_validade,
                })),
            )
            .await;
        }
        Err(e) => {
            let erro_sanitizado = sanitizar_erro_msg(&e);

            sqlx::query(
                r#"
                UPDATE tenant_itau_config
                SET renovacao_ultimo_erro = $2,
                    renovacao_ultima_tentativa_em = $3,
                    updated_at = NOW()
                WHERE tenant_id = $1
                "#,
            )
            .bind(tenant_id)
            .bind(&erro_sanitizado)
            .bind(agora)
            .execute(&mut *db)
            .await?;

            crate::services::audit::log_audit(
                &mut *db,
                tenant_id,
                None,
                "itau_renovacao_automatica",
                "tenant_itau_config",
                Some(tenant_id.to_string()),
                Some(serde_json::json!({
                    "resultado": "falha",
                })),
            )
            .await;

            let deve_alertar = alerta_enviado_em
                .map(|dt| agora - dt >= chrono::Duration::hours(24))
                .unwrap_or(true);

            if deve_alertar {
                let gestores: Vec<Uuid> = sqlx::query_scalar(
                    r#"
                    SELECT id FROM users
                    WHERE tenant_id = $1
                      AND LOWER(REPLACE(role, '_', '')) IN ('admin', 'gestor', 'superadmin', 'gestorescolar')
                    "#,
                )
                .bind(tenant_id)
                .fetch_all(&mut *db)
                .await
                .unwrap_or_default();

                let titulo = "Renovação do certificado do Itaú falhou";
                let mensagem = "A renovação automática do certificado mTLS do Itaú falhou. Renove pela tela de Integrações antes do vencimento para evitar interrupção nas cobranças.";

                if gestores.is_empty() {
                    let _ = sqlx::query(
                        r#"
                        INSERT INTO notificacoes_sistema (
                            tenant_id, modulo, titulo, mensagem, prioridade, canal_disparo
                        )
                        VALUES ($1, 'financeiro', $2, $3, 'alta', 'push_pwa')
                        "#,
                    )
                    .bind(tenant_id)
                    .bind(titulo)
                    .bind(mensagem)
                    .execute(&mut *db)
                    .await;
                } else {
                    for gestor_id in gestores {
                        let _ = sqlx::query(
                            r#"
                            INSERT INTO notificacoes_sistema (
                                tenant_id, destinatario_id, modulo, titulo, mensagem, prioridade, canal_disparo
                            )
                            VALUES ($1, $2, 'financeiro', $3, $4, 'alta', 'push_pwa')
                            "#,
                        )
                        .bind(tenant_id)
                        .bind(gestor_id)
                        .bind(titulo)
                        .bind(mensagem)
                        .execute(&mut *db)
                        .await;
                    }
                }

                let _ = sqlx::query(
                    "UPDATE tenant_itau_config SET renovacao_alerta_enviado_em = $2, updated_at = NOW() WHERE tenant_id = $1",
                )
                .bind(tenant_id)
                .bind(agora)
                .execute(&mut *db)
                .await;
            }
        }
    }

    Ok(())
}

fn sanitizar_erro_msg(err: &AppError) -> String {
    let raw = err.to_string();
    if raw.contains("PRIVATE KEY")
        || raw.contains("CERTIFICATE")
        || raw.contains("Bearer")
        || raw.contains("secret")
    {
        "Falha ao comunicar com o STS do Itaú durante a renovação".to_string()
    } else {
        match err {
            AppError::BadRequest(msg) => msg.clone(),
            AppError::ServiceUnavailable(msg) => msg.clone(),
            AppError::DatabaseError(_) => {
                "Erro de banco de dados ao renovar certificado".to_string()
            }
            _ => "Falha na renovação automática do certificado mTLS".to_string(),
        }
    }
}
