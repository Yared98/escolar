use std::collections::HashMap;

use axum::{
    extract::{Query, State},
    Extension, Json,
};
use chrono::{FixedOffset, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, eh_gestao, role_key},
        tenant::ActiveTenant,
    },
};

// ============================================================================
// DTOs de entrada e saída
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct RelatorioFrequenciaQuery {
    pub turma_id: Uuid,
    pub mes: String,
    pub disciplina_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlunoFrequenciaDto {
    pub aluno_id: Uuid,
    pub aluno_nome: String,
    pub numero_chamada: Option<i32>,
    pub aulas: i64,
    pub presencas: i64,
    pub faltas: i64,
    pub faltas_justificadas: i64,
    pub percentual: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TotalTurmaFrequenciaDto {
    pub total_aulas: i64,
    pub total_presencas: i64,
    pub total_faltas: i64,
    pub total_faltas_justificadas: i64,
    pub percentual_geral: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RelatorioFrequenciaResponseDto {
    pub turma_id: Uuid,
    pub turma_nome: String,
    pub mes: String,
    pub disciplina_id: Option<Uuid>,
    pub total_turma: TotalTurmaFrequenciaDto,
    pub alunos: Vec<AlunoFrequenciaDto>,
}

#[derive(Debug, Deserialize)]
pub struct AlertasFrequenciaQuery {
    pub ano_letivo: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TurmaAlertasFrequenciaDto {
    pub turma_id: Uuid,
    pub turma_nome: String,
    pub total_alunos_alerta: usize,
    pub alunos: Vec<AlunoFrequenciaDto>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlertasFrequenciaResponseDto {
    pub ano_letivo: i32,
    pub total_alertas: usize,
    pub turmas: Vec<TurmaAlertasFrequenciaDto>,
}

#[derive(Debug, Deserialize)]
pub struct FrequenciaHojeQuery {
    pub data: Option<NaiveDate>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TurmaChamadaHojeDto {
    pub turma_id: Uuid,
    pub turma_nome: String,
    pub presentes: i64,
    pub total: i64,
    pub percentual: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FrequenciaHojeResponseDto {
    pub data: NaiveDate,
    pub total_turmas_com_chamada: usize,
    pub total_presentes: i64,
    pub total_alunos: i64,
    pub percentual_geral: f64,
    pub turmas: Vec<TurmaChamadaHojeDto>,
}

// ============================================================================
// Funções puras (cálculo de percentual, limites e parsing)
// ============================================================================

/// Calcula o percentual de frequência baseado no total de aulas e presenças.
/// Retorna 100.0 caso não haja aulas registradas (para não penalizar aluno sem chamadas).
/// Arredonda para 1 casa decimal (ex.: 85.5).
pub fn calcular_percentual_frequencia(aulas: i64, presencas: i64) -> f64 {
    if aulas <= 0 {
        100.0
    } else {
        ((presencas as f64 / aulas as f64) * 1000.0).round() / 10.0
    }
}

/// Define se o percentual de frequência do aluno está em alerta pela LDB (< 75.0%).
pub fn is_alerta_abaixo_75(percentual: f64) -> bool {
    percentual < 75.0
}

/// Converte a string "YYYY-MM" para o primeiro e último dia do mês correspondente.
pub fn parse_ano_mes(mes_str: &str) -> Result<(NaiveDate, NaiveDate), AppError> {
    let partes: Vec<&str> = mes_str.trim().split('-').collect();
    if partes.len() != 2 {
        return Err(AppError::BadRequest(
            "Formato de mês inválido. Use YYYY-MM (ex: 2026-10).".to_string(),
        ));
    }

    let ano: i32 = partes[0]
        .parse()
        .map_err(|_| AppError::BadRequest("Ano inválido.".to_string()))?;
    let mes: u32 = partes[1]
        .parse()
        .map_err(|_| AppError::BadRequest("Mês inválido.".to_string()))?;

    if !(2000..=2100).contains(&ano) || !(1..=12).contains(&mes) {
        return Err(AppError::BadRequest(
            "Ano ou mês fora dos limites aceitos.".to_string(),
        ));
    }

    let primeiro_dia = NaiveDate::from_ymd_opt(ano, mes, 1)
        .ok_or_else(|| AppError::BadRequest("Data inicial do mês inválida.".to_string()))?;

    let proximo_mes_primeiro_dia = if mes == 12 {
        NaiveDate::from_ymd_opt(ano + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(ano, mes + 1, 1)
    }
    .ok_or_else(|| AppError::BadRequest("Falha ao calcular limites do mês.".to_string()))?;

    let ultimo_dia = proximo_mes_primeiro_dia
        .pred_opt()
        .ok_or_else(|| AppError::BadRequest("Falha ao calcular último dia do mês.".to_string()))?;

    Ok((primeiro_dia, ultimo_dia))
}

/// Retorna a data de hoje no fuso horário de Brasília (UTC-3).
pub fn hoje_brasilia() -> NaiveDate {
    match FixedOffset::west_opt(3 * 3600) {
        Some(offset) => Utc::now().with_timezone(&offset).date_naive(),
        None => Utc::now().date_naive(),
    }
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/academico/frequencia?turma_id=&mes=YYYY-MM[&disciplina_id=]
/// Relatório mensal de frequência por aluno e totalizador da turma.
pub async fn relatorio_frequencia(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<RelatorioFrequenciaQuery>,
) -> Result<Json<RelatorioFrequenciaResponseDto>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;
    let r_key = role_key(&auth_user.role);

    // Professor só acessa as turmas onde possui atribuição docente
    if r_key == "professor" {
        let atribuido: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM turma_professores
                WHERE tenant_id = $1 AND professor_id = $2 AND turma_id = $3
            )
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .bind(query.turma_id)
        .fetch_one(&mut *db)
        .await?;

        if !atribuido {
            return Err(AppError::Forbidden(
                "Você não leciona nesta turma.".to_string(),
            ));
        }
    }

    let (data_inicio, data_fim) = parse_ano_mes(&query.mes)?;

    // Verifica turma existente
    let turma_nome: String =
        sqlx::query_scalar("SELECT nome FROM turmas WHERE id = $1 AND tenant_id = $2")
            .bind(query.turma_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    // Contagem de diários distintos da turma no mês (com ou sem disciplina)
    let total_diarios_turma: i64 = match query.disciplina_id {
        Some(disc_id) => {
            sqlx::query_scalar(
                r#"
                SELECT COUNT(id) FROM diarios_classe
                WHERE tenant_id = $1 AND turma_id = $2 AND data_aula >= $3 AND data_aula <= $4 AND disciplina_id = $5
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(data_inicio)
            .bind(data_fim)
            .bind(disc_id)
            .fetch_one(&mut *db)
            .await?
        }
        None => {
            sqlx::query_scalar(
                r#"
                SELECT COUNT(id) FROM diarios_classe
                WHERE tenant_id = $1 AND turma_id = $2 AND data_aula >= $3 AND data_aula <= $4
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(data_inicio)
            .bind(data_fim)
            .fetch_one(&mut *db)
            .await?
        }
    };

    // Roster canônico de alunos ativos na turma
    let alunos_rows = sqlx::query(
        r#"
        SELECT
            a.id AS aluno_id,
            a.nome AS aluno_nome,
            ta.numero_chamada
        FROM turma_alunos ta
        JOIN alunos a ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
        WHERE ta.tenant_id = $1
          AND ta.turma_id = $2
          AND ta.status = 'ativo'
          AND a.status = 'ativo'
        ORDER BY ta.numero_chamada ASC NULLS LAST, a.nome ASC
        "#,
    )
    .bind(tenant_id)
    .bind(query.turma_id)
    .fetch_all(&mut *db)
    .await?;

    // Agrupamento de presenças por aluno
    struct AlunoStats {
        total_chamadas: i64,
        presencas: i64,
        faltas: i64,
        faltas_justificadas: i64,
    }

    let stats_rows = match query.disciplina_id {
        Some(disc_id) => {
            sqlx::query(
                r#"
                SELECT
                    p.aluno_id,
                    COUNT(p.id) AS total_chamadas,
                    COUNT(p.id) FILTER (WHERE p.presente = true) AS presencas,
                    COUNT(p.id) FILTER (WHERE p.presente = false) AS faltas,
                    COUNT(p.id) FILTER (WHERE p.presente = false AND p.justificativa IS NOT NULL AND TRIM(p.justificativa) <> '') AS faltas_justificadas
                FROM presencas p
                JOIN diarios_classe d ON d.id = p.diario_id AND d.tenant_id = p.tenant_id
                WHERE p.tenant_id = $1
                  AND d.turma_id = $2
                  AND d.data_aula >= $3
                  AND d.data_aula <= $4
                  AND d.disciplina_id = $5
                GROUP BY p.aluno_id
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(data_inicio)
            .bind(data_fim)
            .bind(disc_id)
            .fetch_all(&mut *db)
            .await?
        }
        None => {
            sqlx::query(
                r#"
                SELECT
                    p.aluno_id,
                    COUNT(p.id) AS total_chamadas,
                    COUNT(p.id) FILTER (WHERE p.presente = true) AS presencas,
                    COUNT(p.id) FILTER (WHERE p.presente = false) AS faltas,
                    COUNT(p.id) FILTER (WHERE p.presente = false AND p.justificativa IS NOT NULL AND TRIM(p.justificativa) <> '') AS faltas_justificadas
                FROM presencas p
                JOIN diarios_classe d ON d.id = p.diario_id AND d.tenant_id = p.tenant_id
                WHERE p.tenant_id = $1
                  AND d.turma_id = $2
                  AND d.data_aula >= $3
                  AND d.data_aula <= $4
                GROUP BY p.aluno_id
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(data_inicio)
            .bind(data_fim)
            .fetch_all(&mut *db)
            .await?
        }
    };

    let mut stats_map: HashMap<Uuid, AlunoStats> = HashMap::new();
    for row in stats_rows {
        let aluno_id: Uuid = row.get("aluno_id");
        let total_chamadas: i64 = row.get("total_chamadas");
        let presencas: i64 = row.get("presencas");
        let faltas: i64 = row.get("faltas");
        let faltas_justificadas: i64 = row.get("faltas_justificadas");
        stats_map.insert(
            aluno_id,
            AlunoStats {
                total_chamadas,
                presencas,
                faltas,
                faltas_justificadas,
            },
        );
    }

    let mut alunos_dto = Vec::with_capacity(alunos_rows.len());
    let mut soma_presencas = 0i64;
    let mut soma_faltas = 0i64;
    let mut soma_justificadas = 0i64;

    for row in alunos_rows {
        let aluno_id: Uuid = row.get("aluno_id");
        let aluno_nome: String = row.get("aluno_nome");
        let numero_chamada: Option<i32> = row.get("numero_chamada");

        let (aulas, presencas, faltas, faltas_justificadas) = match stats_map.get(&aluno_id) {
            Some(st) => (
                st.total_chamadas,
                st.presencas,
                st.faltas,
                st.faltas_justificadas,
            ),
            None => (0, 0, 0, 0),
        };

        let percentual = calcular_percentual_frequencia(aulas, presencas);

        soma_presencas += presencas;
        soma_faltas += faltas;
        soma_justificadas += faltas_justificadas;

        alunos_dto.push(AlunoFrequenciaDto {
            aluno_id,
            aluno_nome,
            numero_chamada,
            aulas,
            presencas,
            faltas,
            faltas_justificadas,
            percentual,
        });
    }

    let total_presencas_e_faltas = soma_presencas + soma_faltas;
    let percentual_geral = calcular_percentual_frequencia(total_presencas_e_faltas, soma_presencas);

    let total_turma = TotalTurmaFrequenciaDto {
        total_aulas: total_diarios_turma,
        total_presencas: soma_presencas,
        total_faltas: soma_faltas,
        total_faltas_justificadas: soma_justificadas,
        percentual_geral,
    };

    Ok(Json(RelatorioFrequenciaResponseDto {
        turma_id: query.turma_id,
        turma_nome,
        mes: query.mes,
        disciplina_id: query.disciplina_id,
        total_turma,
        alunos: alunos_dto,
    }))
}

/// GET /api/v1/academico/frequencia/alertas
/// Alunos ativos com frequência < 75% no ano letivo corrente (por turma).
/// Gestão/secretaria vê todas as turmas; professor apenas as suas.
pub async fn alertas_frequencia(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<AlertasFrequenciaQuery>,
) -> Result<Json<AlertasFrequenciaResponseDto>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;
    let r_key = role_key(&auth_user.role);

    // Determina ano letivo
    let ano_letivo = match query.ano_letivo {
        Some(ano) => ano,
        None => {
            let ano_db: Option<i32> = sqlx::query_scalar(
                "SELECT COALESCE(MAX(ano_letivo), EXTRACT(YEAR FROM CURRENT_DATE)::INT) FROM turmas WHERE tenant_id = $1",
            )
            .bind(tenant_id)
            .fetch_one(&mut *db)
            .await?;
            ano_db.unwrap_or(2026)
        }
    };

    // Lista turmas acessíveis
    let turmas_rows = if eh_gestao(&auth_user.role) || r_key == "secretaria" {
        sqlx::query(
            "SELECT id, nome FROM turmas WHERE tenant_id = $1 AND ano_letivo = $2 ORDER BY nome ASC",
        )
        .bind(tenant_id)
        .bind(ano_letivo)
        .fetch_all(&mut *db)
        .await?
    } else if r_key == "professor" {
        sqlx::query(
            r#"
            SELECT DISTINCT t.id, t.nome
            FROM turmas t
            JOIN turma_professores tp ON tp.turma_id = t.id AND tp.tenant_id = t.tenant_id
            WHERE t.tenant_id = $1 AND t.ano_letivo = $2 AND tp.professor_id = $3
            ORDER BY t.nome ASC
            "#,
        )
        .bind(tenant_id)
        .bind(ano_letivo)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        return Err(AppError::Forbidden(
            "Perfil não autorizado a acessar alertas de frequência.".to_string(),
        ));
    };

    let mut turmas_alertas = Vec::new();
    let mut total_alertas = 0usize;

    for t_row in turmas_rows {
        let turma_id: Uuid = t_row.get("id");
        let turma_nome: String = t_row.get("nome");

        // Alunos ativos da turma
        let alunos_turma = sqlx::query(
            r#"
            SELECT
                a.id AS aluno_id,
                a.nome AS aluno_nome,
                ta.numero_chamada
            FROM turma_alunos ta
            JOIN alunos a ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
            WHERE ta.tenant_id = $1
              AND ta.turma_id = $2
              AND ta.status = 'ativo'
              AND a.status = 'ativo'
            ORDER BY ta.numero_chamada ASC NULLS LAST, a.nome ASC
            "#,
        )
        .bind(tenant_id)
        .bind(turma_id)
        .fetch_all(&mut *db)
        .await?;

        // Frequência acumulada do ano letivo por aluno nesta turma
        let stats_ano = sqlx::query(
            r#"
            SELECT
                p.aluno_id,
                COUNT(p.id) AS total_chamadas,
                COUNT(p.id) FILTER (WHERE p.presente = true) AS presencas,
                COUNT(p.id) FILTER (WHERE p.presente = false) AS faltas,
                COUNT(p.id) FILTER (WHERE p.presente = false AND p.justificativa IS NOT NULL AND TRIM(p.justificativa) <> '') AS faltas_justificadas
            FROM presencas p
            JOIN diarios_classe d ON d.id = p.diario_id AND d.tenant_id = p.tenant_id
            WHERE p.tenant_id = $1
              AND d.turma_id = $2
              AND EXTRACT(YEAR FROM d.data_aula)::INT = $3
            GROUP BY p.aluno_id
            "#,
        )
        .bind(tenant_id)
        .bind(turma_id)
        .bind(ano_letivo)
        .fetch_all(&mut *db)
        .await?;

        let mut stats_map: HashMap<Uuid, (i64, i64, i64, i64)> = HashMap::new();
        for s in stats_ano {
            let aid: Uuid = s.get("aluno_id");
            let total_c: i64 = s.get("total_chamadas");
            let pres: i64 = s.get("presencas");
            let flt: i64 = s.get("faltas");
            let flt_just: i64 = s.get("faltas_justificadas");
            stats_map.insert(aid, (total_c, pres, flt, flt_just));
        }

        let mut alunos_em_alerta = Vec::new();

        for a_row in alunos_turma {
            let aluno_id: Uuid = a_row.get("aluno_id");
            let aluno_nome: String = a_row.get("aluno_nome");
            let numero_chamada: Option<i32> = a_row.get("numero_chamada");

            if let Some(&(aulas, presencas, faltas, faltas_justificadas)) = stats_map.get(&aluno_id)
            {
                if aulas > 0 {
                    let percentual = calcular_percentual_frequencia(aulas, presencas);
                    if is_alerta_abaixo_75(percentual) {
                        alunos_em_alerta.push(AlunoFrequenciaDto {
                            aluno_id,
                            aluno_nome,
                            numero_chamada,
                            aulas,
                            presencas,
                            faltas,
                            faltas_justificadas,
                            percentual,
                        });
                    }
                }
            }
        }

        if !alunos_em_alerta.is_empty() {
            total_alertas += alunos_em_alerta.len();
            turmas_alertas.push(TurmaAlertasFrequenciaDto {
                turma_id,
                turma_nome,
                total_alunos_alerta: alunos_em_alerta.len(),
                alunos: alunos_em_alerta,
            });
        }
    }

    Ok(Json(AlertasFrequenciaResponseDto {
        ano_letivo,
        total_alertas,
        turmas: turmas_alertas,
    }))
}

/// GET /api/v1/academico/frequencia/hoje
/// Retorna o resumo das chamadas registradas na data (padrão: hoje em Brasília).
/// Restrito à gestão e secretaria.
pub async fn frequencia_hoje(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<FrequenciaHojeQuery>,
) -> Result<Json<FrequenciaHojeResponseDto>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;
    let data_ref = query.data.unwrap_or_else(hoje_brasilia);

    let rows = sqlx::query(
        r#"
        SELECT
            t.id AS turma_id,
            t.nome AS turma_nome,
            COUNT(p.id) FILTER (WHERE p.presente = true) AS presentes,
            COUNT(p.id) AS total
        FROM diarios_classe d
        JOIN turmas t ON t.id = d.turma_id AND t.tenant_id = d.tenant_id
        LEFT JOIN presencas p ON p.diario_id = d.id AND p.tenant_id = d.tenant_id
        WHERE d.tenant_id = $1
          AND d.data_aula = $2
        GROUP BY t.id, t.nome
        ORDER BY t.nome ASC
        "#,
    )
    .bind(tenant_id)
    .bind(data_ref)
    .fetch_all(&mut *db)
    .await?;

    let mut turmas_dto = Vec::with_capacity(rows.len());
    let mut soma_presentes = 0i64;
    let mut soma_total = 0i64;

    for row in rows {
        let turma_id: Uuid = row.get("turma_id");
        let turma_nome: String = row.get("turma_nome");
        let presentes: i64 = row.get("presentes");
        let total: i64 = row.get("total");
        let percentual = calcular_percentual_frequencia(total, presentes);

        soma_presentes += presentes;
        soma_total += total;

        turmas_dto.push(TurmaChamadaHojeDto {
            turma_id,
            turma_nome,
            presentes,
            total,
            percentual,
        });
    }

    let percentual_geral = if soma_total > 0 {
        calcular_percentual_frequencia(soma_total, soma_presentes)
    } else {
        0.0
    };

    Ok(Json(FrequenciaHojeResponseDto {
        data: data_ref,
        total_turmas_com_chamada: turmas_dto.len(),
        total_presentes: soma_presentes,
        total_alunos: soma_total,
        percentual_geral,
        turmas: turmas_dto,
    }))
}

// ============================================================================
// Testes unitários das funções puras
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calcular_percentual_frequencia() {
        // Zero aulas não penaliza
        assert_eq!(calcular_percentual_frequencia(0, 0), 100.0);
        assert_eq!(calcular_percentual_frequencia(-5, 0), 100.0);

        // 100% de frequência
        assert_eq!(calcular_percentual_frequencia(20, 20), 100.0);

        // 75.0% exato
        assert_eq!(calcular_percentual_frequencia(20, 15), 75.0);

        // Abaixo de 75%
        assert_eq!(calcular_percentual_frequencia(20, 14), 70.0);

        // Arredondamento com 1 casa
        assert_eq!(calcular_percentual_frequencia(3, 2), 66.7);
        assert_eq!(calcular_percentual_frequencia(3, 1), 33.3);
    }

    #[test]
    fn test_is_alerta_abaixo_75() {
        assert!(is_alerta_abaixo_75(74.9));
        assert!(is_alerta_abaixo_75(70.0));
        assert!(is_alerta_abaixo_75(0.0));

        assert!(!is_alerta_abaixo_75(75.0));
        assert!(!is_alerta_abaixo_75(75.1));
        assert!(!is_alerta_abaixo_75(100.0));
    }

    #[test]
    fn test_parse_ano_mes_valido() {
        let (inicio, fim) = parse_ano_mes("2026-10").unwrap();
        assert_eq!(inicio, NaiveDate::from_ymd_opt(2026, 10, 1).unwrap());
        assert_eq!(fim, NaiveDate::from_ymd_opt(2026, 10, 31).unwrap());

        let (inicio, fim) = parse_ano_mes("2026-02").unwrap();
        assert_eq!(inicio, NaiveDate::from_ymd_opt(2026, 2, 1).unwrap());
        assert_eq!(fim, NaiveDate::from_ymd_opt(2026, 2, 28).unwrap());

        let (inicio, fim) = parse_ano_mes("2024-02").unwrap(); // ano bissexto
        assert_eq!(inicio, NaiveDate::from_ymd_opt(2024, 2, 1).unwrap());
        assert_eq!(fim, NaiveDate::from_ymd_opt(2024, 2, 29).unwrap());

        let (inicio, fim) = parse_ano_mes("2026-12").unwrap();
        assert_eq!(inicio, NaiveDate::from_ymd_opt(2026, 12, 1).unwrap());
        assert_eq!(fim, NaiveDate::from_ymd_opt(2026, 12, 31).unwrap());
    }

    #[test]
    fn test_parse_ano_mes_invalido() {
        assert!(parse_ano_mes("").is_err());
        assert!(parse_ano_mes("2026").is_err());
        assert!(parse_ano_mes("2026-13").is_err());
        assert!(parse_ano_mes("2026-00").is_err());
        assert!(parse_ano_mes("abc-10").is_err());
        assert!(parse_ano_mes("1999-05").is_err());
    }
}
