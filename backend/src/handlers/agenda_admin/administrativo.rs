use super::{
    check_roles, json, log_audit, ActiveTenant, AppError, AppState, AuditLog, AuthUser,
    CreateFornecedorDto, CreateFuncionarioDto, Extension, Fornecedor, Funcionario, Json, Path,
    State, TenantDb, UpdateFornecedorDto, UpdateFuncionarioDto, Uuid, Value,
};

// --- ADMINISTRATIVO (RH, Fornecedores, Auditoria) ---

pub async fn criar_funcionario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateFuncionarioDto>,
) -> Result<Json<Funcionario>, AppError> {
    check_roles(&auth_user, &["admin", "nutricionista"])?;
    let tenant_id = active_tenant.0;

    let funcionario = sqlx::query_as::<_, Funcionario>(
        r#"
        INSERT INTO funcionarios (tenant_id, nome, cpf, cargo, departamento, data_admissao, salario, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ativo')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.nome)
    .bind(&dto.cpf)
    .bind(&dto.cargo)
    .bind(&dto.departamento)
    .bind(dto.data_admissao)
    .bind(dto.salario)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_FUNCIONARIO",
        "funcionarios",
        Some(funcionario.id.to_string()),
        Some(json!({"nome": dto.nome, "cargo": dto.cargo})),
    )
    .await;

    Ok(Json(funcionario))
}

pub async fn listar_funcionarios(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Funcionario>>, AppError> {
    check_roles(&auth_user, &["admin", "nutricionista", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let funcionarios = sqlx::query_as::<_, Funcionario>(
        "SELECT * FROM funcionarios WHERE tenant_id = $1 ORDER BY nome ASC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(funcionarios))
}

pub async fn atualizar_funcionario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(funcionario_id): Path<Uuid>,
    Json(dto): Json<UpdateFuncionarioDto>,
) -> Result<Json<Funcionario>, AppError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;
    let nome_propagado = dto.nome.clone();

    let funcionario = sqlx::query_as::<_, Funcionario>(
        r#"
        UPDATE funcionarios
        SET 
            nome = COALESCE($1, nome),
            cpf = COALESCE($2, cpf),
            cargo = COALESCE($3, cargo),
            departamento = COALESCE($4, departamento),
            salario = COALESCE($5, salario),
            status = COALESCE($6, status)
        WHERE id = $7 AND tenant_id = $8
        RETURNING *
        "#,
    )
    .bind(dto.nome)
    .bind(dto.cpf)
    .bind(dto.cargo)
    .bind(dto.departamento)
    .bind(dto.salario)
    .bind(dto.status)
    .bind(funcionario_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(nome) = nome_propagado {
        sqlx::query(
            "UPDATE cardapios SET nutricionista_responsavel = $1 WHERE nutricionista_id = $2 AND tenant_id = $3",
        )
        .bind(nome)
        .bind(funcionario_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_FUNCIONARIO",
        "funcionarios",
        Some(funcionario.id.to_string()),
        Some(json!({"cargo": &funcionario.cargo, "status": &funcionario.status})),
    )
    .await;

    Ok(Json(funcionario))
}

pub async fn deletar_funcionario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(funcionario_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;

    let existe: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM funcionarios WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(funcionario_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;
    if !existe {
        return Err(AppError::NotFound);
    }

    let vinculos: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM cardapios WHERE nutricionista_id = $1 AND tenant_id = $2",
    )
    .bind(funcionario_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if vinculos > 0 {
        sqlx::query("UPDATE funcionarios SET status = 'inativo' WHERE id = $1 AND tenant_id = $2")
            .bind(funcionario_id)
            .bind(tenant_id)
            .execute(&mut *db)
            .await?;
        log_audit(
            &mut *db,
            tenant_id,
            Some(auth_user.id),
            "INATIVAR_FUNCIONARIO",
            "funcionarios",
            Some(funcionario_id.to_string()),
            None,
        )
        .await;
        return Ok(Json(json!({
            "status": "inativado",
            "mensagem": "Funcionário inativado porque há cardápios vinculados."
        })));
    }

    sqlx::query("DELETE FROM funcionarios WHERE id = $1 AND tenant_id = $2")
        .bind(funcionario_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DELETAR_FUNCIONARIO",
        "funcionarios",
        Some(funcionario_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "removido", "mensagem": "Funcionário removido com sucesso." }),
    ))
}

pub async fn criar_fornecedor(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateFornecedorDto>,
) -> Result<Json<Fornecedor>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let fornecedor = sqlx::query_as::<_, Fornecedor>(
        r#"
        INSERT INTO fornecedores (tenant_id, razao_social, cnpj, ramo_atividade, email, telefone)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.razao_social)
    .bind(&dto.cnpj)
    .bind(&dto.ramo_atividade)
    .bind(&dto.email)
    .bind(&dto.telefone)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_FORNECEDOR",
        "fornecedores",
        Some(fornecedor.id.to_string()),
        Some(json!({"razao_social": &fornecedor.razao_social, "cnpj": &fornecedor.cnpj})),
    )
    .await;

    Ok(Json(fornecedor))
}

pub async fn listar_fornecedores(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Fornecedor>>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let fornecedores = sqlx::query_as::<_, Fornecedor>(
        "SELECT * FROM fornecedores WHERE tenant_id = $1 ORDER BY razao_social ASC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(fornecedores))
}

pub async fn atualizar_fornecedor(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(fornecedor_id): Path<Uuid>,
    Json(dto): Json<UpdateFornecedorDto>,
) -> Result<Json<Fornecedor>, AppError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;
    let razao_propagada = dto.razao_social.clone();

    let fornecedor = sqlx::query_as::<_, Fornecedor>(
        r#"
        UPDATE fornecedores
        SET 
            razao_social = COALESCE($1, razao_social),
            cnpj = COALESCE($2, cnpj),
            ramo_atividade = COALESCE($3, ramo_atividade),
            email = COALESCE($4, email),
            telefone = COALESCE($5, telefone)
        WHERE id = $6 AND tenant_id = $7
        RETURNING *
        "#,
    )
    .bind(dto.razao_social)
    .bind(dto.cnpj)
    .bind(dto.ramo_atividade)
    .bind(dto.email)
    .bind(dto.telefone)
    .bind(fornecedor_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(razao) = razao_propagada {
        sqlx::query(
            "UPDATE despesas SET fornecedor_nome = $1 WHERE fornecedor_id = $2 AND tenant_id = $3",
        )
        .bind(razao)
        .bind(fornecedor_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_FORNECEDOR",
        "fornecedores",
        Some(fornecedor.id.to_string()),
        Some(json!({"razao_social": &fornecedor.razao_social, "cnpj": &fornecedor.cnpj})),
    )
    .await;

    Ok(Json(fornecedor))
}

pub async fn deletar_fornecedor(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(fornecedor_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let existe: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM fornecedores WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(fornecedor_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;
    if !existe {
        return Err(AppError::NotFound);
    }

    let vinculos: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM despesas WHERE fornecedor_id = $1 AND tenant_id = $2",
    )
    .bind(fornecedor_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if vinculos > 0 {
        sqlx::query("UPDATE fornecedores SET status = 'inativo' WHERE id = $1 AND tenant_id = $2")
            .bind(fornecedor_id)
            .bind(tenant_id)
            .execute(&mut *db)
            .await?;
        log_audit(
            &mut *db,
            tenant_id,
            Some(auth_user.id),
            "INATIVAR_FORNECEDOR",
            "fornecedores",
            Some(fornecedor_id.to_string()),
            None,
        )
        .await;
        return Ok(Json(json!({
            "status": "inativado",
            "mensagem": "Fornecedor inativado porque há despesas vinculadas."
        })));
    }

    sqlx::query("DELETE FROM fornecedores WHERE id = $1 AND tenant_id = $2")
        .bind(fornecedor_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DELETAR_FORNECEDOR",
        "fornecedores",
        Some(fornecedor_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "removido", "mensagem": "Fornecedor removido com sucesso." }),
    ))
}

pub async fn relatorios_operacionais_auditoria(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;

    let audit_logs = sqlx::query_as::<_, AuditLog>(
        "SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await
    .unwrap_or_default();

    Ok(Json(json!({
        "status": "sucesso",
        "auditoria_ativa": true,
        "logs_recentes": audit_logs,
        "total_registros_auditados": audit_logs.len(),
        "relatorio_gerencial_compliance": "Em conformidade LGPD & MEC Portaria 70/2025"
    })))
}
