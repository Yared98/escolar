import os

with open('src/handlers/agenda_admin.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Update criar_evento_calendario
content = content.replace(
    "INSERT INTO eventos_calendario (tenant_id, turma_id, titulo, descricao, data_inicio, data_fim, tipo, visibilidade, criado_por)\n        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    "INSERT INTO eventos_calendario (tenant_id, turma_id, titulo, descricao, data_inicio, data_fim, tipo, visibilidade, criado_por, exige_confirmacao)\n        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
)
content = content.replace(
    ".bind(auth_user.id)\n    .fetch_one(&state.pool)",
    ".bind(auth_user.id)\n    .bind(dto.exige_confirmacao.unwrap_or(false))\n    .fetch_one(&state.pool)"
)

# Update atualizar_evento_calendario
content = content.replace(
    "SET titulo = $1, descricao = $2, data_inicio = $3, data_fim = $4, tipo = $5, visibilidade = $6\n        WHERE id = $7 AND tenant_id = $8",
    "SET titulo = $1, descricao = $2, data_inicio = $3, data_fim = $4, tipo = $5, visibilidade = $6, exige_confirmacao = $7\n        WHERE id = $8 AND tenant_id = $9"
)
content = content.replace(
    ".bind(&dto.visibilidade)\n    .bind(evento_id)\n    .bind(tenant_id)\n    .fetch_one(&state.pool)",
    ".bind(&dto.visibilidade)\n    .bind(dto.exige_confirmacao.unwrap_or(false))\n    .bind(evento_id)\n    .bind(tenant_id)\n    .fetch_one(&state.pool)"
)

# Append RSVP Handlers
rsvp_handlers = """
pub async fn responder_rsvp(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::agenda_admin::UpsertRsvpDto>,
) -> Result<axum::Json<crate::models::agenda_admin::EventoRsvp>, AppError> {
    let tenant_id = active_tenant.0;

    // Check if event requires RSVP
    let evento = sqlx::query_as::<_, crate::models::agenda_admin::EventoCalendario>(
        "SELECT * FROM eventos_calendario WHERE id = $1 AND tenant_id = $2"
    )
    .bind(evento_id)
    .bind(tenant_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found("Evento não encontrado"))?;

    if !evento.exige_confirmacao {
        return Err(AppError::bad_request("Este evento não exige confirmação de presença."));
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
    .fetch_one(&state.pool)
    .await?;

    crate::middleware::rbac::log_audit(&state.pool, tenant_id, Some(auth_user.id), "RESPONDER_RSVP", "eventos_rsvps", Some(rsvp.id.to_string()), Some(serde_json::json!({"evento_id": evento_id, "status": dto.status}))).await;

    Ok(axum::Json(rsvp))
}

pub async fn listar_rsvps_evento(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::agenda_admin::EventoRsvp>>, AppError> {
    // Only management can view the RSVPs!
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let rsvps = sqlx::query_as::<_, crate::models::agenda_admin::EventoRsvp>(
        "SELECT * FROM eventos_rsvps WHERE evento_id = $1 AND tenant_id = $2 ORDER BY updated_at DESC"
    )
    .bind(evento_id)
    .bind(tenant_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(axum::Json(rsvps))
}
"""

with open('src/handlers/agenda_admin.rs', 'w', encoding='utf-8') as f:
    f.write(content + rsvp_handlers)
