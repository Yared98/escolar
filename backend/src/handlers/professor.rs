use axum::{
    extract::{Query, State},
    Extension, Json,
};
use chrono::{Datelike, FixedOffset, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Acquire;
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
};

// ============================================================================
// DTOs de entrada e saída
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AulasQuery {
    pub data: Option<NaiveDate>,
    pub professor_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct NotasQuery {
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub periodo: String,
}

#[derive(Debug, Deserialize)]
pub struct NotaLoteItemDto {
    pub aluno_id: Uuid,
    pub nota: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct LoteNotasDto {
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub periodo: String,
    pub notas: Vec<NotaLoteItemDto>,
}

#[derive(Debug, Serialize)]
pub struct MinhaTurmaDisciplinaDto {
    pub disciplina_id: Uuid,
    pub disciplina_nome: String,
}

#[derive(Debug, Serialize)]
pub struct MinhaTurmaDto {
    pub turma_id: Uuid,
    pub turma_nome: String,
    pub etapa_ensino: String,
    pub total_alunos: i64,
    pub disciplinas: Vec<MinhaTurmaDisciplinaDto>,
}

#[derive(Debug, Serialize)]
pub struct AulaDiaDto {
    pub horario_id: Uuid,
    pub turma_id: Uuid,
    pub turma_nome: String,
    pub disciplina_id: Uuid,
    pub disciplina_nome: String,
    pub sala_nome: Option<String>,
    pub hora_inicio: String,
    pub hora_fim: String,
    pub chamada_registrada: bool,
}

#[derive(Debug, Serialize)]
pub struct NotaAlunoDto {
    pub aluno_id: Uuid,
    pub aluno_nome: String,
    pub numero_chamada: Option<i32>,
    pub nota: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct LoteNotasResponseDto {
    pub gravadas: usize,
    pub ignoradas: usize,
}

// ============================================================================
// FUNÇÕES PURAS DE VALIDAÇÃO (testáveis sem banco)
// ============================================================================

const PERIODOS_VALIDOS: &[&str] = &[
    "1_bimestre",
    "2_bimestre",
    "3_bimestre",
    "4_bimestre",
    "1_trimestre",
    "2_trimestre",
    "3_trimestre",
    "recuperacao",
];

pub fn validar_periodo(periodo: &str) -> Result<(), AppError> {
    if PERIODOS_VALIDOS.contains(&periodo) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Período inválido. Valores aceitos: {}.",
            PERIODOS_VALIDOS.join(", ")
        )))
    }
}

pub fn validar_e_arredondar_nota(nota: Option<f64>) -> Result<Option<f64>, AppError> {
    match nota {
        None => Ok(None),
        Some(n) if n < 0.0 || n > 10.0 => Err(AppError::BadRequest(
            "A nota deve estar entre 0 e 10.".to_string(),
        )),
        Some(n) => Ok(Some((n * 100.0).round() / 100.0)),
    }
}

/// Converte uma data no fuso de Brasília para o dia da semana usado no banco:
/// 1 = segunda … 6 = sábado. Domingo retorna `None`.
pub fn data_para_dia_semana(data: NaiveDate) -> Option<i32> {
    match data.weekday() {
        chrono::Weekday::Mon => Some(1),
        chrono::Weekday::Tue => Some(2),
        chrono::Weekday::Wed => Some(3),
        chrono::Weekday::Thu => Some(4),
        chrono::Weekday::Fri => Some(5),
        chrono::Weekday::Sat => Some(6),
        chrono::Weekday::Sun => None,
    }
}

/// Verifica se um professor pode lançar/consultar notas de uma turma+disciplina,
/// com base nas atribuições carregadas do banco.
pub fn professor_pode_lancar(
    role: &str,
    _professor_id: Uuid,
    turma_id: Uuid,
    disciplina_id: Uuid,
    atribuicoes: &[(Uuid, Uuid)],
) -> bool {
    let role_norm = role.to_lowercase().replace('_', "");
    if role_norm == "admin" || role_norm == "gestor" || role_norm == "secretaria" {
        return true;
    }
    atribuicoes
        .iter()
        .any(|(t, d)| *t == turma_id && *d == disciplina_id)
        && role_norm == "professor"
}

