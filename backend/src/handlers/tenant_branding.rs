use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{header, HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{auth::AuthUser, rbac::eh_gestao, tenant::ActiveTenant},
    services::audit::log_audit,
};

pub const DEFAULT_COR_PRIMARIA: &str = "#2d5338";
pub const DEFAULT_COR_DESTAQUE: &str = "#f59e0b";
pub const MAX_LOGO_BYTES: usize = 262144; // 256 KB

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantBrandingView {
    pub cor_primaria: String,
    pub cor_destaque: String,
    pub nome_exibicao: String,
    pub tem_logo: bool,
    pub logo_url: Option<String>,
    pub atualizado_em: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicBrandingView {
    pub cor_primaria: String,
    pub cor_destaque: String,
    pub nome_exibicao: String,
    pub logo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SalvarBrandingDto {
    pub cor_primaria: String,
    pub cor_destaque: String,
    pub nome_exibicao: Option<String>,
}

pub fn normalizar_hex(cor: &str, campo: &str) -> Result<String, AppError> {
    let cor = cor.trim();
    if cor.len() != 7
        || !cor.starts_with('#')
        || !cor[1..].chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err(AppError::BadRequest(format!(
            "{campo} deve estar no formato hexadecimal '#rrggbb' (ex: #2d5338)."
        )));
    }
    Ok(cor.to_lowercase())
}

pub fn detectar_formato_imagem(bytes: &[u8]) -> Result<&'static str, AppError> {
    const PNG_MAGIC: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const JPEG_MAGIC: &[u8] = &[0xFF, 0xD8, 0xFF];

    if bytes.starts_with(PNG_MAGIC) {
        return Ok("image/png");
    }
    if bytes.starts_with(JPEG_MAGIC) {
        return Ok("image/jpeg");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Ok("image/webp");
    }

    Err(AppError::BadRequest(
        "Formato de imagem não suportado. Apenas PNG, JPEG e WEBP são permitidos.".into(),
    ))
}

pub async fn carregar_tenant_branding(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
) -> Result<TenantBrandingView, AppError> {
    let tenant_name: String = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .unwrap_or_else(|_| "Escola".to_string());

    let row = sqlx::query_as::<_, (String, String, Option<String>, bool, DateTime<Utc>)>(
        r#"
        SELECT cor_primaria, cor_destaque, nome_exibicao, (logo IS NOT NULL), updated_at
        FROM tenant_branding
        WHERE tenant_id = $1
        "#,
    )
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?;

    Ok(match row {
        Some((cor_p, cor_d, nome_ex, tem_logo, updated_at)) => {
            let nome = nome_ex
                .filter(|s| !s.trim().is_empty())
                .unwrap_or(tenant_name);
            let logo_url = if tem_logo {
                Some(format!(
                    "/api/v1/tenant/branding/logo?v={}",
                    updated_at.timestamp()
                ))
            } else {
                None
            };
            TenantBrandingView {
                cor_primaria: cor_p.trim().to_string(),
                cor_destaque: cor_d.trim().to_string(),
                nome_exibicao: nome,
                tem_logo,
                logo_url,
                atualizado_em: Some(updated_at),
            }
        }
        None => TenantBrandingView {
            cor_primaria: DEFAULT_COR_PRIMARIA.to_string(),
            cor_destaque: DEFAULT_COR_DESTAQUE.to_string(),
            nome_exibicao: tenant_name,
            tem_logo: false,
            logo_url: None,
            atualizado_em: None,
        },
    })
}

/// 1. GET /tenant/branding (qualquer perfil)
pub async fn obter_branding(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
) -> Result<Json<TenantBrandingView>, AppError> {
    let tenant_id = active_tenant.0;
    let view = carregar_tenant_branding(&mut db, tenant_id).await?;
    Ok(Json(view))
}

