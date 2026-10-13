use axum::{
    extract::{Json, Path, Query, State},
    Extension,
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
    models::secretaria::{CreateTurmaDto, ListTurmasQuery, Turma, TurmaDetalhada, UpdateTurmaDto},
};

pub async fn criar_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateTurmaDto>,
) -> Result<Json<TurmaDetalhada>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;
    let cap = dto.capacidade_maxima.unwrap_or(35);
    let etapa = dto
        .etapa_ensino
        .unwrap_or_else(|| "fundamental_1".to_string());
    let turno = dto.turno.unwrap_or_else(|| "matutino".to_string());
    let status = dto.status.unwrap_or_else(|| "ativo".to_string());

    let turma = sqlx::query_as::<_, Turma>(
        r#"
        INSERT INTO turmas (tenant_id, sala_id, codigo, nome, etapa_ensino, serie, turno, ano_letivo, capacidade_maxima, professor_regente_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.sala_id)
    .bind(&dto.codigo)
    .bind(&dto.nome)
    .bind(&etapa)
    .bind(&dto.serie)
    .bind(&turno)
    .bind(dto.ano_letivo)
    .bind(cap)
    .bind(dto.professor_regente_id)
    .bind(&status)
    .fetch_one(&mut *db)
    .await?;

    let sala_nome = if let Some(sid) = turma.sala_id {
        sqlx::query_scalar::<_, String>("SELECT nome FROM salas WHERE id = $1")
            .bind(sid)
            .fetch_optional(&mut *db)
            .await?
    } else {
        None
    };

    let professor_regente_nome = if let Some(pid) = turma.professor_regente_id {
        sqlx::query_scalar::<_, String>("SELECT name FROM users WHERE id = $1")
            .bind(pid)
            .fetch_optional(&mut *db)
            .await?
    } else {
        None
    };

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_TURMA",
        "turma",
        Some(turma.id.to_string()),
        Some(json!({ "nome": turma.nome, "ano_letivo": turma.ano_letivo, "turno": turma.turno })),
    )
    .await;

    Ok(Json(TurmaDetalhada {
        id: turma.id,
        tenant_id: turma.tenant_id,
        sala_id: turma.sala_id,
        sala_nome,
        codigo: turma.codigo,
        nome: turma.nome,
        etapa_ensino: turma.etapa_ensino,
        serie: turma.serie,
        turno: turma.turno,
        ano_letivo: turma.ano_letivo,
        capacidade_maxima: turma.capacidade_maxima,
        professor_regente_id: turma.professor_regente_id,
        professor_regente_nome,
        status: turma.status,
        alunos_matriculados: 0,
        vagas_restantes: turma.capacidade_maxima as i64,
        created_at: turma.created_at,
    }))
}