async fn carregar_atribuicoes_professor(
    db: &mut sqlx::PgConnection,
    professor_id: Uuid,
) -> Result<Vec<(Uuid, Uuid)>, AppError> {
    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        r#"
        SELECT turma_id, disciplina_id
        FROM turma_professores
        WHERE professor_id = $1
        "#,
    )
    .bind(professor_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

/// Retorna a data de hoje no fuso de Brasília (UTC-3) como NaiveDate.
fn hoje_brasilia() -> NaiveDate {
    // America/Sao_Paulo alterna entre UTC-3 e UTC-2 no horário de verão.
    // Sem chrono-tz, usamos UTC-3 como aproximação robusta para o dia de hoje.
    let offset = FixedOffset::west_opt(3 * 3600).expect("offset válido");
    Utc::now().with_timezone(&offset).date_naive()
}

// ============================================================================
// HANDLERS
// ============================================================================

pub async fn minhas_turmas(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<MinhaTurmaDto>>, AppError> {
    check_roles(&auth_user, &["professor", "gestor", "admin", "secretaria"])?;
    let _tenant_id = active_tenant.0;
    let role_norm = auth_user.role.to_lowercase().replace('_', "");

    let rows = if role_norm == "professor" {
        // Professor: apenas turmas em que tem atribuição, com suas disciplinas.
        sqlx::query(
            r#"
            SELECT
                t.id AS turma_id,
                t.nome AS turma_nome,
                t.etapa_ensino,
                d.id AS disciplina_id,
                d.nome AS disciplina_nome,
                (SELECT COUNT(*)::bigint
                 FROM turma_alunos ta
                 JOIN alunos a ON a.id = ta.aluno_id
                 WHERE ta.turma_id = t.id AND a.status = 'ativo') AS total_alunos
            FROM turmas t
            INNER JOIN turma_professores tp ON tp.turma_id = t.id
            INNER JOIN disciplinas d ON d.id = tp.disciplina_id
            WHERE tp.professor_id = $1
              AND t.status = 'ativo'
            ORDER BY t.nome ASC, d.nome ASC
            "#,
        )
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        // Gestor/admin/secretaria: todas as turmas ativas, com matriz curricular.
        sqlx::query(
            r#"
            SELECT
                t.id AS turma_id,
                t.nome AS turma_nome,
                t.etapa_ensino,
                d.id AS disciplina_id,
                d.nome AS disciplina_nome,
                (SELECT COUNT(*)::bigint
                 FROM turma_alunos ta
                 JOIN alunos a ON a.id = ta.aluno_id
                 WHERE ta.turma_id = t.id AND a.status = 'ativo') AS total_alunos
            FROM turmas t
            LEFT JOIN turma_disciplinas td ON td.turma_id = t.id
            LEFT JOIN disciplinas d ON d.id = td.disciplina_id
            WHERE t.status = 'ativo'
            ORDER BY t.nome ASC, d.nome ASC
            "#,
        )
        .fetch_all(&mut *db)
        .await?
    };

    use sqlx::Row;
    let mut turmas_map: std::collections::BTreeMap<Uuid, MinhaTurmaDto> =
        std::collections::BTreeMap::new();

    for row in rows {
        let turma_id: Uuid = row.get("turma_id");
        let entry = turmas_map.entry(turma_id).or_insert_with(|| MinhaTurmaDto {
            turma_id,
            turma_nome: row.get("turma_nome"),
            etapa_ensino: row.get("etapa_ensino"),
            total_alunos: row.get("total_alunos"),
            disciplinas: Vec::new(),
        });

        if let Some(disciplina_id) = row
            .try_get::<Option<Uuid>, _>("disciplina_id")
            .ok()
            .flatten()
        {
            let disciplina_nome: String = row.get("disciplina_nome");
            if !entry
                .disciplinas
                .iter()
                .any(|d| d.disciplina_id == disciplina_id)
            {
                entry.disciplinas.push(MinhaTurmaDisciplinaDto {
                    disciplina_id,
                    disciplina_nome,
                });
            }
        }
    }

    Ok(Json(turmas_map.into_values().collect()))
}

pub async fn aulas_do_dia(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<AulasQuery>,
) -> Result<Json<Vec<AulaDiaDto>>, AppError> {
    check_roles(&auth_user, &["professor", "gestor", "admin"])?;
    let _tenant_id = active_tenant.0;
    let role_norm = auth_user.role.to_lowercase().replace('_', "");

    let data = query.data.unwrap_or_else(hoje_brasilia);
    let dia_semana = match data_para_dia_semana(data) {
        Some(d) => d,
        None => return Ok(Json(Vec::new())), // domingo
    };

    let professor_filtro = if role_norm == "gestor" || role_norm == "admin" {
        query.professor_id
    } else {
        Some(auth_user.id)
    };

    let rows = match professor_filtro {
        Some(prof_id) => {
            sqlx::query(
                r#"
                SELECT
                    h.id AS horario_id,
                    h.turma_id,
                    t.nome AS turma_nome,
                    h.disciplina_id,
                    d.nome AS disciplina_nome,
                    s.nome AS sala_nome,
                    h.hora_inicio,
                    h.hora_fim,
                    EXISTS(
                        SELECT 1 FROM diarios_classe dc
                        WHERE dc.turma_id = h.turma_id AND dc.data_aula = $2
                    ) AS chamada_registrada
                FROM horarios_turma h
                JOIN turmas t ON t.id = h.turma_id
                JOIN disciplinas d ON d.id = h.disciplina_id
                LEFT JOIN salas s ON s.id = h.sala_id
                WHERE h.dia_semana = $1
                  AND h.professor_id = $3
                ORDER BY h.hora_inicio ASC
                "#,
            )
            .bind(dia_semana)
            .bind(data)
            .bind(prof_id)
            .fetch_all(&mut *db)
            .await?
        }
        None => {
            sqlx::query(
                r#"
                SELECT
                    h.id AS horario_id,
                    h.turma_id,
                    t.nome AS turma_nome,
                    h.disciplina_id,
                    d.nome AS disciplina_nome,
                    s.nome AS sala_nome,
                    h.hora_inicio,
                    h.hora_fim,
                    EXISTS(
                        SELECT 1 FROM diarios_classe dc
                        WHERE dc.turma_id = h.turma_id AND dc.data_aula = $2
                    ) AS chamada_registrada
                FROM horarios_turma h
                JOIN turmas t ON t.id = h.turma_id
                JOIN disciplinas d ON d.id = h.disciplina_id
                LEFT JOIN salas s ON s.id = h.sala_id
                WHERE h.dia_semana = $1
                ORDER BY h.hora_inicio ASC
                "#,
            )
            .bind(dia_semana)
            .bind(data)
            .fetch_all(&mut *db)
            .await?
        }
    };

    use sqlx::Row;
    let aulas: Vec<AulaDiaDto> = rows
        .into_iter()
        .map(|row| AulaDiaDto {
            horario_id: row.get("horario_id"),
            turma_id: row.get("turma_id"),
            turma_nome: row.get("turma_nome"),
            disciplina_id: row.get("disciplina_id"),
            disciplina_nome: row.get("disciplina_nome"),
            sala_nome: row.get("sala_nome"),
            hora_inicio: row.get("hora_inicio"),
            hora_fim: row.get("hora_fim"),
            chamada_registrada: row.get("chamada_registrada"),
        })
        .collect();

    Ok(Json(aulas))
}

pub async fn listar_notas(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<NotasQuery>,
) -> Result<Json<Vec<NotaAlunoDto>>, AppError> {
    check_roles(&auth_user, &["professor", "gestor", "admin", "secretaria"])?;
    let _tenant_id = active_tenant.0;

    validar_periodo(&query.periodo)?;

    // Professor só consulta se atribuído à turma+disciplina.
    let role_norm = auth_user.role.to_lowercase().replace('_', "");
    if role_norm == "professor" {
        let atribuicoes = carregar_atribuicoes_professor(&mut db, auth_user.id).await?;
        if !professor_pode_lancar(
            &auth_user.role,
            auth_user.id,
            query.turma_id,
            query.disciplina_id,
            &atribuicoes,
        ) {
            return Err(AppError::Forbidden(
                "Você não está atribuído a esta turma e disciplina.".to_string(),
            ));
        }
    }

    // Busca o nome da disciplina para usar como chave canônica em `notas`.
    let disciplina_nome: String =
        sqlx::query_scalar("SELECT nome FROM disciplinas WHERE id = $1 AND status = 'ativo'")
            .bind(query.disciplina_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    let rows = sqlx::query(
        r#"
        SELECT
            a.id AS aluno_id,
            a.nome AS aluno_nome,
            ta.numero_chamada,
            n.nota
        FROM turma_alunos ta
        JOIN alunos a ON a.id = ta.aluno_id
        LEFT JOIN notas n
            ON n.aluno_id = a.id
           AND n.disciplina_nome = $3
           AND n.periodo = $4
        WHERE ta.turma_id = $1
          AND a.status = 'ativo'
        ORDER BY ta.numero_chamada ASC NULLS LAST, a.nome ASC
        "#,
    )
    .bind(query.turma_id)
    .bind(query.disciplina_id)
    .bind(&disciplina_nome)
    .bind(&query.periodo)
    .fetch_all(&mut *db)
    .await?;

    use sqlx::Row;
    let notas: Vec<NotaAlunoDto> = rows
        .into_iter()
        .map(|row| NotaAlunoDto {
            aluno_id: row.get("aluno_id"),
            aluno_nome: row.get("aluno_nome"),
            numero_chamada: row.get("numero_chamada"),
            nota: row.get("nota"),
        })
        .collect();

    Ok(Json(notas))
}

pub async fn lancar_notas_lote(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<LoteNotasDto>,
) -> Result<Json<LoteNotasResponseDto>, AppError> {
    check_roles(&auth_user, &["professor", "gestor", "admin"])?;
    let tenant_id = active_tenant.0;

    validar_periodo(&dto.periodo)?;

    if dto.notas.is_empty() {
        return Err(AppError::BadRequest(
            "A lista de notas não pode estar vazia.".to_string(),
        ));
    }
    if dto.notas.len() > 200 {
        return Err(AppError::BadRequest(
            "O lote pode conter no máximo 200 notas.".to_string(),
        ));
    }

    // Professor só lança se atribuído à turma+disciplina.
    let role_norm = auth_user.role.to_lowercase().replace('_', "");
    if role_norm == "professor" {
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
    }

    let disciplina_nome: String =
        sqlx::query_scalar("SELECT nome FROM disciplinas WHERE id = $1 AND status = 'ativo'")
            .bind(dto.disciplina_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    // Valida todas as notas antes de tocar no banco.
    let mut itens_validados: Vec<(Uuid, Option<f64>)> = Vec::with_capacity(dto.notas.len());
    for item in dto.notas {
        let nota_arredondada = validar_e_arredondar_nota(item.nota)?;
        itens_validados.push((item.aluno_id, nota_arredondada));
    }

    // Lista de alunos efetivamente enturmados na turma.
    let alunos_enturmados: Vec<Uuid> = sqlx::query_scalar(
        r#"
        SELECT a.id
        FROM turma_alunos ta
        JOIN alunos a ON a.id = ta.aluno_id
        WHERE ta.turma_id = $1 AND a.status = 'ativo'
        "#,
    )
    .bind(dto.turma_id)
    .fetch_all(&mut *db)
    .await?;

    let mut gravadas = 0usize;
    let mut ignoradas = 0usize;

    let mut tx = (&mut *db).begin().await?;

    for (aluno_id, nota_opt) in itens_validados {
        if !alunos_enturmados.contains(&aluno_id) {
            return Err(AppError::BadRequest(
                "O aluno informado não está enturmado nesta turma.".to_string(),
            ));
        }

        let Some(nota) = nota_opt else {
            ignoradas += 1;
            continue;
        };

        // Atualiza todas as linhas existentes para a chave canônica (possíveis duplicatas antigas).
        let updated = sqlx::query(
            r#"
            UPDATE notas
            SET nota = $1
            WHERE tenant_id = $2
              AND aluno_id = $3
              AND disciplina_nome = $4
              AND periodo = $5
            "#,
        )
        .bind(nota)
        .bind(tenant_id)
        .bind(aluno_id)
        .bind(&disciplina_nome)
        .bind(&dto.periodo)
        .execute(&mut *tx)
        .await?;

        if updated.rows_affected() == 0 {
            sqlx::query(
                r#"
                INSERT INTO notas (tenant_id, aluno_id, disciplina_nome, nota, periodo)
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(tenant_id)
            .bind(aluno_id)
            .bind(&disciplina_nome)
            .bind(nota)
            .bind(&dto.periodo)
            .execute(&mut *tx)
            .await?;
        }

        gravadas += 1;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "NOTAS_LOTE",
        "notas",
        None,
        Some(json!({
            "turma_id": dto.turma_id,
            "disciplina_id": dto.disciplina_id,
            "periodo": dto.periodo,
            "gravadas": gravadas,
            "ignoradas": ignoradas
        })),
    )
    .await;

    Ok(Json(LoteNotasResponseDto {
        gravadas,
        ignoradas,
    }))
}

// ============================================================================
// TESTES UNITÁRIOS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_validar_periodo_aceitos() {
        for p in PERIODOS_VALIDOS {
            assert!(validar_periodo(p).is_ok());
        }
    }

    #[test]
    fn test_validar_periodo_rejeitado() {
        assert!(validar_periodo("5_bimestre").is_err());
        assert!(validar_periodo("").is_err());
    }

    #[test]
    fn test_validar_e_arredondar_nota() {
        assert_eq!(validar_e_arredondar_nota(None).unwrap(), None);
        assert_eq!(validar_e_arredondar_nota(Some(8.0)).unwrap(), Some(8.0));
        assert_eq!(
            validar_e_arredondar_nota(Some(7.12345)).unwrap(),
            Some(7.12)
        );
        assert_eq!(validar_e_arredondar_nota(Some(7.125)).unwrap(), Some(7.13));
        assert!(validar_e_arredondar_nota(Some(-0.1)).is_err());
        assert!(validar_e_arredondar_nota(Some(10.1)).is_err());
        assert!(validar_e_arredondar_nota(Some(10.0)).is_ok());
    }

    #[test]
    fn test_data_para_dia_semana() {
        // 2026-10-12 é segunda-feira
        assert_eq!(
            data_para_dia_semana(NaiveDate::from_ymd_opt(2026, 10, 12).unwrap()),
            Some(1)
        );
        // 2026-10-17 é sábado
        assert_eq!(
            data_para_dia_semana(NaiveDate::from_ymd_opt(2026, 10, 17).unwrap()),
            Some(6)
        );
        // 2026-10-18 é domingo
        assert_eq!(
            data_para_dia_semana(NaiveDate::from_ymd_opt(2026, 10, 18).unwrap()),
            None
        );
    }

    #[test]
    fn test_professor_pode_lancar() {
        let turma = Uuid::new_v4();
        let disciplina = Uuid::new_v4();
        let outra_turma = Uuid::new_v4();
        let professor_id = Uuid::new_v4();

        let atribuicoes = vec![(turma, disciplina)];

        assert!(professor_pode_lancar(
            "professor",
            professor_id,
            turma,
            disciplina,
            &atribuicoes
        ));
        assert!(!professor_pode_lancar(
            "professor",
            professor_id,
            outra_turma,
            disciplina,
            &atribuicoes
        ));

        // Gestor e admin sempre podem
        assert!(professor_pode_lancar(
            "gestor",
            professor_id,
            outra_turma,
            disciplina,
            &atribuicoes
        ));
        assert!(professor_pode_lancar(
            "admin",
            professor_id,
            outra_turma,
            disciplina,
            &atribuicoes
        ));
        assert!(professor_pode_lancar(
            "secretaria",
            professor_id,
            outra_turma,
            disciplina,
            &atribuicoes
        ));
    }
}
