use super::*;

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
