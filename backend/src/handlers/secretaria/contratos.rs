use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde_json::json;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_aluno_ownership, check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::secretaria::{
        AssinarContratoDto, Contrato, ContratoDetalhado, ContratoListItem, CreateContratoDto,
        ListContratosQuery,
    },
};

pub fn gerar_hash_contrato(
    tenant_id: &Uuid,
    contrato_id: &Uuid,
    aluno_id: &Uuid,
    ano_letivo: i32,
    valor_total: f64,
    assinado_em_iso: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!(
        "CONTRATO_EDUCACIONAL_MP2200:T:{}:C:{}:A:{}:ANO:{}:VALOR:{:.2}:TS:{}",
        tenant_id, contrato_id, aluno_id, ano_letivo, valor_total, assinado_em_iso
    ));
    format!("{:x}", hasher.finalize())
}

pub async fn criar_contrato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateContratoDto>,
) -> Result<Json<Contrato>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let aluno_existe = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM alunos WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if !aluno_existe {
        return Err(AppError::NotFound);
    }

    let contrato = sqlx::query_as::<_, Contrato>(
        r#"
        INSERT INTO contratos (tenant_id, aluno_id, ano_letivo, valor_total, status)
        VALUES ($1, $2, $3, $4, 'pendente_assinatura')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(dto.ano_letivo)
    .bind(dto.valor_total)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_CONTRATO",
        "contratos",
        Some(contrato.id.to_string()),
        Some(json!({
            "aluno_id": contrato.aluno_id,
            "ano_letivo": contrato.ano_letivo,
            "valor_total": contrato.valor_total
        })),
    )
    .await;

    Ok(Json(contrato))
}

pub async fn listar_contratos(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<ListContratosQuery>,
) -> Result<Json<Vec<ContratoListItem>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "financeiro", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    let is_responsavel = auth_user.role == "responsavel";

    let contratos = sqlx::query_as::<_, ContratoListItem>(
        r#"
        SELECT
            c.id,
            c.tenant_id,
            c.aluno_id,
            c.ano_letivo,
            c.valor_total,
            c.status,
            c.hash_documento,
            c.assinado_em,
            c.created_at,
            a.nome AS aluno_nome,
            a.cpf AS aluno_cpf,
            (SELECT COUNT(*) FROM faturas f WHERE f.contrato_id = c.id AND f.tenant_id = c.tenant_id) AS total_parcelas
        FROM contratos c
        JOIN alunos a ON a.id = c.aluno_id AND a.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1
          AND ($2::uuid IS NULL OR c.aluno_id = $2)
          AND (
            NOT $3 OR (
                a.responsavel_user_id = $4
                OR EXISTS (
                    SELECT 1 FROM responsaveis_alunos ra
                    WHERE ra.aluno_id = a.id AND ra.tenant_id = c.tenant_id AND ra.responsavel_user_id = $4
                )
            )
          )
        ORDER BY c.created_at DESC
        "#,
    )
    .bind(tenant_id)
    .bind(query.aluno_id)
    .bind(is_responsavel)
    .bind(auth_user.id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(contratos))
}

pub async fn obter_contrato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(contrato_id): Path<Uuid>,
) -> Result<Json<ContratoDetalhado>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "financeiro", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    let is_responsavel = auth_user.role == "responsavel";

    let contrato = sqlx::query_as::<_, ContratoListItem>(
        r#"
        SELECT
            c.id,
            c.tenant_id,
            c.aluno_id,
            c.ano_letivo,
            c.valor_total,
            c.status,
            c.hash_documento,
            c.assinado_em,
            c.created_at,
            a.nome AS aluno_nome,
            a.cpf AS aluno_cpf,
            (SELECT COUNT(*) FROM faturas f WHERE f.contrato_id = c.id AND f.tenant_id = c.tenant_id) AS total_parcelas
        FROM contratos c
        JOIN alunos a ON a.id = c.aluno_id AND a.tenant_id = c.tenant_id
        WHERE c.id = $1 AND c.tenant_id = $2
          AND (
            NOT $3 OR (
                a.responsavel_user_id = $4
                OR EXISTS (
                    SELECT 1 FROM responsaveis_alunos ra
                    WHERE ra.aluno_id = a.id AND ra.tenant_id = c.tenant_id AND ra.responsavel_user_id = $4
                )
            )
          )
        "#,
    )
    .bind(contrato_id)
    .bind(tenant_id)
    .bind(is_responsavel)
    .bind(auth_user.id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let parcelas = sqlx::query_as::<_, crate::models::financeiro::Fatura>(
        r#"
        SELECT * FROM faturas
        WHERE contrato_id = $1 AND tenant_id = $2
        ORDER BY parcela_numero ASC NULLS LAST, data_vencimento ASC
        "#,
    )
    .bind(contrato_id)
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(ContratoDetalhado { contrato, parcelas }))
}

