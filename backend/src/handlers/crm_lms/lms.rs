use axum::{
    extract::{Path, State},
    Extension, Json,
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
    models::crm_lms::{
        LmsConfig, LtiGradeSyncDto, LtiLaunchResponse, SaveLmsConfigDto, ScormTrackDto,
        ScormTrackingRecord,
    },
};

pub async fn salvar_lms_config(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<SaveLmsConfigDto>,
) -> Result<Json<LmsConfig>, AppError> {
    check_roles(&auth_user, &["admin", "gestor"])?;
    let tenant_id = active_tenant.0;

    let lms_type = dto.lms_type.to_lowercase();
    if !["moodle", "canvas", "google_classroom"].contains(&lms_type.as_str()) {
        return Err(AppError::BadRequest(
            "lms_type inválido. Tipos suportados: moodle, canvas, google_classroom".to_string(),
        ));
    }

    let lti_version = dto
        .lti_version
        .unwrap_or_else(|| "1.3 Advantage".to_string());

    let config = sqlx::query_as::<_, LmsConfig>(
        r#"
        INSERT INTO lms_configs (tenant_id, lms_type, client_id, platform_url, lti_version)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, lms_type) DO UPDATE
        SET client_id = EXCLUDED.client_id,
            platform_url = EXCLUDED.platform_url,
            lti_version = EXCLUDED.lti_version
        RETURNING id, tenant_id, lms_type, client_id, platform_url, lti_version, created_at
        "#,
    )
    .bind(tenant_id)
    .bind(&lms_type)
    .bind(&dto.client_id)
    .bind(&dto.platform_url)
    .bind(&lti_version)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CONFIGURAR_LMS",
        "lms_configs",
        Some(config.id.to_string()),
        Some(json!({
            "lms_type": config.lms_type,
            "client_id": config.client_id,
            "platform_url": config.platform_url
        })),
    )
    .await;

    Ok(Json(config))
}

pub async fn obter_lms_config(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<LmsConfig>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    let configs = sqlx::query_as::<_, LmsConfig>(
        r#"
        SELECT id, tenant_id, lms_type, client_id, platform_url, lti_version, created_at
        FROM lms_configs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(configs))
}

pub async fn lti_launch(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<LtiLaunchResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor", "aluno"])?;
    let tenant_id = active_tenant.0;

    let maybe_config = sqlx::query_as::<_, LmsConfig>(
        r#"
        SELECT id, tenant_id, lms_type, client_id, platform_url, lti_version, created_at
        FROM lms_configs
        WHERE tenant_id = $1
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let (platform_url, client_id, lti_version) = match maybe_config {
        Some(cfg) => (cfg.platform_url, cfg.client_id, cfg.lti_version),
        None => (
            "https://moodle.escola.edu.br".to_string(),
            "escolar-erp-lti-client".to_string(),
            "1.3 Advantage".to_string(),
        ),
    };

    let state_token = format!(
        "lti_{}_{}_{}",
        tenant_id,
        auth_user.id,
        chrono::Utc::now().timestamp()
    );

    let launch_url = format!(
        "{}/auth/lti/launch.php?id={}&state={}",
        platform_url.trim_end_matches('/'),
        client_id,
        state_token
    );
    let jwt_target_link = format!("{}/mod/lti/view.php", platform_url.trim_end_matches('/'));

    Ok(Json(LtiLaunchResponse {
        status: "success".to_string(),
        lti_version,
        launch_url,
        jwt_target_link,
        user_id: auth_user.id,
        role: auth_user.role,
        state_token,
    }))
}

pub fn normalizar_nota_lti(raw: f64) -> f64 {
    let nota = if raw > 10.0 && raw <= 100.0 {
        raw / 10.0
    } else {
        raw
    };
    (nota.clamp(0.0, 10.0) * 100.0).round() / 100.0
}

pub async fn lti_grade_sync(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<LtiGradeSyncDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    let nota_normalizada = normalizar_nota_lti(dto.nota);
    let periodo = dto.periodo.unwrap_or_else(|| "1_bimestre".to_string());

    let existing_nota_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id FROM notas
        WHERE tenant_id = $1 AND aluno_id = $2 AND disciplina_nome = $3 AND periodo = $4
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.disciplina_nome)
    .bind(&periodo)
    .fetch_optional(&mut *db)
    .await?;

    let final_nota_id = match existing_nota_id {
        Some(id) => {
            sqlx::query(
                r#"
                UPDATE notas
                SET nota = $1, created_at = NOW()
                WHERE id = $2 AND tenant_id = $3
                "#,
            )
            .bind(nota_normalizada)
            .bind(id)
            .bind(tenant_id)
            .execute(&mut *db)
            .await?;
            id
        }
        None => {
            sqlx::query_scalar::<_, Uuid>(
                r#"
                INSERT INTO notas (tenant_id, aluno_id, disciplina_nome, nota, periodo)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
                "#,
            )
            .bind(tenant_id)
            .bind(dto.aluno_id)
            .bind(&dto.disciplina_nome)
            .bind(nota_normalizada)
            .bind(&periodo)
            .fetch_one(&mut *db)
            .await?
        }
    };

    sqlx::query(
        r#"
        INSERT INTO lms_grade_sync_logs (tenant_id, aluno_id, disciplina_nome, atividade_nome, nota, periodo, origem_lms)
        VALUES ($1, $2, $3, $4, $5, $6, 'lti_ags')
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.disciplina_nome)
    .bind(&dto.atividade_nome)
    .bind(nota_normalizada)
    .bind(&periodo)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "LMS_GRADE_SYNC",
        "notas",
        Some(final_nota_id.to_string()),
        Some(json!({
            "aluno_id": dto.aluno_id,
            "disciplina": dto.disciplina_nome,
            "atividade": dto.atividade_nome,
            "nota": nota_normalizada,
            "periodo": periodo
        })),
    )
    .await;

    Ok(Json(json!({
        "status": "success",
        "nota_id": final_nota_id,
        "aluno_id": dto.aluno_id,
        "disciplina_nome": dto.disciplina_nome,
        "atividade_nome": dto.atividade_nome,
        "nota_sincronizada": nota_normalizada,
        "periodo": periodo
    })))
}