/// 2. PUT /tenant/branding (só gestão)
pub async fn salvar_branding(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<SalvarBrandingDto>,
) -> Result<Json<TenantBrandingView>, AppError> {
    if !eh_gestao(&auth_user.role) {
        return Err(AppError::Forbidden(
            "Acesso negado: apenas a gestão pode alterar a identidade visual da escola.".into(),
        ));
    }

    let tenant_id = active_tenant.0;
    let cor_primaria = normalizar_hex(&dto.cor_primaria, "Cor primária")?;
    let cor_destaque = normalizar_hex(&dto.cor_destaque, "Cor de destaque")?;

    let nome_exibicao = match dto.nome_exibicao {
        Some(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else if trimmed.chars().count() > 120 {
                return Err(AppError::BadRequest(
                    "Nome de exibição deve ter no máximo 120 caracteres.".into(),
                ));
            } else {
                Some(trimmed.to_string())
            }
        }
        None => None,
    };

    sqlx::query(
        r#"
        INSERT INTO tenant_branding (
            tenant_id, cor_primaria, cor_destaque, nome_exibicao, updated_at, updated_by
        )
        VALUES ($1, $2, $3, $4, NOW(), $5)
        ON CONFLICT (tenant_id) DO UPDATE SET
            cor_primaria = EXCLUDED.cor_primaria,
            cor_destaque = EXCLUDED.cor_destaque,
            nome_exibicao = EXCLUDED.nome_exibicao,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
        "#,
    )
    .bind(tenant_id)
    .bind(&cor_primaria)
    .bind(&cor_destaque)
    .bind(&nome_exibicao)
    .bind(auth_user.id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "tenant_branding.atualizar",
        "tenant_branding",
        Some(tenant_id.to_string()),
        Some(json!({
            "cor_primaria": cor_primaria,
            "cor_destaque": cor_destaque,
            "nome_exibicao": nome_exibicao,
        })),
    )
    .await;

    let view = carregar_tenant_branding(&mut db, tenant_id).await?;
    Ok(Json(view))
}

/// 3. PUT /tenant/branding/logo (só gestão)
pub async fn salvar_logo(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    body: Bytes,
) -> Result<Json<TenantBrandingView>, AppError> {
    if !eh_gestao(&auth_user.role) {
        return Err(AppError::Forbidden(
            "Acesso negado: apenas a gestão pode alterar a identidade visual da escola.".into(),
        ));
    }

    if body.is_empty() {
        return Err(AppError::BadRequest("O arquivo de logo não pode ser vazio.".into()));
    }

    if body.len() > MAX_LOGO_BYTES {
        return Err(AppError::BadRequest(
            "O arquivo de logo deve ter no máximo 256 KB (262.144 bytes).".into(),
        ));
    }

    let mime = detectar_formato_imagem(&body)?;
    let tenant_id = active_tenant.0;

    sqlx::query(
        r#"
        INSERT INTO tenant_branding (
            tenant_id, logo, logo_mime, updated_at, updated_by
        )
        VALUES ($1, $2, $3, NOW(), $4)
        ON CONFLICT (tenant_id) DO UPDATE SET
            logo = EXCLUDED.logo,
            logo_mime = EXCLUDED.logo_mime,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
        "#,
    )
    .bind(tenant_id)
    .bind(body.as_ref())
    .bind(mime)
    .bind(auth_user.id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "tenant_branding.logo_atualizar",
        "tenant_branding",
        Some(tenant_id.to_string()),
        Some(json!({
            "logo_mime": mime,
            "tamanho_bytes": body.len(),
        })),
    )
    .await;

    let view = carregar_tenant_branding(&mut db, tenant_id).await?;
    Ok(Json(view))
}

