use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    handlers::professor::professor_pode_lancar,
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
pub struct AvaliacoesQuery {
    pub turma_id: Option<Uuid>,
    pub de: Option<NaiveDate>,
    pub ate: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct CriarAvaliacaoDto {
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub titulo: String,
    pub descricao: Option<String>,
    pub data: NaiveDate,
    pub tipo: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AvaliacaoListItem {
    pub id: Uuid,
    pub titulo: String,
    pub descricao: Option<String>,
    pub data: NaiveDate,
    pub tipo: String,
    pub turma_id: Uuid,
    pub turma_nome: String,
    pub disciplina_id: Option<Uuid>,
    pub disciplina_nome: Option<String>,
}

// ============================================================================
// FUNÇÕES PURAS DE VALIDAÇÃO (testáveis sem banco)
// ============================================================================

const TIPOS_AVALIACAO: &[&str] = &["prova", "trabalho", "atividade"];

pub fn validar_tipo_avaliacao(tipo: &str) -> Result<(), AppError> {
    if TIPOS_AVALIACAO.contains(&tipo) {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Tipo de avaliação inválido. Valores aceitos: {}.",
            TIPOS_AVALIACAO.join(", ")
        )))
    }
}

pub fn validar_titulo_avaliacao(titulo: &str) -> Result<(), AppError> {
    let trim = titulo.trim();
    if trim.len() < 3 {
        return Err(AppError::BadRequest(
            "O título deve ter pelo menos 3 caracteres.".into(),
        ));
    }
    if trim.len() > 120 {
        return Err(AppError::BadRequest(
            "O título deve ter no máximo 120 caracteres.".into(),
        ));
    }
    Ok(())
}

/// Retorna a data de hoje no fuso de Brasília (UTC-3) como NaiveDate.
fn hoje_brasilia() -> NaiveDate {
    match chrono::FixedOffset::west_opt(3 * 3600) {
        Some(offset) => chrono::Utc::now().with_timezone(&offset).date_naive(),
        None => chrono::Utc::now().date_naive(),
    }
}