pub fn validar_status_scorm(status: &str) -> bool {
    matches!(
        status.to_lowercase().as_str(),
        "passed" | "completed" | "failed" | "incomplete" | "browsed" | "not attempted"
    )
}

pub async fn scorm_track(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<ScormTrackDto>,
) -> Result<Json<ScormTrackingRecord>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor", "aluno"])?;
    let tenant_id = active_tenant.0;

    let normalized_status = dto.lesson_status.to_lowercase();
    if !validar_status_scorm(&normalized_status) {
        return Err(AppError::BadRequest(
            "Status SCORM inválido. Valores aceitos: passed, completed, failed, incomplete, browsed, not attempted".to_string(),
        ));
    }

    let record = sqlx::query_as::<_, ScormTrackingRecord>(
        r#"
        INSERT INTO scorm_tracking (
            tenant_id, aluno_id, package_id, lesson_status,
            score_raw, score_min, score_max, session_time, suspend_data, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (tenant_id, aluno_id, package_id) DO UPDATE
        SET lesson_status = EXCLUDED.lesson_status,
            score_raw = COALESCE(EXCLUDED.score_raw, scorm_tracking.score_raw),
            score_min = COALESCE(EXCLUDED.score_min, scorm_tracking.score_min),
            score_max = COALESCE(EXCLUDED.score_max, scorm_tracking.score_max),
            session_time = COALESCE(EXCLUDED.session_time, scorm_tracking.session_time),
            suspend_data = COALESCE(EXCLUDED.suspend_data, scorm_tracking.suspend_data),
            updated_at = NOW()
        RETURNING id, tenant_id, aluno_id, package_id, lesson_status, score_raw, score_min, score_max, session_time, suspend_data, updated_at
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.package_id)
    .bind(&normalized_status)
    .bind(dto.score_raw)
    .bind(dto.score_min.unwrap_or(0.0))
    .bind(dto.score_max.unwrap_or(100.0))
    .bind(&dto.session_time)
    .bind(&dto.suspend_data)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "SCORM_TRACK_UPDATE",
        "scorm_tracking",
        Some(record.id.to_string()),
        Some(json!({
            "aluno_id": record.aluno_id,
            "package_id": record.package_id,
            "status": record.lesson_status,
            "score": record.score_raw
        })),
    )
    .await;

    Ok(Json(record))
}

pub async fn obter_scorm_track(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path((package_id, aluno_id)): Path<(String, Uuid)>,
) -> Result<Json<ScormTrackingRecord>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "professor", "aluno", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let record = sqlx::query_as::<_, ScormTrackingRecord>(
        r#"
        SELECT id, tenant_id, aluno_id, package_id, lesson_status, score_raw, score_min, score_max, session_time, suspend_data, updated_at
        FROM scorm_tracking
        WHERE tenant_id = $1 AND package_id = $2 AND aluno_id = $3
        "#,
    )
    .bind(tenant_id)
    .bind(&package_id)
    .bind(aluno_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(record))
}
