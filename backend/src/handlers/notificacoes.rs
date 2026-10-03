use sqlx::Acquire;
use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    config::AppState, db::TenantDb,
    error::AppError,
    middleware::{auth::AuthUser, rbac::{can_notify_others, check_roles, log_audit, role_key}, tenant::ActiveTenant},
    models::notificacoes::{
        CreateNotificacaoDto, NotificacaoDisparoLog, NotificacaoSistema, PushSubscriptionDto,
    },
};

pub async fn criar_notificacao(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateNotificacaoDto>,
) -> Result<Json<NotificacaoSistema>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "financeiro", "professor"])?;
    let tenant_id = active_tenant.0;
    let destinatario = dto.destinatario_id.unwrap_or(auth_user.id);
    if destinatario != auth_user.id && !can_notify_others(&auth_user.role) {
        return Err(AppError::Forbidden(
            "Acesso negado: este perfil só pode criar notificações para si.".into(),
        ));
    }
    let prioridade = dto.prioridade.unwrap_or_else(|| "normal".to_string());
    let canal = dto.canal_disparo.unwrap_or_else(|| "push_pwa".to_string());

    let mut tx = (&mut *db).begin().await?;

    let notificacao = sqlx::query_as::<_, NotificacaoSistema>(
        r#"
        INSERT INTO notificacoes_sistema (tenant_id, destinatario_id, aluno_id, modulo, titulo, mensagem, prioridade, canal_disparo, lida)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(destinatario)
    .bind(dto.aluno_id)
    .bind(&dto.modulo)
    .bind(&dto.titulo)
    .bind(&dto.mensagem)
    .bind(&prioridade)
    .bind(&canal)
    .fetch_one(&mut *tx)
    .await?;

    // Registro de intenção de disparo em modo simulado até confirmação do adapter/worker
    let destino = destinatario.to_string();
    sqlx::query(
        r#"
        INSERT INTO notificacoes_disparos_logs (tenant_id, notificacao_id, canal, destino, status_envio)
        VALUES ($1, $2, $3, $4, 'simulado')
        "#,
    )
    .bind(tenant_id)
    .bind(notificacao.id)
    .bind(&canal)
    .bind(&destino)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "CRIAR_NOTIFICACAO", "notificacoes_sistema", Some(notificacao.id.to_string()), Some(json!({"modulo": dto.modulo, "titulo": dto.titulo, "destinatario_id": dto.destinatario_id}))).await;

    Ok(Json(notificacao))
}

pub async fn listar_notificacoes(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<NotificacaoSistema>>, AppError> {
    let tenant_id = active_tenant.0;
    let sees_all = matches!(
        role_key(&auth_user.role).as_str(),
        "admin" | "gestor" | "superadmin" | "gestorescolar" | "secretaria"
    );

    let notificacoes = if sees_all {
        sqlx::query_as::<_, NotificacaoSistema>(
            "SELECT * FROM notificacoes_sistema WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 30",
        )
        .bind(tenant_id)
        .fetch_all(&mut *db)
        .await?
    } else {
        sqlx::query_as::<_, NotificacaoSistema>(
            "SELECT * FROM notificacoes_sistema WHERE tenant_id = $1 AND (destinatario_id = $2 OR destinatario_id IS NULL) ORDER BY created_at DESC LIMIT 30",
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    };

    Ok(Json(notificacoes))
}

pub async fn marcar_notificacao_lida(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let tenant_id = active_tenant.0;
    let sees_all = can_notify_others(&auth_user.role) || role_key(&auth_user.role) == "secretaria";

    let result = sqlx::query(
        r#"
        UPDATE notificacoes_sistema
        SET lida = true
        WHERE id = $1
          AND tenant_id = $2
          AND (destinatario_id = $3 OR destinatario_id IS NULL OR $4)
        "#,
    )
    .bind(id)
    .bind(tenant_id)
    .bind(auth_user.id)
    .bind(sees_all)
    .execute(&mut *db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "MARCAR_NOTIFICACAO_LIDA", "notificacoes_sistema", Some(id.to_string()), None).await;

    Ok(Json(json!({ "status": "sucesso", "mensagem": "Notificação marcada como lida" })))
}

pub async fn listar_logs_disparos(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<NotificacaoDisparoLog>>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let logs = sqlx::query_as::<_, NotificacaoDisparoLog>(
        "SELECT * FROM notificacoes_disparos_logs WHERE tenant_id = $1 ORDER BY disparado_em DESC LIMIT 50",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(logs))
}

/// Chave VAPID pública para inscrição Web Push no PWA.
pub async fn vapid_public_key(
    Extension(_auth_user): Extension<AuthUser>,
) -> Result<Json<Value>, AppError> {
    let key = std::env::var("VAPID_PUBLIC_KEY").map_err(|_| {
        AppError::ServiceUnavailable("VAPID public key not configured".into())
    })?;
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err(AppError::ServiceUnavailable("VAPID public key not configured".into()));
    }
    Ok(Json(json!({
        "publicKey": trimmed
    })))
}

pub async fn registrar_push_subscription(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<PushSubscriptionDto>,
) -> Result<Json<Value>, AppError> {
    let tenant_id = active_tenant.0;
    if dto.endpoint.trim().is_empty() || dto.keys.p256dh.trim().is_empty() || dto.keys.auth.trim().is_empty() {
        return Err(AppError::BadRequest("Subscription Web Push inválida.".into()));
    }

    sqlx::query(
        r#"
        INSERT INTO push_subscriptions (tenant_id, user_id, endpoint, p256dh, auth)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (endpoint) DO UPDATE
          SET user_id = EXCLUDED.user_id,
              tenant_id = EXCLUDED.tenant_id,
              p256dh = EXCLUDED.p256dh,
              auth = EXCLUDED.auth,
              updated_at = NOW()
        "#,
    )
    .bind(tenant_id)
    .bind(auth_user.id)
    .bind(dto.endpoint.trim())
    .bind(dto.keys.p256dh.trim())
    .bind(dto.keys.auth.trim())
    .execute(&mut *db)
    .await?;

    Ok(Json(json!({ "status": "ok", "subscribed": true })))
}
