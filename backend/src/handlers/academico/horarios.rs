use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::academico::{CreateHorarioTurmaDto, HorarioTurma, HorarioTurmaDetalhado},
};

pub async fn listar_horarios_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Vec<HorarioTurmaDetalhado>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let rows = sqlx::query(
        r#"
        SELECT 
            h.id,
            h.turma_id,
            h.disciplina_id,
            d.nome AS disciplina_nome,
            h.professor_id,
            u.name AS professor_nome,
            h.sala_id,
            s.nome AS sala_nome,
            h.dia_semana,
            h.hora_inicio,
            h.hora_fim,
            h.created_at
        FROM horarios_turma h
        JOIN disciplinas d ON h.disciplina_id = d.id
        LEFT JOIN users u ON h.professor_id = u.id
        LEFT JOIN salas s ON h.sala_id = s.id
        WHERE h.turma_id = $1 AND h.tenant_id = $2
        ORDER BY h.dia_semana ASC, h.hora_inicio ASC
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let lista = rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            HorarioTurmaDetalhado {
                id: row.get("id"),
                turma_id: row.get("turma_id"),
                disciplina_id: row.get("disciplina_id"),
                disciplina_nome: row.get("disciplina_nome"),
                professor_id: row.get("professor_id"),
                professor_nome: row.get("professor_nome"),
                sala_id: row.get("sala_id"),
                sala_nome: row.get("sala_nome"),
                dia_semana: row.get("dia_semana"),
                hora_inicio: row.get("hora_inicio"),
                hora_fim: row.get("hora_fim"),
                created_at: row.get("created_at"),
            }
        })
        .collect();

    Ok(Json(lista))
}

