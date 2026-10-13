use super::{ActiveTenant, AppError, AppState, AuthUser, Extension, State, TenantDb, Uuid};

pub async fn criar_evento_calendario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<
        crate::models::agenda_admin::CreateEventoCalendarioDto,
    >,
) -> Result<axum::Json<crate::models::agenda_admin::EventoCalendario>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let evento = sqlx::query_as::<_, crate::models::agenda_admin::EventoCalendario>(
        r#"
        INSERT INTO eventos_calendario (tenant_id, turma_id, titulo, descricao, data_inicio, data_fim, tipo, visibilidade, criado_por, exige_confirmacao)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(&dto.titulo)
    .bind(&dto.descricao)
    .bind(dto.data_inicio)
    .bind(dto.data_fim)
    .bind(&dto.tipo)
    .bind(&dto.visibilidade)
    .bind(auth_user.id)
    .bind(dto.exige_confirmacao.unwrap_or(false))
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_EVENTO_CALENDARIO",
        "eventos_calendario",
        Some(evento.id.to_string()),
        Some(serde_json::json!({"titulo": dto.titulo})),
    )
    .await;

    Ok(axum::Json(evento))
}

pub async fn listar_eventos_calendario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<axum::Json<Vec<crate::models::agenda_admin::EventoCalendario>>, AppError> {
    let tenant_id = active_tenant.0;

    // Filter visibility based on role
    let visibilidade_filtro = if auth_user.role == "responsavel" || auth_user.role == "aluno" {
        "('todos', 'responsaveis')"
    } else {
        "('todos', 'funcionarios', 'responsaveis')"
    };

    // Note: A robust implementation would use a proper query builder or bind parameters for the IN clause,
    // but for simplicity we're injecting it safely since it's hardcoded based on role.
    let query_str = format!(
        "SELECT * FROM eventos_calendario WHERE tenant_id = $1 AND visibilidade IN {} ORDER BY data_inicio ASC",
        visibilidade_filtro
    );

    let eventos = sqlx::query_as::<_, crate::models::agenda_admin::EventoCalendario>(&query_str)
        .bind(tenant_id)
        .fetch_all(&mut *db)
        .await?;

    Ok(axum::Json(eventos))
}

pub async fn atualizar_evento_calendario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
    axum::extract::Json(dto): axum::extract::Json<
        crate::models::agenda_admin::UpdateEventoCalendarioDto,
    >,
) -> Result<axum::Json<crate::models::agenda_admin::EventoCalendario>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let evento = sqlx::query_as::<_, crate::models::agenda_admin::EventoCalendario>(
        r#"
        UPDATE eventos_calendario
        SET titulo = $1, descricao = $2, data_inicio = $3, data_fim = $4, tipo = $5, visibilidade = $6, exige_confirmacao = $7
        WHERE id = $8 AND tenant_id = $9
        RETURNING *
        "#,
    )
    .bind(&dto.titulo)
    .bind(&dto.descricao)
    .bind(dto.data_inicio)
    .bind(dto.data_fim)
    .bind(&dto.tipo)
    .bind(&dto.visibilidade)
    .bind(dto.exige_confirmacao.unwrap_or(false))
    .bind(evento_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_EVENTO_CALENDARIO",
        "eventos_calendario",
        Some(evento.id.to_string()),
        Some(serde_json::json!({"titulo": dto.titulo})),
    )
    .await;

    Ok(axum::Json(evento))
}

pub async fn deletar_evento_calendario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    sqlx::query("DELETE FROM eventos_calendario WHERE id = $1 AND tenant_id = $2")
        .bind(evento_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DELETAR_EVENTO_CALENDARIO",
        "eventos_calendario",
        Some(evento_id.to_string()),
        None,
    )
    .await;

    Ok(axum::Json(serde_json::json!({"status": "sucesso"})))
}

pub async fn responder_rsvp(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::agenda_admin::UpsertRsvpDto>,
) -> Result<axum::Json<crate::models::agenda_admin::EventoRsvp>, AppError> {
    let tenant_id = active_tenant.0;

    // Check if event requires RSVP
    let evento = sqlx::query_as::<_, crate::models::agenda_admin::EventoCalendario>(
        "SELECT * FROM eventos_calendario WHERE id = $1 AND tenant_id = $2",
    )
    .bind(evento_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    if !evento.exige_confirmacao {
        return Err(AppError::BadRequest(
            "Este evento não exige confirmação de presença.".to_string(),
        ));
    }

    let rsvp = sqlx::query_as::<_, crate::models::agenda_admin::EventoRsvp>(
        r#"
        INSERT INTO eventos_rsvps (tenant_id, evento_id, usuario_id, status, acompanhantes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (evento_id, usuario_id) 
        DO UPDATE SET status = EXCLUDED.status, acompanhantes = EXCLUDED.acompanhantes, updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(evento_id)
    .bind(auth_user.id)
    .bind(&dto.status)
    .bind(dto.acompanhantes)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "RESPONDER_RSVP",
        "eventos_rsvps",
        Some(rsvp.id.to_string()),
        Some(serde_json::json!({"evento_id": evento_id, "status": dto.status})),
    )
    .await;

    Ok(axum::Json(rsvp))
}

pub async fn listar_rsvps_evento(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::agenda_admin::EventoRsvp>>, AppError> {
    // Only management can view the RSVPs!
    crate::middleware::rbac::check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor"],
    )?;
    let tenant_id = active_tenant.0;

    let rsvps = sqlx::query_as::<_, crate::models::agenda_admin::EventoRsvp>(
        "SELECT * FROM eventos_rsvps WHERE evento_id = $1 AND tenant_id = $2 ORDER BY updated_at DESC"
    )
    .bind(evento_id)
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(axum::Json(rsvps))
}