/// 4. DELETE /tenant/branding/logo (só gestão)
pub async fn remover_logo(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<TenantBrandingView>, AppError> {
    if !eh_gestao(&auth_user.role) {
        return Err(AppError::Forbidden(
            "Acesso negado: apenas a gestão pode remover o logo da escola.".into(),
        ));
    }

    let tenant_id = active_tenant.0;

    sqlx::query(
        r#"
        UPDATE tenant_branding
        SET logo = NULL, logo_mime = NULL, updated_at = NOW(), updated_by = $2
        WHERE tenant_id = $1
        "#,
    )
    .bind(tenant_id)
    .bind(auth_user.id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "tenant_branding.logo_remover",
        "tenant_branding",
        Some(tenant_id.to_string()),
        None,
    )
    .await;

    let view = carregar_tenant_branding(&mut db, tenant_id).await?;
    Ok(Json(view))
}

/// 5. GET /tenant/branding/logo (qualquer perfil)
pub async fn obter_logo(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
) -> Result<Response, AppError> {
    let tenant_id = active_tenant.0;
    let row = sqlx::query_as::<_, (Vec<u8>, String)>(
        r#"
        SELECT logo, logo_mime
        FROM tenant_branding
        WHERE tenant_id = $1 AND logo IS NOT NULL AND logo_mime IS NOT NULL
        "#,
    )
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let (bytes, mime) = row.ok_or(AppError::NotFound)?;

    let mime_header = HeaderValue::from_str(&mime)
        .map_err(|e| AppError::InternalServerError(format!("Header inválido: {e}")))?;

    let mut response = (StatusCode::OK, bytes).into_response();
    let headers = response.headers_mut();
    headers.insert(header::CONTENT_TYPE, mime_header);
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=300"),
    );
    headers.insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );

    Ok(response)
}

/// 6. GET /public/branding/:slug (pública)
pub async fn obter_branding_publico(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<PublicBrandingView>, AppError> {
    let clean_slug = slug.trim().to_lowercase();
    let tenant = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id, name FROM tenants WHERE slug = $1 AND status = 'active'",
    )
    .bind(&clean_slug)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::TenantNotFound)?;

    let (tenant_id, tenant_name) = tenant;
    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    let row = sqlx::query_as::<_, (String, String, Option<String>, bool, DateTime<Utc>)>(
        r#"
        SELECT cor_primaria, cor_destaque, nome_exibicao, (logo IS NOT NULL), updated_at
        FROM tenant_branding
        WHERE tenant_id = $1
        "#,
    )
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let view = match row {
        Some((cor_p, cor_d, nome_ex, tem_logo, updated_at)) => {
            let nome = nome_ex
                .filter(|s| !s.trim().is_empty())
                .unwrap_or(tenant_name);
            let logo_url = if tem_logo {
                Some(format!(
                    "/api/v1/public/branding/{}/logo?v={}",
                    clean_slug,
                    updated_at.timestamp()
                ))
            } else {
                None
            };
            PublicBrandingView {
                cor_primaria: cor_p.trim().to_string(),
                cor_destaque: cor_d.trim().to_string(),
                nome_exibicao: nome,
                logo_url,
            }
        }
        None => PublicBrandingView {
            cor_primaria: DEFAULT_COR_PRIMARIA.to_string(),
            cor_destaque: DEFAULT_COR_DESTAQUE.to_string(),
            nome_exibicao: tenant_name,
            logo_url: None,
        },
    };

    Ok(Json(view))
}

/// 7. GET /public/branding/:slug/logo (pública)
pub async fn obter_logo_publico(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Response, AppError> {
    let clean_slug = slug.trim().to_lowercase();
    let tenant_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM tenants WHERE slug = $1 AND status = 'active'",
    )
    .bind(&clean_slug)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::TenantNotFound)?;

    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    let row = sqlx::query_as::<_, (Vec<u8>, String)>(
        r#"
        SELECT logo, logo_mime
        FROM tenant_branding
        WHERE tenant_id = $1 AND logo IS NOT NULL AND logo_mime IS NOT NULL
        "#,
    )
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let (bytes, mime) = row.ok_or(AppError::NotFound)?;

    let mime_header = HeaderValue::from_str(&mime)
        .map_err(|e| AppError::InternalServerError(format!("Header inválido: {e}")))?;

    let mut response = (StatusCode::OK, bytes).into_response();
    let headers = response.headers_mut();
    headers.insert(header::CONTENT_TYPE, mime_header);
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=300"),
    );
    headers.insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );

    Ok(response)
}
