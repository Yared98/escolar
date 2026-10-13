use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde_json::{json, Value};
use sqlx::Acquire;
use uuid::Uuid;

use super::matricula::normalizar_status_aluno;
use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::secretaria::{
        Aluno, AlunoListItem, AlunoStatusContagem, AlunosPage, ListAlunosQuery, UpdateAlunoDto,
        VincularResponsavelDto,
    },
};

pub async fn listar_alunos(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<ListAlunosQuery>,
) -> Result<Json<AlunosPage>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.limit.unwrap_or(25).clamp(1, 200);
    let offset = (page - 1) * page_size;

    let q_trim = query
        .q
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let q_like = q_trim.as_ref().map(|s| format!("%{}%", s));

    let status_filter = match query.status.as_deref().map(str::trim) {
        None | Some("") | Some("todos") => None,
        Some(s) => Some(normalizar_status_aluno(s)?),
    };

    let sem_turma = query.sem_turma.unwrap_or(false);
    let is_professor = auth_user.role == "professor";

    let contagem_status = if is_professor {
        sqlx::query_as::<_, AlunoStatusContagem>(
            r#"
            SELECT a.status, COUNT(DISTINCT a.id)::BIGINT AS total
            FROM alunos a
            JOIN turma_alunos ta ON ta.aluno_id = a.id AND ta.status = 'ativo'
            JOIN turma_professores tp ON tp.turma_id = ta.turma_id
            WHERE a.tenant_id = $1 AND tp.professor_id = $2
            GROUP BY a.status
            ORDER BY a.status
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        sqlx::query_as::<_, AlunoStatusContagem>(
            r#"
            SELECT status, COUNT(*)::BIGINT AS total
            FROM alunos
            WHERE tenant_id = $1
            GROUP BY status
            ORDER BY status
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&mut *db)
        .await?
    };

    let total = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT a.id)::BIGINT
        FROM alunos a
        WHERE a.tenant_id = $1
          AND ($2::TEXT IS NULL OR a.status = $2)
          AND (
            $3::TEXT IS NULL
            OR a.nome ILIKE $3
            OR a.cpf ILIKE $3
            OR a.nome_responsavel ILIKE $3
            OR COALESCE(a.nome_responsavel_financeiro, '') ILIKE $3
            OR COALESCE(a.cidade, '') ILIKE $3
          )
          AND (
            $4::UUID IS NULL
            OR EXISTS (
              SELECT 1 FROM turma_alunos ta
              WHERE ta.aluno_id = a.id AND ta.turma_id = $4 AND ta.status = 'ativo'
            )
          )
          AND (
            NOT $5::BOOLEAN
            OR NOT EXISTS (
              SELECT 1 FROM turma_alunos ta
              WHERE ta.aluno_id = a.id AND ta.status = 'ativo'
            )
          )
          AND (
            $6::INT IS NULL
            OR EXISTS (
              SELECT 1
              FROM turma_alunos ta
              JOIN turmas t ON t.id = ta.turma_id
              WHERE ta.aluno_id = a.id AND ta.status = 'ativo' AND t.ano_letivo = $6
            )
          )
          AND (
            NOT $7::BOOLEAN
            OR EXISTS (
              SELECT 1
              FROM turma_alunos ta
              JOIN turma_professores tp ON tp.turma_id = ta.turma_id
              WHERE ta.aluno_id = a.id AND tp.professor_id = $8
            )
          )
        "#,
    )
    .bind(tenant_id)
    .bind(status_filter.as_deref())
    .bind(q_like.as_deref())
    .bind(query.turma_id)
    .bind(sem_turma)
    .bind(query.ano_letivo)
    .bind(is_professor)
    .bind(auth_user.id)
    .fetch_one(&mut *db)
    .await?;

    let alunos = sqlx::query_as::<_, Aluno>(
        r#"
        SELECT DISTINCT a.*
        FROM alunos a
        WHERE a.tenant_id = $1
          AND ($2::TEXT IS NULL OR a.status = $2)
          AND (
            $3::TEXT IS NULL
            OR a.nome ILIKE $3
            OR a.cpf ILIKE $3
            OR a.nome_responsavel ILIKE $3
            OR COALESCE(a.nome_responsavel_financeiro, '') ILIKE $3
            OR COALESCE(a.cidade, '') ILIKE $3
          )
          AND (
            $4::UUID IS NULL
            OR EXISTS (
              SELECT 1 FROM turma_alunos ta
              WHERE ta.aluno_id = a.id AND ta.turma_id = $4 AND ta.status = 'ativo'
            )
          )
          AND (
            NOT $5::BOOLEAN
            OR NOT EXISTS (
              SELECT 1 FROM turma_alunos ta
              WHERE ta.aluno_id = a.id AND ta.status = 'ativo'
            )
          )
          AND (
            $6::INT IS NULL
            OR EXISTS (
              SELECT 1
              FROM turma_alunos ta
              JOIN turmas t ON t.id = ta.turma_id
              WHERE ta.aluno_id = a.id AND ta.status = 'ativo' AND t.ano_letivo = $6
            )
          )
          AND (
            NOT $7::BOOLEAN
            OR EXISTS (
              SELECT 1
              FROM turma_alunos ta
              JOIN turma_professores tp ON tp.turma_id = ta.turma_id
              WHERE ta.aluno_id = a.id AND tp.professor_id = $8
            )
          )
        ORDER BY a.nome ASC
        LIMIT $9 OFFSET $10
        "#,
    )
    .bind(tenant_id)
    .bind(status_filter.as_deref())
    .bind(q_like.as_deref())
    .bind(query.turma_id)
    .bind(sem_turma)
    .bind(query.ano_letivo)
    .bind(is_professor)
    .bind(auth_user.id)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&mut *db)
    .await?;

    #[derive(sqlx::FromRow)]
    struct TurmaAtualRow {
        aluno_id: Uuid,
        turma_id: Uuid,
        turma_nome: String,
        turma_codigo: Option<String>,
        numero_chamada: Option<i32>,
    }

    let aluno_ids: Vec<Uuid> = alunos.iter().map(|a| a.id).collect();
    let mut turma_map = std::collections::HashMap::<Uuid, TurmaAtualRow>::new();
    if !aluno_ids.is_empty() {
        let rows = sqlx::query_as::<_, TurmaAtualRow>(
            r#"
            SELECT DISTINCT ON (ta.aluno_id)
                ta.aluno_id,
                t.id AS turma_id,
                t.nome AS turma_nome,
                t.codigo AS turma_codigo,
                ta.numero_chamada
            FROM turma_alunos ta
            JOIN turmas t ON t.id = ta.turma_id
            WHERE ta.aluno_id = ANY($1) AND ta.status = 'ativo'
            ORDER BY ta.aluno_id, ta.data_matricula DESC NULLS LAST
            "#,
        )
        .bind(&aluno_ids)
        .fetch_all(&mut *db)
        .await?;
        for row in rows {
            turma_map.insert(row.aluno_id, row);
        }
    }

    let items = alunos
        .into_iter()
        .map(|aluno| {
            let turma = turma_map.remove(&aluno.id);
            AlunoListItem {
                turma_atual_id: turma.as_ref().map(|t| t.turma_id),
                turma_atual_nome: turma.as_ref().map(|t| t.turma_nome.clone()),
                turma_atual_codigo: turma.as_ref().and_then(|t| t.turma_codigo.clone()),
                numero_chamada: turma.as_ref().and_then(|t| t.numero_chamada),
                aluno,
            }
        })
        .collect();

    Ok(Json(AlunosPage {
        items,
        total,
        page,
        page_size,
        contagem_status,
    }))
}