pub async fn criar_horario_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
    Json(dto): Json<CreateHorarioTurmaDto>,
) -> Result<Json<HorarioTurmaDetalhado>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    // 1. Validar que início < fim
    if dto.hora_inicio >= dto.hora_fim {
        return Err(AppError::BadRequest(
            "O horário de início deve ser anterior ao horário de término.".to_string(),
        ));
    }

    // 2. Choque na mesma turma
    let choque_turma = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM horarios_turma
            WHERE tenant_id = $1 AND turma_id = $2 AND dia_semana = $3
            AND GREATEST(hora_inicio, $4) < LEAST(hora_fim, $5)
        )
        "#,
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(dto.dia_semana)
    .bind(&dto.hora_inicio)
    .bind(&dto.hora_fim)
    .fetch_one(&mut *db)
    .await?;

    if choque_turma {
        return Err(AppError::BadRequest(format!(
            "Choque de horário na turma: A turma já possui uma aula alocada neste dia da semana entre {} e {}.",
            dto.hora_inicio, dto.hora_fim
        )));
    }

    // 3. Choque de professor (se informado)
    if let Some(prof_id) = dto.professor_id {
        let conflito_prof = sqlx::query(
            r#"
            SELECT t.nome AS turma_nome, h.hora_inicio, h.hora_fim, u.name AS prof_nome
            FROM horarios_turma h
            JOIN turmas t ON h.turma_id = t.id
            JOIN users u ON h.professor_id = u.id
            WHERE h.tenant_id = $1 AND h.professor_id = $2 AND h.dia_semana = $3
            AND GREATEST(h.hora_inicio, $4) < LEAST(h.hora_fim, $5)
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(prof_id)
        .bind(dto.dia_semana)
        .bind(&dto.hora_inicio)
        .bind(&dto.hora_fim)
        .fetch_optional(&mut *db)
        .await?;

        if let Some(row) = conflito_prof {
            use sqlx::Row;
            let t_nome: String = row.get("turma_nome");
            let p_nome: String = row.get("prof_nome");
            let h_ini: String = row.get("hora_inicio");
            let h_fim: String = row.get("hora_fim");
            return Err(AppError::BadRequest(format!(
                "Choque de horário docente: O docente {} já está alocado na turma '{}' das {} às {}.",
                p_nome, t_nome, h_ini, h_fim
            )));
        }
    }

    // 4. Choque de sala (se informada)
    if let Some(s_id) = dto.sala_id {
        let conflito_sala = sqlx::query(
            r#"
            SELECT t.nome AS turma_nome, s.nome AS sala_nome, h.hora_inicio, h.hora_fim
            FROM horarios_turma h
            JOIN turmas t ON h.turma_id = t.id
            JOIN salas s ON h.sala_id = s.id
            WHERE h.tenant_id = $1 AND h.sala_id = $2 AND h.dia_semana = $3
            AND GREATEST(h.hora_inicio, $4) < LEAST(h.hora_fim, $5)
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(s_id)
        .bind(dto.dia_semana)
        .bind(&dto.hora_inicio)
        .bind(&dto.hora_fim)
        .fetch_optional(&mut *db)
        .await?;

        if let Some(row) = conflito_sala {
            use sqlx::Row;
            let t_nome: String = row.get("turma_nome");
            let s_nome: String = row.get("sala_nome");
            let h_ini: String = row.get("hora_inicio");
            let h_fim: String = row.get("hora_fim");
            return Err(AppError::BadRequest(format!(
                "Choque de espaço físico: A sala '{}' já está ocupada pela turma '{}' das {} às {}.",
                s_nome, t_nome, h_ini, h_fim
            )));
        }
    }

    let h = sqlx::query_as::<_, HorarioTurma>(
        r#"
        INSERT INTO horarios_turma (tenant_id, turma_id, disciplina_id, professor_id, sala_id, dia_semana, hora_inicio, hora_fim)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(dto.disciplina_id)
    .bind(dto.professor_id)
    .bind(dto.sala_id)
    .bind(dto.dia_semana)
    .bind(&dto.hora_inicio)
    .bind(&dto.hora_fim)
    .fetch_one(&mut *db)
    .await?;

    let disciplina_nome =
        sqlx::query_scalar::<_, String>("SELECT nome FROM disciplinas WHERE id = $1")
            .bind(h.disciplina_id)
            .fetch_optional(&mut *db)
            .await?
            .unwrap_or_default();

    let professor_nome = if let Some(pid) = h.professor_id {
        sqlx::query_scalar::<_, String>("SELECT name FROM users WHERE id = $1")
            .bind(pid)
            .fetch_optional(&mut *db)
            .await?
    } else {
        None
    };

    let sala_nome = if let Some(sid) = h.sala_id {
        sqlx::query_scalar::<_, String>("SELECT nome FROM salas WHERE id = $1")
            .bind(sid)
            .fetch_optional(&mut *db)
            .await?
    } else {
        None
    };

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_HORARIO_TURMA",
        "horarios_turma",
        Some(h.id.to_string()),
        Some(json!({ "turma_id": turma_id, "dia_semana": h.dia_semana, "inicio": h.hora_inicio, "fim": h.hora_fim })),
    )
    .await;

    Ok(Json(HorarioTurmaDetalhado {
        id: h.id,
        turma_id: h.turma_id,
        disciplina_id: h.disciplina_id,
        disciplina_nome,
        professor_id: h.professor_id,
        professor_nome,
        sala_id: h.sala_id,
        sala_nome,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fim: h.hora_fim,
        created_at: h.created_at,
    }))
}

pub async fn deletar_horario_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(horario_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let res = sqlx::query("DELETE FROM horarios_turma WHERE id = $1 AND tenant_id = $2")
        .bind(horario_id)
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
        "DELETAR_HORARIO_TURMA",
        "horarios_turma",
        Some(horario_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Horário removido com sucesso." }),
    ))
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_validacao_sobreposicao_horarios() {
        // Choque: 07:30 - 08:20 vs 08:00 - 08:50
        let h1_ini = "07:30";
        let h1_fim = "08:20";
        let h2_ini = "08:00";
        let h2_fim = "08:50";
        assert!(h1_ini.max(h2_ini) < h1_fim.min(h2_fim));

        // Sem choque: 07:30 - 08:20 vs 08:20 - 09:10
        let h3_ini = "08:20";
        let h3_fim = "09:10";
        assert!(!(h1_ini.max(h3_ini) < h1_fim.min(h3_fim)));

        // Sem choque: 09:10 - 10:00 vs 07:30 - 08:20
        assert!(!(h1_ini.max("09:10") < h1_fim.min("10:00")));
    }
}
