use super::*;

pub fn gerar_hash_consentimento_lgpd(
    tenant_id: Uuid,
    aluno_id: Uuid,
    responsavel_user_id: Uuid,
    versao_termo: &str,
    timestamp_rfc3339: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!(
        "LGPD_ART14:{}:{}:{}:{}:{}",
        tenant_id, aluno_id, responsavel_user_id, versao_termo, timestamp_rfc3339
    ));
    format!("{:x}", hasher.finalize())
}

pub async fn registrar_consentimento_lgpd(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<RegistrarConsentimentoLgpdDto>,
) -> Result<Json<LgpdTermo>, AppError> {
    check_roles(
        &auth_user,
        &["responsavel", "admin", "gestor", "secretaria"],
    )?;
    let tenant_id = active_tenant.0;

    // Se a requisição for feita pelo perfil responsável, valida guarda do dependente
    if auth_user.role == "responsavel" {
        check_aluno_ownership(&mut *db, &auth_user, dto.aluno_id).await?;
    } else {
        // Valida se o aluno existe no tenant ativo
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
    }

    // Extração robusta do IP do subscritor para auditoria da ANPD
    let ip_subscritor = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()))
        .unwrap_or("127.0.0.1")
        .trim()
        .to_string();

    let agora_rfc3339 = chrono::Utc::now().to_rfc3339();
    let hash_termo = gerar_hash_consentimento_lgpd(
        tenant_id,
        dto.aluno_id,
        auth_user.id,
        &dto.versao_termo,
        &agora_rfc3339,
    );

    let termo = sqlx::query_as::<_, LgpdTermo>(
        r#"
        INSERT INTO lgpd_termos (
            tenant_id, aluno_id, responsavel_user_id, consentimento_responsavel, versao_termo, ip_subscritor, hash_termo, data_aceite
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(auth_user.id)
    .bind(dto.consentimento_responsavel)
    .bind(&dto.versao_termo)
    .bind(&ip_subscritor)
    .bind(&hash_termo)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "REGISTRAR_CONSENTIMENTO_LGPD",
        "lgpd_termos",
        Some(termo.id.to_string()),
        Some(json!({
            "aluno_id": dto.aluno_id,
            "versao_termo": dto.versao_termo,
            "ip_subscritor": ip_subscritor,
            "hash_termo": hash_termo,
            "consentimento_responsavel": dto.consentimento_responsavel
        })),
    )
    .await;

    Ok(Json(termo))
}

// ==========================================
// 4. CONTROLE PERIMETRAL NÃO-INVASIVO (RFID / QR CODE)
// ==========================================