pub async fn atualizar_aluno(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
    Json(dto): Json<UpdateAlunoDto>,
) -> Result<Json<Aluno>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let status_normalizado = match dto.status.as_deref() {
        Some(s) => Some(normalizar_status_aluno(s)?),
        None => None,
    };

    let mut tx = (&mut *db).begin().await?;

    let aluno = sqlx::query_as::<_, Aluno>(
        r#"
        UPDATE alunos
        SET 
            nome = COALESCE($1, nome),
            cpf = COALESCE($2, cpf),
            data_nascimento = COALESCE($3, data_nascimento),
            nome_responsavel = COALESCE($4, nome_responsavel),
            cpf_responsavel_legal = COALESCE($5, cpf_responsavel_legal),
            email_responsavel = COALESCE($6, email_responsavel),
            telefone_responsavel = COALESCE($7, telefone_responsavel),
            parentesco_responsavel_legal = COALESCE($8, parentesco_responsavel_legal),
            responsavel_financeiro_igual_legal = COALESCE($9, responsavel_financeiro_igual_legal),
            nome_responsavel_financeiro = COALESCE($10, nome_responsavel_financeiro),
            cpf_responsavel_financeiro = COALESCE($11, cpf_responsavel_financeiro),
            email_responsavel_financeiro = COALESCE($12, email_responsavel_financeiro),
            telefone_responsavel_financeiro = COALESCE($13, telefone_responsavel_financeiro),
            parentesco_responsavel_financeiro = COALESCE($14, parentesco_responsavel_financeiro),
            cep = COALESCE($15, cep),
            logradouro = COALESCE($16, logradouro),
            numero = COALESCE($17, numero),
            complemento = COALESCE($18, complemento),
            bairro = COALESCE($19, bairro),
            cidade = COALESCE($20, cidade),
            estado = COALESCE($21, estado),
            telefone_secundario = COALESCE($22, telefone_secundario),
            contato_emergencia_nome = COALESCE($23, contato_emergencia_nome),
            contato_emergencia_telefone = COALESCE($24, contato_emergencia_telefone),
            contato_emergencia_parentesco = COALESCE($25, contato_emergencia_parentesco),
            status = COALESCE($26, status),
            responsavel_user_id = COALESCE($27, responsavel_user_id),
            updated_at = NOW()
        WHERE id = $28 AND tenant_id = $29
        RETURNING *
        "#,
    )
    .bind(dto.nome)
    .bind(dto.cpf)
    .bind(dto.data_nascimento)
    .bind(dto.nome_responsavel)
    .bind(dto.cpf_responsavel_legal)
    .bind(dto.email_responsavel)
    .bind(dto.telefone_responsavel)
    .bind(dto.parentesco_responsavel_legal)
    .bind(dto.responsavel_financeiro_igual_legal)
    .bind(dto.nome_responsavel_financeiro)
    .bind(dto.cpf_responsavel_financeiro)
    .bind(dto.email_responsavel_financeiro)
    .bind(dto.telefone_responsavel_financeiro)
    .bind(dto.parentesco_responsavel_financeiro)
    .bind(dto.cep)
    .bind(dto.logradouro)
    .bind(dto.numero)
    .bind(dto.complemento)
    .bind(dto.bairro)
    .bind(dto.cidade)
    .bind(dto.estado)
    .bind(dto.telefone_secundario)
    .bind(dto.contato_emergencia_nome)
    .bind(dto.contato_emergencia_telefone)
    .bind(dto.contato_emergencia_parentesco)
    .bind(status_normalizado.as_deref())
    .bind(dto.responsavel_user_id)
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(resp_id) = dto.responsavel_user_id {
        sqlx::query(
            r#"
            INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id, parentesco)
            VALUES ($1, $2, $3, 'Pai/Mãe/Responsável Legal')
            ON CONFLICT (tenant_id, responsavel_user_id, aluno_id) DO NOTHING
            "#,
        )
        .bind(tenant_id)
        .bind(resp_id)
        .bind(aluno.id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_ALUNO",
        "aluno",
        Some(aluno_id.to_string()),
        None,
    )
    .await;

    Ok(Json(aluno))
}

