use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use super::matricula::validar_tipo_sanguineo;
use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_aluno_ownership, check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::secretaria::{Aluno, Prontuario, SalvarProntuarioDto},
};

pub async fn obter_prontuario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "nutricionista",
            "responsavel",
        ],
    )?;
    let tenant_id = active_tenant.0;

    check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let aluno = sqlx::query_as::<_, Aluno>("SELECT * FROM alunos WHERE id = $1 AND tenant_id = $2")
        .bind(aluno_id)
        .bind(tenant_id)
        .fetch_optional(&mut *db)
        .await?
        .ok_or(AppError::NotFound)?;

    let prontuario = sqlx::query_as::<_, Prontuario>(
        "SELECT * FROM prontuarios WHERE aluno_id = $1 AND tenant_id = $2",
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let prontuario_record = match prontuario {
        Some(p) => p,
        None => {
            // Cria um prontuário padrão se ainda não existir
            sqlx::query_as::<_, Prontuario>(
                r#"
                INSERT INTO prontuarios (tenant_id, aluno_id, tipo_sanguineo, alergias, restricoes_alimentares, medicamentos_continuos, cuidados_especiais, historico_observacoes)
                VALUES ($1, $2, 'Não informado', 'Nenhuma alergia informada.', 'Sem restrições alimentares.', 'Nenhum medicamento contínuo.', 'Sem recomendações especiais.', 'Aluno sem ocorrências disciplinares ativas.')
                ON CONFLICT (tenant_id, aluno_id) DO UPDATE SET updated_at = NOW()
                RETURNING *
                "#,
            )
            .bind(tenant_id)
            .bind(aluno_id)
            .fetch_one(&mut *db)
            .await?
        }
    };

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CONSULTAR_PRONTUARIO",
        "prontuarios",
        Some(aluno_id.to_string()),
        Some(json!({ "aluno_nome": aluno.nome })),
    )
    .await;

    Ok(Json(json!({
        "aluno": aluno,
        "prontuario": prontuario_record
    })))
}

pub async fn salvar_prontuario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
    Json(dto): Json<SalvarProntuarioDto>,
) -> Result<Json<Prontuario>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "nutricionista",
        ],
    )?;
    let tenant_id = active_tenant.0;

    // Verificar se aluno pertence ao tenant
    let existe_aluno = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM alunos WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if !existe_aluno {
        return Err(AppError::NotFound);
    }

    if let Some(ref ts) = dto.tipo_sanguineo {
        if !validar_tipo_sanguineo(ts) {
            return Err(AppError::BadRequest(
                "Tipo sanguíneo informado é inválido. Valores aceitos: A+, A-, B+, B-, AB+, AB-, O+, O- ou Não informado.".to_string(),
            ));
        }
    }

    let prontuario = sqlx::query_as::<_, Prontuario>(
        r#"
        INSERT INTO prontuarios (
            tenant_id, aluno_id, tipo_sanguineo, alergias, restricoes_alimentares,
            medicamentos_continuos, cuidados_especiais, historico_observacoes, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (tenant_id, aluno_id) DO UPDATE SET
            tipo_sanguineo = COALESCE(EXCLUDED.tipo_sanguineo, prontuarios.tipo_sanguineo),
            alergias = COALESCE(EXCLUDED.alergias, prontuarios.alergias),
            restricoes_alimentares = COALESCE(EXCLUDED.restricoes_alimentares, prontuarios.restricoes_alimentares),
            medicamentos_continuos = COALESCE(EXCLUDED.medicamentos_continuos, prontuarios.medicamentos_continuos),
            cuidados_especiais = COALESCE(EXCLUDED.cuidados_especiais, prontuarios.cuidados_especiais),
            historico_observacoes = COALESCE(EXCLUDED.historico_observacoes, prontuarios.historico_observacoes),
            updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .bind(&dto.tipo_sanguineo)
    .bind(&dto.alergias)
    .bind(&dto.restricoes_alimentares)
    .bind(&dto.medicamentos_continuos)
    .bind(&dto.cuidados_especiais)
    .bind(&dto.historico_observacoes)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_PRONTUARIO",
        "prontuarios",
        Some(aluno_id.to_string()),
        Some(json!({
            "tipo_sanguineo": prontuario.tipo_sanguineo,
            "alergias": prontuario.alergias,
            "restricoes_alimentares": prontuario.restricoes_alimentares
        })),
    )
    .await;

    Ok(Json(prontuario))
}
