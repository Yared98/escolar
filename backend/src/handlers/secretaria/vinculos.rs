use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde_json::{json, Value};
use sqlx::Acquire;
use uuid::Uuid;

use super::turmas::validar_capacidade_turma;
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
        AlunoTurmaDetalhado, MatricularTurmaDto, TransferirAlunoTurmaDto, Turma, TurmaAluno,
    },
};

pub async fn listar_alunos_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Vec<AlunoTurmaDetalhado>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    // Repara inconsistência de ciclo de vida: vínculo ativo com aluno ainda em pré-matrícula.
    sqlx::query(
        r#"
        UPDATE alunos a
        SET status = 'ativo', updated_at = NOW()
        FROM turma_alunos ta
        WHERE a.id = ta.aluno_id
          AND a.tenant_id = $2
          AND ta.turma_id = $1
          AND ta.tenant_id = $2
          AND ta.status = 'ativo'
          AND a.status = 'pre_matricula'
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    // Mesma regra operacional do Diário/Pedagogia/Secretaria:
    // só vínculos ativos de alunos com status operacional (ativo).
    // Transferidos/inativos não entram na chamada nem na lotação.
    let rows = sqlx::query(
        r#"
        SELECT
            ta.id,
            ta.aluno_id,
            a.nome,
            a.cpf,
            a.data_nascimento,
            ta.numero_chamada,
            a.nome_responsavel,
            a.telefone_responsavel,
            ta.status,
            ta.data_matricula,
            COALESCE(
                (
                    SELECT u.id
                    FROM users u
                    WHERE u.id = a.responsavel_user_id AND u.tenant_id = a.tenant_id
                ),
                (
                    SELECT ra.responsavel_user_id
                    FROM responsaveis_alunos ra
                    JOIN users u ON u.id = ra.responsavel_user_id AND u.tenant_id = ra.tenant_id
                    WHERE ra.tenant_id = a.tenant_id AND ra.aluno_id = a.id
                    ORDER BY ra.created_at NULLS LAST
                    LIMIT 1
                )
            ) AS responsavel_user_id,
            COALESCE(
                (
                    SELECT u.name
                    FROM users u
                    WHERE u.id = COALESCE(
                        a.responsavel_user_id,
                        (
                            SELECT ra.responsavel_user_id
                            FROM responsaveis_alunos ra
                            WHERE ra.tenant_id = a.tenant_id AND ra.aluno_id = a.id
                            ORDER BY ra.created_at NULLS LAST
                            LIMIT 1
                        )
                    ) AND u.tenant_id = a.tenant_id
                ),
                NULLIF(TRIM(a.nome_responsavel), ''),
                ''
            ) AS responsavel_nome
        FROM turma_alunos ta
        JOIN alunos a ON ta.aluno_id = a.id AND a.tenant_id = ta.tenant_id
        WHERE ta.turma_id = $1
          AND ta.tenant_id = $2
          AND ta.status = 'ativo'
          AND a.status = 'ativo'
        ORDER BY COALESCE(ta.numero_chamada, 9999) ASC, a.nome ASC
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let alunos = rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            AlunoTurmaDetalhado {
                id: row.get("id"),
                aluno_id: row.get("aluno_id"),
                nome: row.get("nome"),
                cpf: row.get("cpf"),
                data_nascimento: row.get("data_nascimento"),
                numero_chamada: row.get("numero_chamada"),
                nome_responsavel: row.get("nome_responsavel"),
                telefone_responsavel: row.get("telefone_responsavel"),
                status: row.get("status"),
                data_matricula: row.get("data_matricula"),
                responsavel_user_id: row.try_get("responsavel_user_id").ok().flatten(),
                responsavel_nome: row.try_get("responsavel_nome").ok(),
            }
        })
        .collect();

    Ok(Json(alunos))
}

pub async fn matricular_aluno_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<MatricularTurmaDto>,
) -> Result<Json<TurmaAluno>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    // 1. Validar existência da turma no tenant
    let turma = sqlx::query_as::<_, Turma>("SELECT * FROM turmas WHERE id = $1 AND tenant_id = $2")
        .bind(dto.turma_id)
        .bind(tenant_id)
        .fetch_optional(&mut *db)
        .await?
        .ok_or(AppError::NotFound)?;

    // 2. Checar se o aluno já está matriculado e ativo para evitar falso bloqueio por capacidade
    let aluno_ja_matriculado = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM turma_alunos WHERE turma_id = $1 AND aluno_id = $2 AND tenant_id = $3 AND status = 'ativo')",
    )
    .bind(dto.turma_id)
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if !aluno_ja_matriculado {
        let count_alunos = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM turma_alunos WHERE turma_id = $1 AND tenant_id = $2 AND status = 'ativo'",
        )
        .bind(dto.turma_id)
        .bind(tenant_id)
        .fetch_one(&mut *db)
        .await?;

        if let Err(err_msg) = validar_capacidade_turma(count_alunos, turma.capacidade_maxima) {
            return Err(AppError::BadRequest(err_msg.to_string()));
        }
    }

    // Calcular número de chamada se não fornecido
    let num_chamada = if let Some(num) = dto.numero_chamada {
        num
    } else {
        let max_num = sqlx::query_scalar::<_, Option<i32>>(
            "SELECT MAX(numero_chamada) FROM turma_alunos WHERE turma_id = $1 AND tenant_id = $2",
        )
        .bind(dto.turma_id)
        .bind(tenant_id)
        .fetch_one(&mut *db)
        .await?
        .unwrap_or(0);
        max_num + 1
    };

    let turma_aluno = sqlx::query_as::<_, TurmaAluno>(
        r#"
        INSERT INTO turma_alunos (tenant_id, turma_id, aluno_id, numero_chamada, data_matricula, status)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, 'ativo')
        ON CONFLICT (turma_id, aluno_id) DO UPDATE SET 
            status = 'ativo',
            numero_chamada = COALESCE(EXCLUDED.numero_chamada, turma_alunos.numero_chamada)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(dto.aluno_id)
    .bind(num_chamada)
    .fetch_one(&mut *db)
    .await?;

    // Ciclo de vida: enturmação ativa promove pré-matrícula → aluno operacional.
    sqlx::query(
        r#"
        UPDATE alunos
        SET status = 'ativo', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status = 'pre_matricula'
        "#,
    )
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "MATRICULAR_ALUNO_TURMA",
        "turma_alunos",
        Some(turma_aluno.id.to_string()),
        Some(json!({ "turma_id": dto.turma_id, "aluno_id": dto.aluno_id, "numero_chamada": num_chamada })),
    )
    .await;

    Ok(Json(turma_aluno))
}

