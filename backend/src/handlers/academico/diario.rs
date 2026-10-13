use axum::{
    extract::{Query, State},
    Extension, Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{json, Value};
use sqlx::Acquire;
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
    models::academico::{
        ConsultarDiarioQuery, DiarioClasse, DiarioDiaResponse, DiarioRecenteItem,
        DiariosRecentesQuery, PresencaDiaDto, SyncDiarioDto,
    },
};

pub async fn sincronizar_diario_pwa(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<SyncDiarioDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;
    let professor_id = auth_user.id;
    let observacao = dto.observacao.clone().unwrap_or_default();
    if observacao.chars().count() > 4000 {
        return Err(AppError::BadRequest(
            "A observação livre aceita no máximo 4000 caracteres.".to_string(),
        ));
    }

    // Professor só grava por disciplina se tiver atribuição; gestor/admin estão livres.
    if let Some(disciplina_id) = dto.disciplina_id {
        let role_norm = auth_user.role.to_lowercase().replace('_', "");
        if role_norm == "professor" {
            let atribuicoes = carregar_atribuicoes_professor(&mut db, professor_id).await?;
            if !professor_pode_lancar(
                &auth_user.role,
                professor_id,
                dto.turma_id,
                disciplina_id,
                &atribuicoes,
            ) {
                return Err(AppError::Forbidden(
                    "Você não está atribuído a esta turma e disciplina.".to_string(),
                ));
            }
        }
    }

    let mut tx = (&mut *db).begin().await?;

    let diario_existente: Option<DiarioClasse> = match dto.disciplina_id {
        Some(disciplina_id) => {
            sqlx::query_as(
                "SELECT * FROM diarios_classe WHERE tenant_id = $1 AND turma_id = $2 AND data_aula = $3 AND disciplina_id = $4",
            )
            .bind(tenant_id)
            .bind(dto.turma_id)
            .bind(dto.data_aula)
            .bind(disciplina_id)
            .fetch_optional(&mut *tx)
            .await?
        }
        None => {
            sqlx::query_as(
                "SELECT * FROM diarios_classe WHERE tenant_id = $1 AND turma_id = $2 AND data_aula = $3 AND disciplina_id IS NULL",
            )
            .bind(tenant_id)
            .bind(dto.turma_id)
            .bind(dto.data_aula)
            .fetch_optional(&mut *tx)
            .await?
        }
    };

    let diario = match diario_existente {
        Some(d) => {
            sqlx::query(
                "UPDATE diarios_classe SET conteudo_ministrado = $1, observacao = $2, disciplina_id = $3, horario_id = $4 WHERE id = $5 AND tenant_id = $6",
            )
            .bind(&dto.conteudo_ministrado)
            .bind(&observacao)
            .bind(dto.disciplina_id)
            .bind(dto.horario_id)
            .bind(d.id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
            d
        }
        None => {
            sqlx::query_as::<_, DiarioClasse>(
                r#"
                INSERT INTO diarios_classe (tenant_id, turma_id, professor_id, disciplina_id, horario_id, data_aula, conteudo_ministrado, observacao)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
                "#,
            )
            .bind(tenant_id)
            .bind(dto.turma_id)
            .bind(professor_id)
            .bind(dto.disciplina_id)
            .bind(dto.horario_id)
            .bind(dto.data_aula)
            .bind(&dto.conteudo_ministrado)
            .bind(&observacao)
            .fetch_one(&mut *tx)
            .await?
        }
    };

    let mut total_presencas_salvas = 0;
    for item in dto.presencas {
        let presenca_existente: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM presencas WHERE tenant_id = $1 AND diario_id = $2 AND aluno_id = $3",
        )
        .bind(tenant_id)
        .bind(diario.id)
        .bind(item.aluno_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some((pid,)) = presenca_existente {
            sqlx::query(
                "UPDATE presencas SET presente = $1, justificativa = $2 WHERE id = $3 AND tenant_id = $4",
            )
            .bind(item.presente)
            .bind(&item.justificativa)
            .bind(pid)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                r#"
                INSERT INTO presencas (tenant_id, diario_id, aluno_id, presente, justificativa)
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(tenant_id)
            .bind(diario.id)
            .bind(item.aluno_id)
            .bind(item.presente)
            .bind(&item.justificativa)
            .execute(&mut *tx)
            .await?;
        }
        total_presencas_salvas += 1;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "SINCRONIZAR_DIARIO_PWA",
        "diarios_classe",
        Some(diario.id.to_string()),
        Some(json!({
            "turma_id": dto.turma_id,
            "data_aula": dto.data_aula,
            "disciplina_id": dto.disciplina_id,
            "horario_id": dto.horario_id,
            "total_presencas": total_presencas_salvas
        })),
    )
    .await;

    Ok(Json(json!({
        "diario_id": diario.id,
        "total_presencas_salvas": total_presencas_salvas,
        "status": "sincronizado_com_sucesso"
    })))
}

pub async fn consultar_diario_dia(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<ConsultarDiarioQuery>,
) -> Result<Json<DiarioDiaResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    type DiarioComHorario = (
        Uuid,           // d.id
        Uuid,           // d.tenant_id
        Uuid,           // d.turma_id
        Uuid,           // d.professor_id
        Option<Uuid>,   // d.disciplina_id
        Option<Uuid>,   // d.horario_id
        NaiveDate,      // d.data_aula
        String,         // d.conteudo_ministrado
        String,         // d.observacao
        DateTime<Utc>,  // d.created_at
        Option<String>, // h.hora_inicio
        Option<String>, // h.hora_fim
    );

    let diario = match query.disciplina_id {
        Some(disciplina_id) => {
            sqlx::query_as::<_, DiarioComHorario>(
                r#"
                SELECT d.id, d.tenant_id, d.turma_id, d.professor_id, d.disciplina_id, d.horario_id,
                       d.data_aula, d.conteudo_ministrado, d.observacao, d.created_at,
                       h.hora_inicio, h.hora_fim
                FROM diarios_classe d
                LEFT JOIN horarios_turma h ON h.id = d.horario_id AND h.tenant_id = d.tenant_id
                WHERE d.tenant_id = $1 AND d.turma_id = $2 AND d.data_aula = $3 AND d.disciplina_id = $4
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(query.data_aula)
            .bind(disciplina_id)
            .fetch_optional(&mut *db)
            .await?
        }
        None => {
            sqlx::query_as::<_, DiarioComHorario>(
                r#"
                SELECT d.id, d.tenant_id, d.turma_id, d.professor_id, d.disciplina_id, d.horario_id,
                       d.data_aula, d.conteudo_ministrado, d.observacao, d.created_at,
                       h.hora_inicio, h.hora_fim
                FROM diarios_classe d
                LEFT JOIN horarios_turma h ON h.id = d.horario_id AND h.tenant_id = d.tenant_id
                WHERE d.tenant_id = $1 AND d.turma_id = $2 AND d.data_aula = $3 AND d.disciplina_id IS NULL
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(query.data_aula)
            .fetch_optional(&mut *db)
            .await?
        }
    };

    match diario {
        Some(d) => {
            let presencas = sqlx::query_as::<_, PresencaDiaDto>(
                r#"
                SELECT aluno_id, presente, justificativa
                FROM presencas
                WHERE tenant_id = $1 AND diario_id = $2
                ORDER BY aluno_id
                "#,
            )
            .bind(tenant_id)
            .bind(d.0)
            .fetch_all(&mut *db)
            .await?;

            let disciplina_nome = match d.4 {
                Some(did) => {
                    sqlx::query_scalar::<_, String>(
                        "SELECT nome FROM disciplinas WHERE id = $1 AND tenant_id = $2",
                    )
                    .bind(did)
                    .bind(tenant_id)
                    .fetch_optional(&mut *db)
                    .await?
                }
                None => None,
            };

            Ok(Json(DiarioDiaResponse {
                encontrado: true,
                diario_id: Some(d.0),
                turma_id: d.2,
                disciplina_id: d.4,
                disciplina_nome,
                horario_id: d.5,
                hora_inicio: d.10,
                hora_fim: d.11,
                data_aula: d.6,
                conteudo_ministrado: d.7,
                observacao: d.8,
                presencas,
            }))
        }
        None => Ok(Json(DiarioDiaResponse {
            encontrado: false,
            diario_id: None,
            turma_id: query.turma_id,
            disciplina_id: query.disciplina_id,
            disciplina_nome: None,
            horario_id: None,
            hora_inicio: None,
            hora_fim: None,
            data_aula: query.data_aula,
            conteudo_ministrado: String::new(),
            observacao: String::new(),
            presencas: Vec::new(),
        })),
    }
}

pub async fn listar_diarios_recentes(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<DiariosRecentesQuery>,
) -> Result<Json<Vec<DiarioRecenteItem>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;
    let limit = query.limit.unwrap_or(10).clamp(1, 50);

    let itens = match query.disciplina_id {
        Some(disciplina_id) => {
            sqlx::query_as::<_, DiarioRecenteItem>(
                r#"
                SELECT
                    d.id AS diario_id,
                    d.data_aula,
                    d.disciplina_id,
                    disc.nome AS disciplina_nome,
                    d.conteudo_ministrado,
                    d.observacao,
                    COUNT(p.id)::BIGINT AS total_presencas,
                    COUNT(p.id) FILTER (WHERE p.presente = true)::BIGINT AS total_presentes
                FROM diarios_classe d
                LEFT JOIN presencas p ON p.diario_id = d.id AND p.tenant_id = d.tenant_id
                LEFT JOIN disciplinas disc ON disc.id = d.disciplina_id AND disc.tenant_id = d.tenant_id
                WHERE d.tenant_id = $1 AND d.turma_id = $2 AND d.disciplina_id = $3
                GROUP BY d.id, d.data_aula, d.disciplina_id, disc.nome, d.conteudo_ministrado, d.observacao
                ORDER BY d.data_aula DESC
                LIMIT $4
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(disciplina_id)
            .bind(limit)
            .fetch_all(&mut *db)
            .await?
        }
        None => {
            sqlx::query_as::<_, DiarioRecenteItem>(
                r#"
                SELECT
                    d.id AS diario_id,
                    d.data_aula,
                    d.disciplina_id,
                    disc.nome AS disciplina_nome,
                    d.conteudo_ministrado,
                    d.observacao,
                    COUNT(p.id)::BIGINT AS total_presencas,
                    COUNT(p.id) FILTER (WHERE p.presente = true)::BIGINT AS total_presentes
                FROM diarios_classe d
                LEFT JOIN presencas p ON p.diario_id = d.id AND p.tenant_id = d.tenant_id
                LEFT JOIN disciplinas disc ON disc.id = d.disciplina_id AND disc.tenant_id = d.tenant_id
                WHERE d.tenant_id = $1 AND d.turma_id = $2
                GROUP BY d.id, d.data_aula, d.disciplina_id, disc.nome, d.conteudo_ministrado, d.observacao
                ORDER BY d.data_aula DESC
                LIMIT $3
                "#,
            )
            .bind(tenant_id)
            .bind(query.turma_id)
            .bind(limit)
            .fetch_all(&mut *db)
            .await?
        }
    };

    Ok(Json(itens))
}

/// Retorna a cláusula WHERE usada para localizar o diário no upsert.
/// Com disciplina, a chave é turma + data + disciplina; sem disciplina, é turma + data.
pub fn chave_upsert_diario_por_disciplina(disciplina_id: Option<Uuid>) -> &'static str {
    match disciplina_id {
        Some(_) => "tenant_id = $1 AND turma_id = $2 AND data_aula = $3 AND disciplina_id = $4",
        None => "tenant_id = $1 AND turma_id = $2 AND data_aula = $3 AND disciplina_id IS NULL",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chave_upsert_diario_por_disciplina() {
        use uuid::Uuid;

        let com_disciplina = Some(Uuid::nil());
        let sem_disciplina: Option<Uuid> = None;

        // Com disciplina, a chave do upsert inclui disciplina_id.
        assert!(chave_upsert_diario_por_disciplina(com_disciplina).contains("disciplina_id = $4"));

        // Sem disciplina, a chave exige disciplina_id IS NULL (diário do dia inteiro).
        assert!(
            chave_upsert_diario_por_disciplina(sem_disciplina).contains("disciplina_id IS NULL")
        );
    }
}