pub fn validar_data_avaliacao(data: NaiveDate) -> Result<(), AppError> {
    if data < hoje_brasilia() {
        return Err(AppError::BadRequest(
            "A data da avaliação não pode estar no passado.".into(),
        ));
    }
    Ok(())
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

// ============================================================================
// HANDLERS
// ============================================================================

/// Lista avaliações (prova, trabalho, atividade) visíveis ao usuário.
pub async fn listar_avaliacoes(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<AvaliacoesQuery>,
) -> Result<Json<Vec<AvaliacaoListItem>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    let role_norm = auth_user.role.to_lowercase().replace('_', "");

    // SQLx exige bind posicional; usamos número fixo de parâmetros opcionais
    // com COALESCE para simplificar os filtros.
    let turma_filtro = query.turma_id;
    let de_filtro = query.de;
    let ate_filtro = query.ate;

    let rows = if role_norm == "responsavel" {
        sqlx::query_as::<_, AvaliacaoListItem>(
            r#"
            SELECT
                e.id,
                e.titulo,
                e.descricao,
                e.data_inicio AS data,
                e.tipo,
                e.turma_id,
                t.nome AS turma_nome,
                e.disciplina_id,
                d.nome AS disciplina_nome
            FROM eventos_calendario e
            JOIN turmas t ON t.id = e.turma_id AND t.tenant_id = e.tenant_id
            LEFT JOIN disciplinas d ON d.id = e.disciplina_id AND d.tenant_id = e.tenant_id
            WHERE e.tenant_id = $1
              AND e.tipo IN ('prova', 'trabalho', 'atividade')
              AND e.turma_id IN (
                  SELECT ta.turma_id
                  FROM turma_alunos ta
                  JOIN alunos a ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                  LEFT JOIN responsaveis_alunos ra
                    ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                  WHERE ta.tenant_id = $1
                    AND ta.status = 'ativo'
                    AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)
              )
              AND ($3::uuid IS NULL OR e.turma_id = $3)
              AND ($4::date IS NULL OR e.data_inicio >= $4)
              AND ($5::date IS NULL OR e.data_inicio <= $5)
            ORDER BY e.data_inicio ASC, e.titulo ASC
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .bind(turma_filtro)
        .bind(de_filtro)
        .bind(ate_filtro)
        .fetch_all(&mut *db)
        .await?
    } else if role_norm == "professor" {
        sqlx::query_as::<_, AvaliacaoListItem>(
            r#"
            SELECT
                e.id,
                e.titulo,
                e.descricao,
                e.data_inicio AS data,
                e.tipo,
                e.turma_id,
                t.nome AS turma_nome,
                e.disciplina_id,
                d.nome AS disciplina_nome
            FROM eventos_calendario e
            JOIN turmas t ON t.id = e.turma_id AND t.tenant_id = e.tenant_id
            LEFT JOIN disciplinas d ON d.id = e.disciplina_id AND d.tenant_id = e.tenant_id
            WHERE e.tenant_id = $1
              AND e.tipo IN ('prova', 'trabalho', 'atividade')
              AND e.turma_id IN (
                  SELECT tp.turma_id
                  FROM turma_professores tp
                  WHERE tp.tenant_id = $1
                    AND tp.professor_id = $2
              )
              AND ($3::uuid IS NULL OR e.turma_id = $3)
              AND ($4::date IS NULL OR e.data_inicio >= $4)
              AND ($5::date IS NULL OR e.data_inicio <= $5)
            ORDER BY e.data_inicio ASC, e.titulo ASC
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .bind(turma_filtro)
        .bind(de_filtro)
        .bind(ate_filtro)
        .fetch_all(&mut *db)
        .await?
    } else {
        // admin, gestor, secretaria
        sqlx::query_as::<_, AvaliacaoListItem>(
            r#"
            SELECT
                e.id,
                e.titulo,
                e.descricao,
                e.data_inicio AS data,
                e.tipo,
                e.turma_id,
                t.nome AS turma_nome,
                e.disciplina_id,
                d.nome AS disciplina_nome
            FROM eventos_calendario e
            JOIN turmas t ON t.id = e.turma_id AND t.tenant_id = e.tenant_id
            LEFT JOIN disciplinas d ON d.id = e.disciplina_id AND d.tenant_id = e.tenant_id
            WHERE e.tenant_id = $1
              AND e.tipo IN ('prova', 'trabalho', 'atividade')
              AND ($2::uuid IS NULL OR e.turma_id = $2)
              AND ($3::date IS NULL OR e.data_inicio >= $3)
              AND ($4::date IS NULL OR e.data_inicio <= $4)
            ORDER BY e.data_inicio ASC, e.titulo ASC
            "#,
        )
        .bind(tenant_id)
        .bind(turma_filtro)
        .bind(de_filtro)
        .bind(ate_filtro)
        .fetch_all(&mut *db)
        .await?
    };

    Ok(Json(rows))
}

pub async fn criar_avaliacao(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CriarAvaliacaoDto>,
) -> Result<Json<AvaliacaoListItem>, AppError> {
    // Card C8: cria o professor com atribuição na turma+disciplina; gestor e admin livres.
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    validar_titulo_avaliacao(&dto.titulo)?;
    validar_tipo_avaliacao(&dto.tipo)?;
    validar_data_avaliacao(dto.data)?;

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
                "Você não está atribuído a esta turma e disciplina.".into(),
            ));
        }
    }

    // Garante que a turma e a disciplina existem no tenant (FK já filtra pelo RLS,
    // mas a mensagem de erro fica mais clara com uma verificação explícita).
    let turma_existe: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM turmas WHERE id = $1 AND tenant_id = $2 AND status = 'ativo')",
    )
    .bind(dto.turma_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;
    if !turma_existe {
        return Err(AppError::NotFound);
    }

    let disciplina_existe: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM disciplinas WHERE id = $1 AND tenant_id = $2 AND status = 'ativo')",
    )
    .bind(dto.disciplina_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;
    if !disciplina_existe {
        return Err(AppError::NotFound);
    }

    let avaliacao = sqlx::query_as::<_, AvaliacaoListItem>(
        r#"
        INSERT INTO eventos_calendario (
            tenant_id, turma_id, disciplina_id, titulo, descricao,
            data_inicio, data_fim, tipo, visibilidade, criado_por, exige_confirmacao
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 'todos', $8, false)
        RETURNING
            id,
            titulo,
            descricao,
            data_inicio AS data,
            tipo,
            turma_id,
            (SELECT nome FROM turmas WHERE id = $2 AND tenant_id = $1) AS turma_nome,
            disciplina_id,
            (SELECT nome FROM disciplinas WHERE id = $3 AND tenant_id = $1) AS disciplina_nome
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(dto.disciplina_id)
    .bind(dto.titulo.trim())
    .bind(dto.descricao)
    .bind(dto.data)
    .bind(&dto.tipo)
    .bind(auth_user.id)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_AVALIACAO",
        "eventos_calendario",
        Some(avaliacao.id.to_string()),
        Some(json!({
            "turma_id": dto.turma_id,
            "disciplina_id": dto.disciplina_id,
            "data": dto.data,
            "tipo": dto.tipo,
            "titulo": dto.titulo.trim()
        })),
    )
    .await;

    Ok(Json(avaliacao))
}

