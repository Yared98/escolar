use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    handlers::professor::{carregar_atribuicoes_professor, validar_periodo},
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit},
        tenant::ActiveTenant,
    },
};

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct FechamentosQuery {
    pub turma_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct FecharPeriodoDto {
    pub turma_id: Uuid,
    pub periodo: String,
}

#[derive(Debug, Serialize)]
pub struct FechamentoPeriodoDto {
    pub periodo: String,
    pub fechado: bool,
    pub fechado_por: Option<String>,
    pub fechado_em: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConselhoQuery {
    pub turma_id: Uuid,
    pub periodo: String,
}

#[derive(Debug, Deserialize)]
pub struct SalvarParecerDto {
    pub turma_id: Uuid,
    pub periodo: String,
    pub aluno_id: Uuid,
    pub parecer: String,
    pub encaminhamento: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AlunoConselhoDto {
    pub aluno_id: Uuid,
    pub aluno_nome: String,
    pub numero_chamada: Option<i32>,
    pub media_periodo: Option<f64>,
    pub parecer: Option<String>,
    pub encaminhamento: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ConselhoResponseDto {
    pub alunos: Vec<AlunoConselhoDto>,
}

// ============================================================================
// HANDLERS
// ============================================================================

/// GET /api/v1/academico/fechamentos?turma_id=
/// Lista os períodos e se estão fechados para a turma.
pub async fn listar_fechamentos(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<FechamentosQuery>,
) -> Result<Json<Vec<FechamentoPeriodoDto>>, AppError> {
    check_roles(&auth_user, &["gestor", "admin", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    const PERIODOS: &[&str] = &[
        "1_bimestre",
        "2_bimestre",
        "3_bimestre",
        "4_bimestre",
        "1_trimestre",
        "2_trimestre",
        "3_trimestre",
        "recuperacao",
    ];

    let fechamentos: Vec<(String, Option<String>, Option<String>)> = sqlx::query_as(
        r#"
        SELECT
            fp.periodo,
            u.name AS fechado_por_nome,
            fp.fechado_em::text AS fechado_em_text
        FROM fechamentos_periodo fp
        LEFT JOIN users u ON u.id = fp.fechado_por
        WHERE fp.tenant_id = $1 AND fp.turma_id = $2
        ORDER BY fp.periodo
        "#,
    )
    .bind(tenant_id)
    .bind(query.turma_id)
    .fetch_all(&mut *db)
    .await?;

    let mut por_periodo: std::collections::HashMap<String, (Option<String>, Option<String>)> =
        std::collections::HashMap::new();
    for (periodo, fechado_por, fechado_em) in fechamentos {
        por_periodo.insert(periodo, (fechado_por, fechado_em));
    }

    let result: Vec<FechamentoPeriodoDto> = PERIODOS
        .iter()
        .map(|periodo| {
            let (fechado_por, fechado_em) =
                por_periodo.get(*periodo).cloned().unwrap_or((None, None));
            FechamentoPeriodoDto {
                periodo: (*periodo).to_string(),
                fechado: por_periodo.contains_key(*periodo),
                fechado_por,
                fechado_em,
            }
        })
        .collect();

    Ok(Json(result))
}

/// POST /api/v1/academico/fechamentos
/// Fecha um período para uma turma. Só gestor/admin/secretaria.
pub async fn fechar_periodo(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<FecharPeriodoDto>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_roles(&auth_user, &["gestor", "admin", "secretaria"])?;
    let tenant_id = active_tenant.0;

    validar_periodo(&dto.periodo)?;

    let existente = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) FROM fechamentos_periodo
        WHERE tenant_id = $1 AND turma_id = $2 AND periodo = $3
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(&dto.periodo)
    .fetch_one(&mut *db)
    .await?;

    if existente > 0 {
        return Err(AppError::BadRequest(
            "Este período já está fechado para esta turma.".to_string(),
        ));
    }

    sqlx::query(
        r#"
        INSERT INTO fechamentos_periodo (tenant_id, turma_id, periodo, fechado_por, fechado_em)
        VALUES ($1, $2, $3, $4, NOW())
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(&dto.periodo)
    .bind(auth_user.id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "FECHAMENTO_PERIODO",
        "fechamentos_periodo",
        None,
        Some(json!({
            "turma_id": dto.turma_id,
            "periodo": dto.periodo,
        })),
    )
    .await;

    Ok(Json(json!({ "fechado": true })))
}

/// DELETE /api/v1/academico/fechamentos/:id
/// Reabre um período para uma turma. Só gestor/admin/secretaria.
pub async fn reabrir_periodo(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_roles(&auth_user, &["gestor", "admin", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let deletado = sqlx::query(
        r#"
        DELETE FROM fechamentos_periodo
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    if deletado.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "REABERTURA_PERIODO",
        "fechamentos_periodo",
        Some(id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "reaberto": true })))
}

/// GET /api/v1/academico/conselho?turma_id=&periodo=
/// Lista os alunos ativos da turma com média do período e parecer existente.
pub async fn listar_conselhos(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<ConselhoQuery>,
) -> Result<Json<ConselhoResponseDto>, AppError> {
    check_roles(&auth_user, &["gestor", "admin", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;
    let role_norm = auth_user.role.to_lowercase().replace('_', "");

    validar_periodo(&query.periodo)?;

    // Professor só consulta se atribuído à turma (qualquer disciplina).
    if role_norm == "professor" {
        let atribuicoes = carregar_atribuicoes_professor(&mut db, auth_user.id).await?;
        let tem_atribuicao = atribuicoes.iter().any(|(t, _)| *t == query.turma_id);
        if !tem_atribuicao {
            return Err(AppError::Forbidden(
                "Você não está atribuído a esta turma.".to_string(),
            ));
        }
    }

    let rows = sqlx::query(
        r#"
        SELECT
            a.id AS aluno_id,
            a.nome AS aluno_nome,
            ta.numero_chamada,
            (
                SELECT AVG(n.nota)
                FROM notas n
                WHERE n.tenant_id = ta.tenant_id
                  AND n.aluno_id = a.id
                  AND n.periodo = $3
            ) AS media_periodo,
            pc.parecer,
            pc.encaminhamento
        FROM turma_alunos ta
        JOIN alunos a ON a.id = ta.aluno_id
        LEFT JOIN pareceres_conselho pc
            ON pc.tenant_id = ta.tenant_id
           AND pc.aluno_id = a.id
           AND pc.periodo = $3
        WHERE ta.turma_id = $1
          AND ta.status = 'ativo'
          AND a.status = 'ativo'
        ORDER BY ta.numero_chamada ASC NULLS LAST, a.nome ASC
        "#,
    )
    .bind(query.turma_id)
    .bind(tenant_id)
    .bind(&query.periodo)
    .fetch_all(&mut *db)
    .await?;

    use sqlx::Row;
    let alunos: Vec<AlunoConselhoDto> = rows
        .into_iter()
        .map(|row| AlunoConselhoDto {
            aluno_id: row.get("aluno_id"),
            aluno_nome: row.get("aluno_nome"),
            numero_chamada: row.get("numero_chamada"),
            media_periodo: row.get::<Option<f64>, _>("media_periodo"),
            parecer: row.get("parecer"),
            encaminhamento: row.get("encaminhamento"),
        })
        .collect();

    Ok(Json(ConselhoResponseDto { alunos }))
}

/// PUT /api/v1/academico/conelho
/// Salva (upsert) o parecer do conselho para um aluno/período.
pub async fn salvar_parecer(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<SalvarParecerDto>,
) -> Result<Json<serde_json::Value>, AppError> {
    check_roles(&auth_user, &["gestor", "admin", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;
    let role_norm = auth_user.role.to_lowercase().replace('_', "");

    validar_periodo(&dto.periodo)?;

    if dto.parecer.trim().is_empty() {
        return Err(AppError::BadRequest(
            "O parecer não pode estar vazio.".to_string(),
        ));
    }
    if dto.parecer.chars().count() > 2000 {
        return Err(AppError::BadRequest(
            "O parecer aceita no máximo 2000 caracteres.".to_string(),
        ));
    }

    if let Some(ref enc) = dto.encaminhamento {
        if !matches!(
            enc.as_str(),
            "recuperacao" | "acompanhamento" | "sem_pendencias"
        ) {
            return Err(AppError::BadRequest(
                "Encaminhamento inválido. Valores aceitos: recuperacao, acompanhamento, sem_pendencias.".to_string(),
            ));
        }
    }

    // Professor só salva parecer se atribuído à turma (qualquer disciplina).
    if role_norm == "professor" {
        let atribuicoes = carregar_atribuicoes_professor(&mut db, auth_user.id).await?;
        let tem_atribuicao = atribuicoes.iter().any(|(t, _)| *t == dto.turma_id);
        if !tem_atribuicao {
            return Err(AppError::Forbidden(
                "Você não está atribuído a esta turma.".to_string(),
            ));
        }
    }

    sqlx::query(
        r#"
        INSERT INTO pareceres_conselho (tenant_id, turma_id, aluno_id, periodo, parecer, encaminhamento, registrado_por, registrado_em)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (tenant_id, aluno_id, periodo) DO UPDATE SET
            parecer = EXCLUDED.parecer,
            encaminhamento = EXCLUDED.encaminhamento,
            registrado_por = EXCLUDED.registrado_por,
            registrado_em = EXCLUDED.registrado_em
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(dto.aluno_id)
    .bind(&dto.periodo)
    .bind(&dto.parecer)
    .bind(&dto.encaminhamento)
    .bind(auth_user.id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "PARECER_CONSELHO",
        "pareceres_conselho",
        None,
        Some(json!({
            "turma_id": dto.turma_id,
            "aluno_id": dto.aluno_id,
            "periodo": dto.periodo,
            "encaminhamento": dto.encaminhamento,
        })),
    )
    .await;

    Ok(Json(json!({ "salvo": true })))
}