pub async fn assinar_contrato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    headers: axum::http::HeaderMap,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(contrato_id): Path<Uuid>,
    Json(dto): Json<AssinarContratoDto>,
) -> Result<Json<Contrato>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    if !dto.aceite_termos {
        return Err(AppError::BadRequest(
            "O aceite formal dos termos é obrigatório para validação jurídica do contrato."
                .to_string(),
        ));
    }

    let contrato =
        sqlx::query_as::<_, Contrato>("SELECT * FROM contratos WHERE id = $1 AND tenant_id = $2")
            .bind(contrato_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    if contrato.status == "assinado" {
        return Err(AppError::BadRequest(
            "Contrato já se encontra assinado e homologado juridicamente.".to_string(),
        ));
    }
    if contrato.status == "cancelado" {
        return Err(AppError::BadRequest(
            "Não é permitido assinar um contrato cancelado.".to_string(),
        ));
    }

    if auth_user.role == "responsavel" {
        check_aluno_ownership(&mut *db, &auth_user, contrato.aluno_id).await?;
    }

    let ip_origem = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let now = chrono::Utc::now();
    let hash_doc = gerar_hash_contrato(
        &tenant_id,
        &contrato.id,
        &contrato.aluno_id,
        contrato.ano_letivo,
        contrato.valor_total,
        &now.to_rfc3339(),
    );

    let contrato_assinado = sqlx::query_as::<_, Contrato>(
        r#"
        UPDATE contratos
        SET
            status = 'assinado',
            hash_documento = $1,
            assinado_em = $2
        WHERE id = $3 AND tenant_id = $4
        RETURNING *
        "#,
    )
    .bind(&hash_doc)
    .bind(now)
    .bind(contrato_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    // Parcelamento automático da anuidade (12×), aplicando desconto de grupo familiar se houver.
    let desconto = sqlx::query_scalar::<_, f64>(
        r#"
        SELECT COALESCE(MAX(gf.desconto_percentual), 0)::FLOAT8
        FROM alunos a
        LEFT JOIN grupos_familiares gf ON gf.id = a.grupo_familiar_id
        WHERE a.id = $1 AND a.tenant_id = $2
        "#,
    )
    .bind(contrato.aluno_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await
    .unwrap_or(0.0);

    let parcelas_geradas = match crate::services::faturamento::gerar_parcelas_contrato(
        &mut db,
        tenant_id,
        contrato.aluno_id,
        contrato.id,
        contrato.ano_letivo,
        contrato.valor_total,
        12,
        "pix",
        10,
        desconto,
        2.0,
        1.0,
    )
    .await
    {
        Ok(faturas) => faturas.len(),
        Err(AppError::BadRequest(_)) => 0, // já havia parcelas
        Err(e) => return Err(e),
    };

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ASSINAR_CONTRATO",
        "contratos",
        Some(contrato.id.to_string()),
        Some(json!({
            "hash_documento": hash_doc,
            "assinado_em": now.to_rfc3339(),
            "aluno_id": contrato.aluno_id,
            "ip_origem": ip_origem,
            "parcelas_geradas": parcelas_geradas,
            "desconto_percentual": desconto
        })),
    )
    .await;

    Ok(Json(contrato_assinado))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gerar_hash_contrato_determinismo_e_integridade() {
        let tenant_id = Uuid::new_v4();
        let contrato_id = Uuid::new_v4();
        let aluno_id = Uuid::new_v4();
        let ts = "2026-09-25T12:00:00Z";

        let hash1 = gerar_hash_contrato(&tenant_id, &contrato_id, &aluno_id, 2026, 18000.0, ts);
        let hash2 = gerar_hash_contrato(&tenant_id, &contrato_id, &aluno_id, 2026, 18000.0, ts);
        assert_eq!(
            hash1, hash2,
            "Hashes de contrato com parâmetros idênticos devem ser estritamente iguais"
        );
        assert_eq!(
            hash1.len(),
            64,
            "Hash SHA-256 deve ter 64 caracteres hexadecimais"
        );

        let hash_adulterado =
            gerar_hash_contrato(&tenant_id, &contrato_id, &aluno_id, 2026, 18000.01, ts);
        assert_ne!(
            hash1, hash_adulterado,
            "Qualquer alteração de valor monetário deve alterar o hash"
        );
    }
}