pub async fn deletar_avaliacao(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(avaliacao_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Card C8: remove quem criou; gestor e admin removem qualquer avaliação.
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    let evento =
        sqlx::query("SELECT criado_por FROM eventos_calendario WHERE id = $1 AND tenant_id = $2")
            .bind(avaliacao_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    let criado_por: Uuid = evento.get("criado_por");

    let pode_deletar =
        crate::middleware::rbac::eh_gestao(&auth_user.role) || criado_por == auth_user.id;

    if !pode_deletar {
        return Err(AppError::Forbidden(
            "Você só pode remover avaliações que você criou.".into(),
        ));
    }

    sqlx::query("DELETE FROM eventos_calendario WHERE id = $1 AND tenant_id = $2")
        .bind(avaliacao_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DELETAR_AVALIACAO",
        "eventos_calendario",
        Some(avaliacao_id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "status": "sucesso" })))
}

// ============================================================================
// TESTES UNITÁRIOS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validar_tipo_avaliacao_aceitos() {
        for t in TIPOS_AVALIACAO {
            assert!(validar_tipo_avaliacao(t).is_ok());
        }
    }

    #[test]
    fn test_validar_tipo_avaliacao_rejeitado() {
        assert!(validar_tipo_avaliacao("prova_bimestral").is_err());
        assert!(validar_tipo_avaliacao("").is_err());
        assert!(validar_tipo_avaliacao("feriado").is_err());
    }

    #[test]
    fn test_validar_titulo_avaliacao() {
        assert!(validar_titulo_avaliacao("Prova de Matemática").is_ok());
        assert!(validar_titulo_avaliacao("AB").is_err());
        assert!(validar_titulo_avaliacao(&"a".repeat(121)).is_err());
        assert!(validar_titulo_avaliacao(&"a".repeat(120)).is_ok());
        assert!(validar_titulo_avaliacao("  Título válido  ").is_ok());
    }

    #[test]
    fn test_validar_data_avaliacao_nao_passado() {
        let hoje = hoje_brasilia();
        assert!(validar_data_avaliacao(hoje).is_ok());
        assert!(validar_data_avaliacao(hoje + chrono::Duration::days(1)).is_ok());
        assert!(validar_data_avaliacao(hoje - chrono::Duration::days(1)).is_err());
    }
}