pub async fn listar_turmas(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<ListTurmasQuery>,
) -> Result<Json<Vec<TurmaDetalhada>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let busca = query
        .q
        .or(query.busca)
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let busca_like = busca.as_ref().map(|s| format!("%{}%", s));

    let turno_trim = query
        .turno
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let status_trim = query
        .status
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let rows = sqlx::query(
        r#"
        SELECT 
            t.id,
            t.tenant_id,
            t.sala_id,
            s.nome AS sala_nome,
            t.codigo,
            t.nome,
            t.etapa_ensino,
            t.serie,
            t.turno,
            t.ano_letivo,
            t.capacidade_maxima,
            t.professor_regente_id,
            u.name AS professor_regente_nome,
            t.status,
            COALESCE(COUNT(ta.id) FILTER (WHERE ta.status = 'ativo'), 0)::int8 AS alunos_matriculados,
            t.created_at
        FROM turmas t
        LEFT JOIN salas s ON t.sala_id = s.id
        LEFT JOIN users u ON t.professor_regente_id = u.id
        LEFT JOIN turma_alunos ta ON t.id = ta.turma_id
        WHERE t.tenant_id = $1
          AND (
            $2::TEXT IS NULL
            OR t.nome ILIKE $2
            OR COALESCE(t.codigo, '') ILIKE $2
            OR COALESCE(t.serie, '') ILIKE $2
            OR COALESCE(t.etapa_ensino, '') ILIKE $2
          )
          AND ($3::INT IS NULL OR t.ano_letivo = $3)
          AND ($4::TEXT IS NULL OR t.turno ILIKE $4)
          AND ($5::TEXT IS NULL OR t.status = $5)
        GROUP BY t.id, s.nome, u.name
        ORDER BY t.ano_letivo DESC, t.nome ASC
        "#,
    )
    .bind(tenant_id)
    .bind(busca_like)
    .bind(query.ano_letivo)
    .bind(turno_trim)
    .bind(status_trim)
    .fetch_all(&mut *db)
    .await?;

    let turmas = rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            let cap: i32 = row.get("capacidade_maxima");
            let matriculados: i64 = row.get("alunos_matriculados");
            let vagas = (cap as i64 - matriculados).max(0);
            TurmaDetalhada {
                id: row.get("id"),
                tenant_id: row.get("tenant_id"),
                sala_id: row.get("sala_id"),
                sala_nome: row.get("sala_nome"),
                codigo: row.get("codigo"),
                nome: row.get("nome"),
                etapa_ensino: row.get("etapa_ensino"),
                serie: row.get("serie"),
                turno: row.get("turno"),
                ano_letivo: row.get("ano_letivo"),
                capacidade_maxima: cap,
                professor_regente_id: row.get("professor_regente_id"),
                professor_regente_nome: row.get("professor_regente_nome"),
                status: row.get("status"),
                alunos_matriculados: matriculados,
                vagas_restantes: vagas,
                created_at: row.get("created_at"),
            }
        })
        .collect();

    Ok(Json(turmas))
}

pub async fn obter_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<TurmaDetalhada>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let row = sqlx::query(
        r#"
        SELECT 
            t.id,
            t.tenant_id,
            t.sala_id,
            s.nome AS sala_nome,
            t.codigo,
            t.nome,
            t.etapa_ensino,
            t.serie,
            t.turno,
            t.ano_letivo,
            t.capacidade_maxima,
            t.professor_regente_id,
            u.name AS professor_regente_nome,
            t.status,
            COALESCE(COUNT(ta.id) FILTER (WHERE ta.status = 'ativo'), 0)::int8 AS alunos_matriculados,
            t.created_at
        FROM turmas t
        LEFT JOIN salas s ON t.sala_id = s.id
        LEFT JOIN users u ON t.professor_regente_id = u.id
        LEFT JOIN turma_alunos ta ON t.id = ta.turma_id
        WHERE t.id = $1 AND t.tenant_id = $2
        GROUP BY t.id, s.nome, u.name
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    use sqlx::Row;
    let cap: i32 = row.get("capacidade_maxima");
    let matriculados: i64 = row.get("alunos_matriculados");
    let vagas = (cap as i64 - matriculados).max(0);

    Ok(Json(TurmaDetalhada {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        sala_id: row.get("sala_id"),
        sala_nome: row.get("sala_nome"),
        codigo: row.get("codigo"),
        nome: row.get("nome"),
        etapa_ensino: row.get("etapa_ensino"),
        serie: row.get("serie"),
        turno: row.get("turno"),
        ano_letivo: row.get("ano_letivo"),
        capacidade_maxima: cap,
        professor_regente_id: row.get("professor_regente_id"),
        professor_regente_nome: row.get("professor_regente_nome"),
        status: row.get("status"),
        alunos_matriculados: matriculados,
        vagas_restantes: vagas,
        created_at: row.get("created_at"),
    }))
}

