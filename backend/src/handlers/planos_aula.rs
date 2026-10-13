use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::{Datelike, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    handlers::professor::{carregar_atribuicoes_professor, professor_pode_lancar},
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
pub struct PlanosAulaQuery {
    pub turma_id: Uuid,
    pub disciplina_id: Option<Uuid>,
    pub semana: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct SalvarPlanoAulaDto {
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub semana_inicio: NaiveDate,
    pub objetivos: String,
    pub conteudos: String,
    #[serde(default)]
    pub habilidades_bncc: Vec<String>,
    pub atividades: String,
    pub avaliacao: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ComentarioPlanoDto {
    pub comentario: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlanoAulaResponseDto {
    pub id: Uuid,
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub disciplina_nome: String,
    pub professor_id: Uuid,
    pub professor_nome: String,
    pub semana_inicio: NaiveDate,
    pub objetivos: String,
    pub conteudos: String,
    pub habilidades_bncc: Vec<String>,
    pub atividades: String,
    pub avaliacao: Option<String>,
    pub comentario_coordenacao: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
    pub updated_at: chrono::DateTime<Utc>,
}

// ============================================================================
// FUNÇÕES PURAS DE VALIDAÇÃO E NORMALIZAÇÃO
// ============================================================================

/// Normaliza qualquer data para a segunda-feira da mesma semana.
pub fn normalizar_para_segunda_feira(data: NaiveDate) -> NaiveDate {
    let dias_desde_segunda = data.weekday().num_days_from_monday() as i64;
    data - Duration::days(dias_desde_segunda)
}

/// Valida limites de tamanho e preenchimento mínimo dos campos do plano de aula.
pub fn validar_plano_aula(
    objetivos: &str,
    conteudos: &str,
    atividades: &str,
    avaliacao: Option<&str>,
    habilidades_bncc: &[String],
) -> Result<(), &'static str> {
    if objetivos.trim().is_empty() {
        return Err("Objetivos não podem ser vazios.");
    }
    if objetivos.chars().count() > 5000 {
        return Err("Objetivos não podem exceder 5000 caracteres.");
    }

    if conteudos.trim().is_empty() {
        return Err("Conteúdos não podem ser vazios.");
    }
    if conteudos.chars().count() > 5000 {
        return Err("Conteúdos não podem exceder 5000 caracteres.");
    }

    if atividades.trim().is_empty() {
        return Err("Atividades não podem ser vazias.");
    }
    if atividades.chars().count() > 5000 {
        return Err("Atividades não podem exceder 5000 caracteres.");
    }

    if let Some(av) = avaliacao {
        if av.chars().count() > 2000 {
            return Err("Avaliação não pode exceder 2000 caracteres.");
        }
    }

    if habilidades_bncc.len() > 50 {
        return Err("Número de habilidades BNCC não pode exceder 50.");
    }
    for h in habilidades_bncc {
        if h.chars().count() > 50 {
            return Err("Código de habilidade BNCC não pode exceder 50 caracteres.");
        }
    }

    Ok(())
}

/// Valida tamanho do comentário da coordenação (máx 2000 caracteres).
pub fn validar_comentario_coordenacao(comentario: &str) -> Result<(), &'static str> {
    if comentario.chars().count() > 2000 {
        return Err("Comentário da coordenação não pode exceder 2000 caracteres.");
    }
    Ok(())
}

// ============================================================================
// HANDLERS
// ============================================================================

/// GET /api/v1/planos-aula?turma_id=&disciplina_id=&semana=YYYY-MM-DD
/// Consulta planos de aula da semana (normaliza qualquer data para a segunda-feira).
pub async fn consultar_planos_aula(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<PlanosAulaQuery>,
) -> Result<Json<Vec<PlanoAulaResponseDto>>, AppError> {
    check_roles(&auth_user, &["professor", "gestor", "admin", "secretaria"])?;
    let tenant_id = active_tenant.0;

    // Professor só consulta os planos das turmas em que dá aula.
    if auth_user.role.to_lowercase().replace('_', "") == "professor" {
        let atribuicoes = carregar_atribuicoes_professor(&mut db, auth_user.id).await?;
        if !atribuicoes
            .iter()
            .any(|(turma, _)| *turma == query.turma_id)
        {
            return Err(AppError::Forbidden(
                "Você não dá aula nesta turma.".to_string(),
            ));
        }
    }

    let data_base = query.semana.unwrap_or_else(|| Utc::now().date_naive());
    let semana_segunda = normalizar_para_segunda_feira(data_base);

    let rows = match query.disciplina_id {
        Some(disc_id) => {
            sqlx::query(
                r#"
                SELECT
                    pa.id,
                    pa.turma_id,
                    pa.disciplina_id,
                    d.nome AS disciplina_nome,
                    pa.professor_id,
                    u.name AS professor_nome,
                    pa.semana_inicio,
                    pa.objetivos,
                    pa.conteudos,
                    pa.habilidades_bncc,
                    pa.atividades,
                    pa.avaliacao,
                    pa.comentario_coordenacao,
                    pa.created_at,
                    pa.updated_at
                FROM planos_aula pa
                JOIN disciplinas d ON d.id = pa.disciplina_id
                JOIN users u ON u.id = pa.professor_id
                WHERE pa.tenant_id = $1
                  AND pa.turma_id = $2
                  AND pa.semana_inicio = $3
                  AND pa.disciplina_id = $4
                ORDER BY d.nome ASC
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(semana_segunda)
            .bind(disc_id)
            .fetch_all(&mut *db)
            .await?
        }
        None => {
            sqlx::query(
                r#"
                SELECT
                    pa.id,
                    pa.turma_id,
                    pa.disciplina_id,
                    d.nome AS disciplina_nome,
                    pa.professor_id,
                    u.name AS professor_nome,
                    pa.semana_inicio,
                    pa.objetivos,
                    pa.conteudos,
                    pa.habilidades_bncc,
                    pa.atividades,
                    pa.avaliacao,
                    pa.comentario_coordenacao,
                    pa.created_at,
                    pa.updated_at
                FROM planos_aula pa
                JOIN disciplinas d ON d.id = pa.disciplina_id
                JOIN users u ON u.id = pa.professor_id
                WHERE pa.tenant_id = $1
                  AND pa.turma_id = $2
                  AND pa.semana_inicio = $3
                ORDER BY d.nome ASC
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(semana_segunda)
            .fetch_all(&mut *db)
            .await?
        }
    };

    use sqlx::Row;
    let planos: Vec<PlanoAulaResponseDto> = rows
        .into_iter()
        .map(|row| PlanoAulaResponseDto {
            id: row.get("id"),
            turma_id: row.get("turma_id"),
            disciplina_id: row.get("disciplina_id"),
            disciplina_nome: row.get("disciplina_nome"),
            professor_id: row.get("professor_id"),
            professor_nome: row.get("professor_nome"),
            semana_inicio: row.get("semana_inicio"),
            objetivos: row.get("objetivos"),
            conteudos: row.get("conteudos"),
            habilidades_bncc: row.get("habilidades_bncc"),
            atividades: row.get("atividades"),
            avaliacao: row.get("avaliacao"),
            comentario_coordenacao: row.get("comentario_coordenacao"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect();

    Ok(Json(planos))
}

/// PUT /api/v1/planos-aula
/// Cria ou atualiza o planejamento semanal (upsert por tenant + turma + disciplina + semana_inicio).
/// Professor só grava se estiver atribuído à turma e disciplina; gestão livre.
pub async fn salvar_plano_aula(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<SalvarPlanoAulaDto>,
) -> Result<Json<PlanoAulaResponseDto>, AppError> {
    check_roles(&auth_user, &["professor", "gestor", "admin", "secretaria"])?;
    let tenant_id = active_tenant.0;

    validar_plano_aula(
        &dto.objetivos,
        &dto.conteudos,
        &dto.atividades,
        dto.avaliacao.as_deref(),
        &dto.habilidades_bncc,
    )
    .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let semana_inicio = normalizar_para_segunda_feira(dto.semana_inicio);

    let role_norm = auth_user.role.to_lowercase().replace('_', "");
    let professor_id = if role_norm == "professor" {
        let atribuicoes = carregar_atribuicoes_professor(&mut db, auth_user.id).await?;
        if !professor_pode_lancar(
            &auth_user.role,
            auth_user.id,
            dto.turma_id,
            dto.disciplina_id,
            &atribuicoes,
        ) {
            return Err(AppError::Forbidden(
                "Você não está atribuído a esta turma e disciplina.".to_string(),
            ));
        }
        auth_user.id
    } else {
        // Se for gestor/admin, procura o professor atribuído na matriz ou usa o usuário atual
        let prof_atribuido: Option<Uuid> = sqlx::query_scalar(
            r#"
            SELECT professor_id
            FROM turma_professores
            WHERE tenant_id = $1 AND turma_id = $2 AND disciplina_id = $3
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(dto.turma_id)
        .bind(dto.disciplina_id)
        .fetch_optional(&mut *db)
        .await?;

        prof_atribuido.unwrap_or(auth_user.id)
    };

    let row = sqlx::query(
        r#"
        INSERT INTO planos_aula (
            tenant_id,
            turma_id,
            disciplina_id,
            professor_id,
            semana_inicio,
            objetivos,
            conteudos,
            habilidades_bncc,
            atividades,
            avaliacao,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (tenant_id, turma_id, disciplina_id, semana_inicio)
        DO UPDATE SET
            professor_id = EXCLUDED.professor_id,
            objetivos = EXCLUDED.objetivos,
            conteudos = EXCLUDED.conteudos,
            habilidades_bncc = EXCLUDED.habilidades_bncc,
            atividades = EXCLUDED.atividades,
            avaliacao = EXCLUDED.avaliacao,
            updated_at = NOW()
        RETURNING
            id,
            turma_id,
            disciplina_id,
            professor_id,
            semana_inicio,
            objetivos,
            conteudos,
            habilidades_bncc,
            atividades,
            avaliacao,
            comentario_coordenacao,
            created_at,
            updated_at
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(dto.disciplina_id)
    .bind(professor_id)
    .bind(semana_inicio)
    .bind(dto.objetivos)
    .bind(dto.conteudos)
    .bind(&dto.habilidades_bncc)
    .bind(dto.atividades)
    .bind(dto.avaliacao)
    .fetch_one(&mut *db)
    .await?;

    use sqlx::Row;
    let plano_id: Uuid = row.get("id");
    let disciplina_id: Uuid = row.get("disciplina_id");
    let prof_id: Uuid = row.get("professor_id");

    let disciplina_nome: String =
        sqlx::query_scalar("SELECT nome FROM disciplinas WHERE id = $1 AND tenant_id = $2")
            .bind(disciplina_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .unwrap_or_else(|| "Disciplina".to_string());

    let professor_nome: String =
        sqlx::query_scalar("SELECT name FROM users WHERE id = $1 AND tenant_id = $2")
            .bind(prof_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .unwrap_or_else(|| "Professor".to_string());

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "SALVAR_PLANO_AULA",
        "planos_aula",
        Some(plano_id.to_string()),
        Some(json!({
            "turma_id": dto.turma_id,
            "disciplina_id": dto.disciplina_id,
            "semana_inicio": semana_inicio,
        })),
    )
    .await;

    let response = PlanoAulaResponseDto {
        id: plano_id,
        turma_id: row.get("turma_id"),
        disciplina_id,
        disciplina_nome,
        professor_id: prof_id,
        professor_nome,
        semana_inicio: row.get("semana_inicio"),
        objetivos: row.get("objetivos"),
        conteudos: row.get("conteudos"),
        habilidades_bncc: row.get("habilidades_bncc"),
        atividades: row.get("atividades"),
        avaliacao: row.get("avaliacao"),
        comentario_coordenacao: row.get("comentario_coordenacao"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    };

    Ok(Json(response))
}

/// PUT /api/v1/planos-aula/:id/comentario
/// Adiciona ou edita comentário pedagógico da coordenação.
/// Apenas gestão / admin / secretaria.
pub async fn comentar_plano_aula(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(dto): Json<ComentarioPlanoDto>,
) -> Result<Json<PlanoAulaResponseDto>, AppError> {
    check_roles(&auth_user, &["gestor", "admin", "secretaria"])?;
    let tenant_id = active_tenant.0;

    validar_comentario_coordenacao(&dto.comentario)
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let row = sqlx::query(
        r#"
        UPDATE planos_aula
        SET comentario_coordenacao = $1, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3
        RETURNING
            id,
            turma_id,
            disciplina_id,
            professor_id,
            semana_inicio,
            objetivos,
            conteudos,
            habilidades_bncc,
            atividades,
            avaliacao,
            comentario_coordenacao,
            created_at,
            updated_at
        "#,
    )
    .bind(dto.comentario.trim())
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    use sqlx::Row;
    let disciplina_id: Uuid = row.get("disciplina_id");
    let prof_id: Uuid = row.get("professor_id");

    let disciplina_nome: String =
        sqlx::query_scalar("SELECT nome FROM disciplinas WHERE id = $1 AND tenant_id = $2")
            .bind(disciplina_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .unwrap_or_else(|| "Disciplina".to_string());

    let professor_nome: String =
        sqlx::query_scalar("SELECT name FROM users WHERE id = $1 AND tenant_id = $2")
            .bind(prof_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .unwrap_or_else(|| "Professor".to_string());

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "COMENTARIO_PLANO_AULA",
        "planos_aula",
        Some(id.to_string()),
        Some(json!({
            "comentario_len": dto.comentario.chars().count(),
        })),
    )
    .await;

    let response = PlanoAulaResponseDto {
        id: row.get("id"),
        turma_id: row.get("turma_id"),
        disciplina_id,
        disciplina_nome,
        professor_id: prof_id,
        professor_nome,
        semana_inicio: row.get("semana_inicio"),
        objetivos: row.get("objetivos"),
        conteudos: row.get("conteudos"),
        habilidades_bncc: row.get("habilidades_bncc"),
        atividades: row.get("atividades"),
        avaliacao: row.get("avaliacao"),
        comentario_coordenacao: row.get("comentario_coordenacao"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    };

    Ok(Json(response))
}

// ============================================================================
// TESTES UNITÁRIOS DE FUNÇÕES PURAS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalizar_para_segunda_feira() {
        // Segunda-feira (12/10/2026) -> continua 12/10/2026
        let seg = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
        assert_eq!(normalizar_para_segunda_feira(seg), seg);

        // Terça-feira (13/10/2026) -> 12/10/2026
        let ter = NaiveDate::from_ymd_opt(2026, 10, 13).unwrap();
        assert_eq!(normalizar_para_segunda_feira(ter), seg);

        // Quarta-feira (14/10/2026) -> 12/10/2026
        let qua = NaiveDate::from_ymd_opt(2026, 10, 14).unwrap();
        assert_eq!(normalizar_para_segunda_feira(qua), seg);

        // Quinta-feira (15/10/2026) -> 12/10/2026
        let qui = NaiveDate::from_ymd_opt(2026, 10, 15).unwrap();
        assert_eq!(normalizar_para_segunda_feira(qui), seg);

        // Sexta-feira (16/10/2026) -> 12/10/2026
        let sex = NaiveDate::from_ymd_opt(2026, 10, 16).unwrap();
        assert_eq!(normalizar_para_segunda_feira(sex), seg);

        // Sábado (17/10/2026) -> 12/10/2026
        let sab = NaiveDate::from_ymd_opt(2026, 10, 17).unwrap();
        assert_eq!(normalizar_para_segunda_feira(sab), seg);

        // Domingo (18/10/2026) -> 12/10/2026
        let dom = NaiveDate::from_ymd_opt(2026, 10, 18).unwrap();
        assert_eq!(normalizar_para_segunda_feira(dom), seg);
    }

    #[test]
    fn test_validar_plano_aula_sucesso() {
        let res = validar_plano_aula(
            "Compreender frações equivalentes",
            "Operações com denominadores diferentes",
            "Exercícios práticos em grupo",
            Some("Avaliação formativa contínua"),
            &["EF06MA07".to_string(), "EF06MA08".to_string()],
        );
        assert!(res.is_ok());
    }

    #[test]
    fn test_validar_plano_aula_sem_avaliacao() {
        let res = validar_plano_aula(
            "Objetivo claro",
            "Conteúdo programático",
            "Atividade em sala",
            None,
            &[],
        );
        assert!(res.is_ok());
    }

    #[test]
    fn test_validar_plano_aula_campos_vazios() {
        assert!(validar_plano_aula("", "Conteúdo", "Atividade", None, &[]).is_err());
        assert!(validar_plano_aula("   ", "Conteúdo", "Atividade", None, &[]).is_err());
        assert!(validar_plano_aula("Obj", "", "Atividade", None, &[]).is_err());
        assert!(validar_plano_aula("Obj", "Cont", "", None, &[]).is_err());
    }

    #[test]
    fn test_validar_plano_aula_limites_excedidos() {
        let obj_longo = "A".repeat(5001);
        assert!(validar_plano_aula(&obj_longo, "Cont", "Ativ", None, &[]).is_err());

        let cont_longo = "B".repeat(5001);
        assert!(validar_plano_aula("Obj", &cont_longo, "Ativ", None, &[]).is_err());

        let ativ_longo = "C".repeat(5001);
        assert!(validar_plano_aula("Obj", "Cont", &ativ_longo, None, &[]).is_err());

        let av_longo = "D".repeat(2001);
        assert!(validar_plano_aula("Obj", "Cont", "Ativ", Some(&av_longo), &[]).is_err());

        let muitas_habilidades: Vec<String> = (0..51).map(|i| format!("EF{i}")).collect();
        assert!(validar_plano_aula("Obj", "Cont", "Ativ", None, &muitas_habilidades).is_err());

        let habilidade_longa = vec!["X".repeat(51)];
        assert!(validar_plano_aula("Obj", "Cont", "Ativ", None, &habilidade_longa).is_err());
    }

    #[test]
    fn test_validar_comentario_coordenacao() {
        assert!(validar_comentario_coordenacao("Excelente proposta").is_ok());
        let longo = "K".repeat(2001);
        assert!(validar_comentario_coordenacao(&longo).is_err());
    }
}