pub async fn deletar_aluno(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let result = sqlx::query(
        "UPDATE alunos SET status = 'inativo', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "INATIVAR_ALUNO",
        "aluno",
        Some(aluno_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Aluno inativado com sucesso mantendo integridade histórica." }),
    ))
}

pub async fn listar_meus_alunos(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Aluno>>, AppError> {
    let tenant_id = active_tenant.0;

    let alunos = sqlx::query_as::<_, Aluno>(
        r#"
        SELECT DISTINCT a.* FROM alunos a
        LEFT JOIN responsaveis_alunos ra ON a.id = ra.aluno_id
        WHERE a.tenant_id = $1 AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)
        ORDER BY a.nome ASC
        "#,
    )
    .bind(tenant_id)
    .bind(auth_user.id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(alunos))
}

pub async fn vincular_responsavel_aluno(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<VincularResponsavelDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    sqlx::query(
        r#"
        INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id, parentesco)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tenant_id, responsavel_user_id, aluno_id) DO NOTHING
        "#,
    )
    .bind(tenant_id)
    .bind(dto.responsavel_user_id)
    .bind(dto.aluno_id)
    .bind(
        dto.parentesco
            .unwrap_or_else(|| "Pai/Mãe/Responsável Legal".to_string()),
    )
    .execute(&mut *db)
    .await?;

    sqlx::query(
        "UPDATE alunos SET responsavel_user_id = $1 WHERE id = $2 AND tenant_id = $3 AND responsavel_user_id IS NULL",
    )
    .bind(dto.responsavel_user_id)
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "VINCULAR_RESPONSAVEL",
        "responsaveis_alunos",
        Some(dto.aluno_id.to_string()),
        Some(json!({ "responsavel_user_id": dto.responsavel_user_id })),
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Vínculo responsável-aluno realizado com sucesso." }),
    ))
}
