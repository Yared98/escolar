use super::*;

pub async fn listar_pratos(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Prato>>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "nutricionista",
            "professor",
            "responsavel",
        ],
    )?;
    let pratos = sqlx::query_as::<_, Prato>(
        "SELECT * FROM pratos WHERE tenant_id = $1 AND ativo = TRUE ORDER BY titulo",
    )
    .bind(active_tenant.0)
    .fetch_all(&mut *db)
    .await?;
    Ok(Json(pratos))
}
pub async fn criar_prato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<UpsertPratoDto>,
) -> Result<Json<Prato>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    if dto.titulo.trim().is_empty() || dto.descricao_ingredientes.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Informe o nome e os ingredientes do prato.".into(),
        ));
    }
    let prato = sqlx::query_as::<_, Prato>(
        r#"
        INSERT INTO pratos (tenant_id, titulo, descricao_ingredientes, alergicos_atencao, tipo_refeicao)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(active_tenant.0)
    .bind(dto.titulo.trim())
    .bind(dto.descricao_ingredientes.trim())
    .bind(dto.alergicos_atencao.filter(|valor| !valor.trim().is_empty()))
    .bind(dto.tipo_refeicao.filter(|valor| !valor.trim().is_empty()))
    .fetch_one(&mut *db)
    .await?;
    log_audit(
        &mut *db,
        active_tenant.0,
        Some(auth_user.id),
        "CRIAR_PRATO",
        "pratos",
        Some(prato.id.to_string()),
        Some(json!({
            "titulo": prato.titulo,
            "tipo_refeicao": prato.tipo_refeicao,
        })),
    )
    .await;
    Ok(Json(prato))
}

pub async fn atualizar_prato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(prato_id): Path<Uuid>,
    Json(dto): Json<UpsertPratoDto>,
) -> Result<Json<Prato>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    if dto.titulo.trim().is_empty() || dto.descricao_ingredientes.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Informe o nome e os ingredientes do prato.".into(),
        ));
    }
    let tenant_id = active_tenant.0;

    let prato = sqlx::query_as::<_, Prato>(
        r#"
        UPDATE pratos
        SET titulo = $3,
            descricao_ingredientes = $4,
            alergicos_atencao = $5,
            tipo_refeicao = $6
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(prato_id)
    .bind(tenant_id)
    .bind(dto.titulo.trim())
    .bind(dto.descricao_ingredientes.trim())
    .bind(
        dto.alergicos_atencao
            .filter(|valor| !valor.trim().is_empty()),
    )
    .bind(dto.tipo_refeicao.filter(|valor| !valor.trim().is_empty()))
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_PRATO",
        "pratos",
        Some(prato_id.to_string()),
        Some(json!({
            "titulo": prato.titulo,
            "tipo_refeicao": prato.tipo_refeicao,
        })),
    )
    .await;

    Ok(Json(prato))
}

pub async fn excluir_prato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(prato_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    let tenant_id = active_tenant.0;

    let prato =
        sqlx::query("SELECT id, titulo, ativo FROM pratos WHERE id = $1 AND tenant_id = $2")
            .bind(prato_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    let titulo: String = prato.try_get("titulo").unwrap_or_default();

    let cardapios_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM cardapios WHERE prato_id = $1 AND tenant_id = $2",
    )
    .bind(prato_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    let recorrencias_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM cardapio_recorrencias WHERE prato_id = $1 AND tenant_id = $2",
    )
    .bind(prato_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    let em_uso = cardapios_count > 0 || recorrencias_count > 0;
    let soft_delete = em_uso;

    let mut tx = db.begin().await?;

    if soft_delete {
        sqlx::query("UPDATE pratos SET ativo = FALSE WHERE id = $1 AND tenant_id = $2")
            .bind(prato_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
    } else {
        sqlx::query("DELETE FROM pratos WHERE id = $1 AND tenant_id = $2")
            .bind(prato_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
    }

    log_audit(
        &mut *tx,
        tenant_id,
        Some(auth_user.id),
        "EXCLUIR_PRATO",
        "pratos",
        Some(prato_id.to_string()),
        Some(json!({
            "titulo": titulo,
            "soft_delete": soft_delete,
            "cardapios_vinculados": cardapios_count,
            "recorrencias_vinculadas": recorrencias_count,
        })),
    )
    .await;

    tx.commit().await?;

    Ok(Json(json!({
        "excluido": true,
        "id": prato_id,
        "soft_delete": soft_delete,
        "cardapios_vinculados": cardapios_count,
        "recorrencias_vinculadas": recorrencias_count,
        "mensagem": if soft_delete {
            "Prato desativado do catálogo pois possui vínculos a cardápios ou recorrências existentes."
        } else {
            "Prato excluído permanentemente do catálogo."
        }
    })))
}