pub async fn atualizar_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
    Json(dto): Json<UpdateTurmaDto>,
) -> Result<Json<Turma>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let turma = sqlx::query_as::<_, Turma>(
        r#"
        UPDATE turmas
        SET
            sala_id = COALESCE($1, sala_id),
            codigo = COALESCE($2, codigo),
            nome = COALESCE($3, nome),
            etapa_ensino = COALESCE($4, etapa_ensino),
            serie = COALESCE($5, serie),
            turno = COALESCE($6, turno),
            ano_letivo = COALESCE($7, ano_letivo),
            capacidade_maxima = COALESCE($8, capacidade_maxima),
            professor_regente_id = COALESCE($9, professor_regente_id),
            status = COALESCE($10, status)
        WHERE id = $11 AND tenant_id = $12
        RETURNING *
        "#,
    )
    .bind(dto.sala_id)
    .bind(dto.codigo)
    .bind(dto.nome)
    .bind(dto.etapa_ensino)
    .bind(dto.serie)
    .bind(dto.turno)
    .bind(dto.ano_letivo)
    .bind(dto.capacidade_maxima)
    .bind(dto.professor_regente_id)
    .bind(dto.status)
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_TURMA",
        "turma",
        Some(turma_id.to_string()),
        None,
    )
    .await;

    Ok(Json(turma))
}

pub async fn deletar_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let result = sqlx::query("DELETE FROM turmas WHERE id = $1 AND tenant_id = $2")
        .bind(turma_id)
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
        "DELETAR_TURMA",
        "turma",
        Some(turma_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Turma removida com sucesso." }),
    ))
}

pub fn validar_capacidade_turma(
    alunos_ativos: i64,
    capacidade_maxima: i32,
) -> Result<(), &'static str> {
    if alunos_ativos >= capacidade_maxima as i64 {
        Err("Capacidade máxima da turma atingida. Ensalamento bloqueado para evitar sobrelotação.")
    } else {
        Ok(())
    }
}

#[allow(dead_code)]
pub fn validar_choque_horario(
    dia_semana_a: u8,
    hora_inicio_a: &str,
    hora_fim_a: &str,
    dia_semana_b: u8,
    hora_inicio_b: &str,
    hora_fim_b: &str,
) -> bool {
    if dia_semana_a != dia_semana_b {
        return false;
    }
    let max_inicio = hora_inicio_a.max(hora_inicio_b);
    let min_fim = hora_fim_a.min(hora_fim_b);
    max_inicio < min_fim
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validar_capacidade_turma_permite_quando_ha_vagas() {
        let resultado = validar_capacidade_turma(25, 30);
        assert!(resultado.is_ok());
    }

    #[test]
    fn test_validar_capacidade_turma_bloqueia_quando_lotada() {
        let resultado = validar_capacidade_turma(30, 30);
        assert!(resultado.is_err());
        assert_eq!(
            resultado.unwrap_err(),
            "Capacidade máxima da turma atingida. Ensalamento bloqueado para evitar sobrelotação."
        );

        let resultado_excedente = validar_capacidade_turma(35, 30);
        assert!(resultado_excedente.is_err());
    }

    #[test]
    fn test_validar_choque_horario_detecta_sobreposicao() {
        // Segunda-feira (1), das 08:00 às 10:00 vs 09:30 às 11:30 -> Choque detectado
        let tem_choque = validar_choque_horario(1, "08:00", "10:00", 1, "09:30", "11:30");
        assert!(tem_choque, "Deveria detectar sobreposição de horários");
    }

    #[test]
    fn test_validar_choque_horario_permite_horarios_disjuntos() {
        // Segunda-feira (1), das 08:00 às 09:40 vs 10:00 às 11:40 -> Sem choque
        let tem_choque = validar_choque_horario(1, "08:00", "09:40", 1, "10:00", "11:40");
        assert!(
            !tem_choque,
            "Horários contíguos/disjuntos não devem acusar choque"
        );

        // Dias da semana diferentes não geram choque mesmo com mesmo horário
        let choque_dias_diferentes =
            validar_choque_horario(1, "08:00", "10:00", 2, "08:00", "10:00");
        assert!(!choque_dias_diferentes);
    }
}