pub async fn desenturmar_aluno_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path((turma_id, aluno_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let res = sqlx::query(
        "DELETE FROM turma_alunos WHERE turma_id = $1 AND aluno_id = $2 AND tenant_id = $3",
    )
    .bind(turma_id)
    .bind(aluno_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DESENTURMAR_ALUNO",
        "turma_alunos",
        Some(aluno_id.to_string()),
        Some(json!({ "turma_id": turma_id })),
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Aluno removido da turma com sucesso." }),
    ))
}

pub async fn transferir_aluno_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<TransferirAlunoTurmaDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let mut tx = (&mut *db).begin().await?;

    let turma_dest =
        sqlx::query_as::<_, Turma>("SELECT * FROM turmas WHERE id = $1 AND tenant_id = $2")
            .bind(dto.turma_destino_id)
            .bind(tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    let count_alunos_dest = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM turma_alunos WHERE turma_id = $1 AND tenant_id = $2 AND status = 'ativo'",
    )
    .bind(dto.turma_destino_id)
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if let Err(err) = validar_capacidade_turma(count_alunos_dest, turma_dest.capacidade_maxima) {
        return Err(AppError::BadRequest(err.to_string()));
    }

    sqlx::query(
        "UPDATE turma_alunos SET status = 'transferido' WHERE turma_id = $1 AND aluno_id = $2 AND tenant_id = $3",
    )
    .bind(dto.turma_origem_id)
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;

    let max_num = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(numero_chamada) FROM turma_alunos WHERE turma_id = $1 AND tenant_id = $2",
    )
    .bind(dto.turma_destino_id)
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(0);
    let prox_num = max_num + 1;

    sqlx::query(
        r#"
        INSERT INTO turma_alunos (tenant_id, turma_id, aluno_id, numero_chamada, data_matricula, status)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, 'ativo')
        ON CONFLICT (turma_id, aluno_id) DO UPDATE SET status = 'ativo', numero_chamada = EXCLUDED.numero_chamada
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_destino_id)
    .bind(dto.aluno_id)
    .bind(prox_num)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE alunos
        SET status = 'ativo', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status IN ('pre_matricula', 'transferido')
        "#,
    )
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "TRANSFERIR_ALUNO_TURMA",
        "turma_alunos",
        Some(dto.aluno_id.to_string()),
        Some(json!({
            "turma_origem_id": dto.turma_origem_id,
            "turma_destino_id": dto.turma_destino_id,
            "novo_numero_chamada": prox_num
        })),
    )
    .await;

    Ok(Json(json!({
        "status": "sucesso",
        "mensagem": "Aluno transferido para a nova turma com sucesso.",
        "novo_numero_chamada": prox_num
    })))
}

pub async fn renumerar_chamada_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let mut tx = (&mut *db).begin().await?;

    let rows = sqlx::query(
        r#"
        SELECT ta.id 
        FROM turma_alunos ta
        JOIN alunos a ON ta.aluno_id = a.id
        WHERE ta.turma_id = $1 AND ta.tenant_id = $2 AND ta.status = 'ativo'
        ORDER BY a.nome ASC
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let total = rows.len();
    for (idx, row) in rows.into_iter().enumerate() {
        use sqlx::Row;
        let ta_id: Uuid = row.get("id");
        let num = (idx + 1) as i32;
        sqlx::query("UPDATE turma_alunos SET numero_chamada = $1 WHERE id = $2")
            .bind(num)
            .bind(ta_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "RENUMERAR_CHAMADA_TURMA",
        "turma_alunos",
        Some(turma_id.to_string()),
        Some(json!({ "total_renumerados": total })),
    )
    .await;

    Ok(Json(json!({
        "status": "sucesso",
        "mensagem": "Chamada renumerada em ordem alfabética com sucesso.",
        "total_alunos": total
    })))
}
