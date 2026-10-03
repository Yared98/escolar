use argon2::{
    password_hash::{
        rand_core::OsRng, rand_core::RngCore, PasswordHash, PasswordHasher, PasswordVerifier,
        SaltString,
    },
    Argon2,
};
use axum::{extract::State, http::HeaderMap, Extension, Json};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::auth::{AuthUser, Claims},
    models::{
        tenant::Tenant,
        user::{User, UserResponseDto, UserRole},
    },
    services::audit::log_audit,
};

#[derive(Debug, Deserialize)]
pub struct RegisterTenantDto {
    pub school_name: String,
    pub school_slug: String,
    pub admin_name: String,
    pub admin_email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponseDto {
    pub token: String,
    pub refresh_token: String,
    pub expires_in: usize,
    pub tenant: Tenant,
    pub user: UserResponseDto,
}

#[derive(Debug, Deserialize)]
pub struct RefreshDto {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct LogoutDto {
    pub refresh_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginDto {
    pub tenant_slug: String,
    pub email: String,
    pub password: String,
}

pub fn is_valid_email(email: &str) -> bool {
    let parts: Vec<&str> = email.split('@').collect();
    if parts.len() != 2 {
        return false;
    }
    let (local, domain) = (parts[0], parts[1]);
    if local.is_empty() || local.len() > 64 || domain.is_empty() || domain.len() > 255 {
        return false;
    }
    if local.starts_with('.') || local.ends_with('.') || local.contains("..") {
        return false;
    }
    let domain_labels: Vec<&str> = domain.split('.').collect();
    if domain_labels.len() < 2 {
        return false;
    }
    for label in domain_labels {
        if label.is_empty() || label.len() > 63 || label.starts_with('-') || label.ends_with('-') {
            return false;
        }
        if !label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return false;
        }
    }
    local.chars().all(|c| {
        c.is_ascii_alphanumeric()
            || c == '.'
            || c == '!'
            || c == '#'
            || c == '$'
            || c == '%'
            || c == '&'
            || c == '\''
            || c == '*'
            || c == '+'
            || c == '/'
            || c == '='
            || c == '?'
            || c == '^'
            || c == '_'
            || c == '`'
            || c == '{'
            || c == '|'
            || c == '}'
            || c == '~'
            || c == '-'
    })
}

pub async fn register_tenant(
    State(state): State<AppState>,
    Json(dto): Json<RegisterTenantDto>,
) -> Result<Json<AuthResponseDto>, AppError> {
    let clean_slug = dto.school_slug.trim().to_lowercase();
    let clean_email = dto.admin_email.trim().to_lowercase();

    // Validações rigorosas de segurança (BLOCKER-03)
    if clean_slug.len() < 3
        || clean_slug.len() > 60
        || !clean_slug
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err(AppError::Forbidden(
            "Slug inválido: deve ter entre 3 e 60 caracteres alfanuméricos ou hífens".to_string(),
        ));
    }

    if !is_valid_email(&clean_email) {
        return Err(AppError::Forbidden(
            "Formato de e-mail inválido segundo RFC 5322.".to_string(),
        ));
    }

    if dto.password.len() < 8 {
        return Err(AppError::Forbidden(
            "Senha muito curta: a senha deve conter pelo menos 8 caracteres".to_string(),
        ));
    }

    if !dto.password.chars().any(|c| c.is_alphabetic())
        || !dto.password.chars().any(|c| c.is_numeric())
    {
        return Err(AppError::Forbidden(
            "A senha deve conter letras e números.".to_string(),
        ));
    }

    let mut tx = state.pool.begin().await?;

    // Prevenção atômica de TOCTOU / Race Condition (BLOCKER-04)
    let tenant_result = sqlx::query_as::<_, Tenant>(
        "INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING *",
    )
    .bind(dto.school_name.trim())
    .bind(&clean_slug)
    .fetch_one(&mut *tx)
    .await;

    let tenant = match tenant_result {
        Ok(t) => t,
        Err(sqlx::Error::Database(db_err))
            if db_err.is_unique_violation() || db_err.code().as_deref() == Some("23505") =>
        {
            return Err(AppError::UserAlreadyExists);
        }
        Err(e) => return Err(AppError::DatabaseError(e)),
    };

    sqlx::query("SELECT set_config('app.current_tenant', $1, false)")
        .bind(tenant.id.to_string())
        .execute(&mut *tx)
        .await?;

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(dto.password.as_bytes(), &salt)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?
        .to_string();

    let role = UserRole::Gestor.to_string();
    let user_result = sqlx::query_as::<_, User>(
        "INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(tenant.id)
    .bind(dto.admin_name.trim())
    .bind(&clean_email)
    .bind(&password_hash)
    .bind(&role)
    .fetch_one(&mut *tx)
    .await;

    let user = match user_result {
        Ok(u) => u,
        Err(sqlx::Error::Database(db_err))
            if db_err.is_unique_violation() || db_err.code().as_deref() == Some("23505") =>
        {
            return Err(AppError::UserAlreadyExists);
        }
        Err(e) => return Err(AppError::DatabaseError(e)),
    };

    tx.commit().await?;

    let mut db = crate::db::acquire_tenant(&state.pool, tenant.id).await?;

    // Registro indelével de auditoria
    log_audit(
        &mut *db,
        tenant.id,
        Some(user.id),
        "TENANT_REGISTER",
        "tenants",
        Some(tenant.id.to_string()),
        Some(serde_json::json!({
            "school_name": tenant.name,
            "school_slug": tenant.slug,
            "admin_email": user.email
        })),
    )
    .await;

    let (token, refresh_token, expires_in) = issue_session_conn(
        &mut db,
        user.id,
        tenant.id,
        &user.role,
        &state.config.jwt_private_pem,
    )
    .await?;

    Ok(Json(AuthResponseDto {
        token,
        refresh_token,
        expires_in,
        tenant,
        user: user.into(),
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(dto): Json<LoginDto>,
) -> Result<Json<AuthResponseDto>, AppError> {
    let clean_slug = dto.tenant_slug.trim().to_lowercase();
    let clean_email = dto.email.trim().to_lowercase();

    let tenant =
        sqlx::query_as::<_, Tenant>("SELECT * FROM tenants WHERE slug = $1 AND status = 'active'")
            .bind(&clean_slug)
            .fetch_optional(&state.pool)
            .await?
            .ok_or(AppError::TenantNotFound)?;

    let mut db = crate::db::acquire_tenant(&state.pool, tenant.id).await?;

    let user_opt =
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE tenant_id = $1 AND email = $2")
            .bind(tenant.id)
            .bind(&clean_email)
            .fetch_optional(&mut *db)
            .await?;

    let user = match user_opt {
        Some(u) => u,
        None => {
            // Auditoria contra ataques de força bruta / credential stuffing (NITPICK-01)
            log_audit(
                &mut *db,
                tenant.id,
                None,
                "AUTH_LOGIN_FAILED",
                "users",
                None,
                Some(serde_json::json!({
                    "email": clean_email,
                    "reason": "user_not_found"
                })),
            )
            .await;
            return Err(AppError::InvalidCredentials);
        }
    };

    let parsed_hash = PasswordHash::new(&user.password_hash);
    let verify_res = match parsed_hash {
        Ok(hash) => Argon2::default().verify_password(dto.password.as_bytes(), &hash),
        Err(_) => Err(argon2::password_hash::Error::Password),
    };

    if verify_res.is_err() {
        // Auditoria contra senha incorreta (NITPICK-01)
        log_audit(
            &mut *db,
            tenant.id,
            Some(user.id),
            "AUTH_LOGIN_FAILED",
            "users",
            Some(user.id.to_string()),
            Some(serde_json::json!({
                "email": user.email,
                "reason": "invalid_password"
            })),
        )
        .await;
        return Err(AppError::InvalidCredentials);
    }

    // Registro indelével de auditoria para login bem-sucedido
    log_audit(
        &mut *db,
        tenant.id,
        Some(user.id),
        "AUTH_LOGIN",
        "users",
        Some(user.id.to_string()),
        Some(serde_json::json!({
            "email": user.email,
            "role": user.role
        })),
    )
    .await;

    let (token, refresh_token, expires_in) = issue_session_conn(
        &mut db,
        user.id,
        tenant.id,
        &user.role,
        &state.config.jwt_private_pem,
    )
    .await?;

    Ok(Json(AuthResponseDto {
        token,
        refresh_token,
        expires_in,
        tenant,
        user: user.into(),
    }))
}

pub async fn me(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<UserResponseDto>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 AND tenant_id = $2")
        .bind(auth_user.id)
        .bind(auth_user.tenant_id)
        .fetch_optional(&mut *db)
        .await?
        .ok_or(AppError::NotFound)?;

    let flags = sqlx::query_scalar::<_, String>(
        "SELECT feature_name FROM tenant_feature_flags WHERE tenant_id = $1 AND is_enabled = true",
    )
    .bind(auth_user.tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let mut response: crate::models::user::UserResponseDto = user.into();
    response.features = flags;

    Ok(Json(response))
}

pub const ACCESS_TOKEN_SECONDS: usize = 15 * 60;

fn eddsa_header() -> Header {
    let mut header = Header::new(Algorithm::EdDSA);
    header.kid = Some("escolar-ed25519-2026".to_string());
    header
}

pub fn generate_jwt(
    user_id: Uuid,
    tenant_id: Uuid,
    role: &str,
    private_pem: &str,
) -> Result<String, AppError> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::minutes(15))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        tenant_id: tenant_id.to_string(),
        role: role.to_string(),
        exp: expiration,
    };

    encode(
        &eddsa_header(),
        &claims,
        &EncodingKey::from_ed_pem(private_pem.as_bytes())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?,
    )
    .map_err(|e| AppError::InternalServerError(e.to_string()))
}

pub fn verify_jwt(token: &str, public_pem: &str) -> Result<Claims, AppError> {
    let mut validation = jsonwebtoken::Validation::new(Algorithm::EdDSA);
    validation.validate_exp = true;
    let token_data = jsonwebtoken::decode::<Claims>(
        token,
        &jsonwebtoken::DecodingKey::from_ed_pem(public_pem.as_bytes())
            .map_err(|e| AppError::InvalidToken(e.to_string()))?,
        &validation,
    )
    .map_err(|e| AppError::InvalidToken(e.to_string()))?;

    Ok(token_data.claims)
}

pub fn sha256_hex(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn hash_refresh_token(token: &str) -> String {
    sha256_hex(token)
}

pub fn refresh_token_usable(
    revoked_at: Option<chrono::DateTime<Utc>>,
    expires_at: chrono::DateTime<Utc>,
    now: chrono::DateTime<Utc>,
) -> bool {
    revoked_at.is_none() && expires_at > now
}

fn new_refresh_token() -> (String, String) {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    let token = base64_url_encode(&bytes);
    let hash = hash_refresh_token(&token);
    (token, hash)
}

async fn store_refresh_token(
    executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
    token_hash: &str,
) -> Result<(), AppError> {
    let expires_at = Utc::now() + Duration::days(7);
    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(token_hash)
    .bind(expires_at)
    .execute(executor)
    .await?;
    Ok(())
}

pub async fn issue_session_conn(
    db: &mut sqlx::pool::PoolConnection<sqlx::Postgres>,
    user_id: Uuid,
    tenant_id: Uuid,
    role: &str,
    jwt_private_pem: &str,
) -> Result<(String, String, usize), AppError> {
    let token = generate_jwt(user_id, tenant_id, role, jwt_private_pem)?;
    let (refresh_token, refresh_hash) = new_refresh_token();
    store_refresh_token(&mut **db, tenant_id, user_id, &refresh_hash).await?;
    Ok((token, refresh_token, ACCESS_TOKEN_SECONDS))
}

#[allow(dead_code)]
async fn issue_session(
    state: &AppState,
    user_id: Uuid,
    tenant_id: Uuid,
    role: &str,
) -> Result<(String, String, usize), AppError> {
    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;
    issue_session_conn(
        &mut db,
        user_id,
        tenant_id,
        role,
        &state.config.jwt_private_pem,
    )
    .await
}

pub async fn refresh_session(
    State(state): State<AppState>,
    Json(dto): Json<RefreshDto>,
) -> Result<Json<serde_json::Value>, AppError> {
    let hash = hash_refresh_token(&dto.refresh_token);
    let row = sqlx::query_as::<_, (Uuid, Uuid, String, chrono::DateTime<Utc>, Option<chrono::DateTime<Utc>>)>(
        "SELECT user_id, tenant_id, role, expires_at, revoked_at FROM validar_refresh_token_publico($1)",
    )
    .bind(&hash)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::InvalidToken("Refresh token inválido".into()))?;

    let (user_id, tenant_id, role, expires_at, revoked_at) = row;
    if !refresh_token_usable(revoked_at, expires_at, Utc::now()) {
        return Err(AppError::InvalidToken(
            "Refresh token revogado ou expirado".into(),
        ));
    }

    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    sqlx::query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL",
    )
    .bind(&hash)
    .execute(&mut *db)
    .await?;

    let (token, refresh_token, expires_in) = issue_session_conn(
        &mut db,
        user_id,
        tenant_id,
        &role,
        &state.config.jwt_private_pem,
    )
    .await?;
    Ok(Json(serde_json::json!({
        "token": token,
        "refresh_token": refresh_token,
        "expires_in": expires_in,
        "token_type": "Bearer"
    })))
}

// ==========================================
// OAUTH 2.0 / OPENID CONNECT (OIDC) & SSO
// ==========================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenIdConfiguration {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub userinfo_endpoint: String,
    pub jwks_uri: String,
    pub response_types_supported: Vec<String>,
    pub subject_types_supported: Vec<String>,
    pub id_token_signing_alg_values_supported: Vec<String>,
    pub code_challenge_methods_supported: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwksKey {
    pub kty: String,
    pub kid: String,
    pub r#use: String,
    pub alg: String,
    pub crv: String,
    pub x: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwksResponse {
    pub keys: Vec<JwksKey>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OidcIdTokenClaims {
    pub iss: String,
    pub sub: String,
    pub aud: String,
    pub tenant_id: String,
    pub role: String,
    pub email: String,
    pub name: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Deserialize)]
pub struct OAuthAuthorizeDto {
    pub client_id: String,
    pub redirect_uri: String,
    pub code_challenge: String,
    pub code_challenge_method: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OAuthAuthorizeResponse {
    pub code: String,
    pub state: Option<String>,
    pub redirect_uri: String,
}

#[derive(Debug, Deserialize)]
pub struct OAuthTokenDto {
    pub grant_type: String,
    pub code: String,
    pub code_verifier: String,
    pub client_id: String,
}

#[derive(Debug, Serialize)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: usize,
    pub id_token: String,
    pub scope: String,
}

pub fn base64_url_encode(data: &[u8]) -> String {
    const URL_SAFE_CHARS: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(URL_SAFE_CHARS[(b0 >> 2) as usize] as char);
        result.push(URL_SAFE_CHARS[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            result.push(URL_SAFE_CHARS[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
        }
        if chunk.len() > 2 {
            result.push(URL_SAFE_CHARS[(b2 & 0x3F) as usize] as char);
        }
    }
    result
}

pub fn verify_pkce(code_verifier: &str, code_challenge: &str) -> bool {
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();
    let encoded = base64_url_encode(&hash);
    let hex_encoded = format!("{:x}", hash);
    encoded == code_challenge || hex_encoded == code_challenge
}

pub async fn openid_configuration() -> Json<OpenIdConfiguration> {
    Json(OpenIdConfiguration {
        issuer: "https://auth.escola.edu.br".to_string(),
        authorization_endpoint: "/api/v1/auth/oauth/authorize".to_string(),
        token_endpoint: "/api/v1/auth/oauth/token".to_string(),
        userinfo_endpoint: "/api/v1/auth/oauth/userinfo".to_string(),
        jwks_uri: "/api/v1/.well-known/jwks.json".to_string(),
        response_types_supported: vec!["code".to_string(), "id_token".to_string()],
        subject_types_supported: vec!["public".to_string()],
        id_token_signing_alg_values_supported: vec!["EdDSA".to_string()],
        code_challenge_methods_supported: vec!["S256".to_string()],
    })
}

pub async fn jwks(State(state): State<AppState>) -> Json<JwksResponse> {
    Json(JwksResponse {
        keys: vec![JwksKey {
            kty: "OKP".to_string(),
            kid: "escolar-ed25519-2026".to_string(),
            r#use: "sig".to_string(),
            alg: "EdDSA".to_string(),
            crv: "Ed25519".to_string(),
            x: state.config.jwt_public_x.clone(),
        }],
    })
}

pub async fn oauth_authorize(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<OAuthAuthorizeDto>,
) -> Result<Json<OAuthAuthorizeResponse>, AppError> {
    let code = format!("authcode_{}", Uuid::new_v4().to_string().replace('-', ""));
    let method = dto
        .code_challenge_method
        .unwrap_or_else(|| "S256".to_string());
    if method != "S256" {
        return Err(AppError::BadRequest("Apenas PKCE S256 é aceito.".into()));
    }
    let expires_at = Utc::now() + Duration::minutes(10);

    sqlx::query(
        r#"
        INSERT INTO oauth_authorization_codes (
            tenant_id, user_id, client_id, code, redirect_uri, code_challenge, code_challenge_method, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(auth_user.tenant_id)
    .bind(auth_user.id)
    .bind(&dto.client_id)
    .bind(&code)
    .bind(&dto.redirect_uri)
    .bind(&dto.code_challenge)
    .bind(&method)
    .bind(expires_at)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        auth_user.tenant_id,
        Some(auth_user.id),
        "OAUTH_AUTHORIZE_ISSUED",
        "oauth_authorization_codes",
        Some(code.clone()),
        Some(serde_json::json!({
            "client_id": dto.client_id,
            "redirect_uri": dto.redirect_uri,
            "code_challenge_method": method
        })),
    )
    .await;

    let mut target_redirect = format!("{}?code={}", dto.redirect_uri, code);
    if let Some(st) = &dto.state {
        target_redirect.push_str(&format!("&state={}", st));
    }

    Ok(Json(OAuthAuthorizeResponse {
        code,
        state: dto.state,
        redirect_uri: target_redirect,
    }))
}

pub async fn oauth_token(
    State(state): State<AppState>,
    Json(dto): Json<OAuthTokenDto>,
) -> Result<Json<OAuthTokenResponse>, AppError> {
    if dto.grant_type != "authorization_code" {
        return Err(AppError::InvalidCredentials);
    }

    let code_record = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String, String, String, bool, chrono::DateTime<Utc>)>(
        "SELECT id, tenant_id, user_id, client_id, redirect_uri, code_challenge, used, expires_at FROM validar_oauth_code_publico($1, $2)",
    )
    .bind(&dto.code)
    .bind(&dto.client_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::InvalidCredentials)?;

    let (id, tenant_id, user_id, client_id, _, code_challenge, used, expires_at) = code_record;

    if used || expires_at < Utc::now() {
        return Err(AppError::InvalidCredentials);
    }

    if !verify_pkce(&dto.code_verifier, &code_challenge) {
        return Err(AppError::InvalidCredentials);
    }

    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    sqlx::query("UPDATE oauth_authorization_codes SET used = true WHERE id = $1")
        .bind(id)
        .execute(&mut *db)
        .await?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 AND tenant_id = $2")
        .bind(user_id)
        .bind(tenant_id)
        .fetch_optional(&mut *db)
        .await?
        .ok_or(AppError::NotFound)?;

    let now = Utc::now();
    let exp = (now + Duration::minutes(15)).timestamp() as usize;
    let iat = now.timestamp() as usize;

    let id_claims = OidcIdTokenClaims {
        iss: "https://auth.escola.edu.br".to_string(),
        sub: user.id.to_string(),
        aud: client_id.clone(),
        tenant_id: tenant_id.to_string(),
        role: user.role.clone(),
        email: user.email.clone(),
        name: user.name.clone(),
        exp,
        iat,
    };

    let id_token = encode(
        &eddsa_header(),
        &id_claims,
        &EncodingKey::from_ed_pem(state.config.jwt_private_pem.as_bytes())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?,
    )
    .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let access_token = generate_jwt(
        user.id,
        tenant_id,
        &user.role,
        &state.config.jwt_private_pem,
    )?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(user.id),
        "OAUTH_TOKEN_EXCHANGED",
        "users",
        Some(user.id.to_string()),
        Some(serde_json::json!({
            "client_id": client_id,
            "email": user.email
        })),
    )
    .await;

    Ok(Json(OAuthTokenResponse {
        access_token,
        token_type: "Bearer".to_string(),
        expires_in: ACCESS_TOKEN_SECONDS,
        id_token,
        scope: "openid profile email".to_string(),
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    headers: HeaderMap,
    Extension(auth_user): Extension<AuthUser>,
    body: Option<Json<LogoutDto>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let auth_header = headers.get("Authorization").and_then(|v| v.to_str().ok());
    let token = match auth_header {
        Some(h) if h.starts_with("Bearer ") => &h[7..],
        _ => "",
    };

    let token_hash = if !token.is_empty() {
        crate::handlers::auth::sha256_hex(token)
    } else {
        Uuid::new_v4().to_string()
    };

    let expires_at = if !token.is_empty() {
        if let Ok(claims) = crate::handlers::auth::verify_jwt(token, &state.config.jwt_public_pem) {
            chrono::DateTime::from_timestamp(claims.exp as i64, 0)
                .unwrap_or_else(|| Utc::now() + Duration::days(7))
        } else {
            Utc::now() + Duration::days(7)
        }
    } else {
        Utc::now() + Duration::days(7)
    };

    sqlx::query(
        r#"
        INSERT INTO revoked_tokens (tenant_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (token_hash) DO NOTHING
        "#,
    )
    .bind(auth_user.tenant_id)
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&mut *db)
    .await?;

    // Opcional: remover registros expirados para a tabela não crescer sem limite
    let _ = sqlx::query("DELETE FROM revoked_tokens WHERE expires_at < NOW()")
        .execute(&mut *db)
        .await;

    if let Some(Json(payload)) = body {
        if let Some(refresh_token) = payload.refresh_token.filter(|token| !token.is_empty()) {
            let refresh_hash = hash_refresh_token(&refresh_token);
            sqlx::query(
                "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL",
            )
            .bind(&refresh_hash)
            .bind(auth_user.id)
            .execute(&mut *db)
            .await?;
        }
    }

    sqlx::query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL",
    )
    .bind(auth_user.id)
    .bind(auth_user.tenant_id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        auth_user.tenant_id,
        Some(auth_user.id),
        "AUTH_LOGOUT",
        "users",
        Some(auth_user.id.to_string()),
        Some(serde_json::json!({
            "user_id": auth_user.id,
            "revoked_token_hash": token_hash
        })),
    )
    .await;

    Ok(Json(serde_json::json!({
        "status": "sucesso",
        "mensagem": "Sessão encerrada com sucesso e token revogado."
    })))
}

pub async fn userinfo(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 AND tenant_id = $2")
        .bind(auth_user.id)
        .bind(auth_user.tenant_id)
        .fetch_optional(&mut *db)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(serde_json::json!({
        "sub": user.id.to_string(),
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id.to_string(),
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_argon2_hash_and_verify_success() {
        let password = "SuperSecretPassword2026!";
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .unwrap()
            .to_string();

        let parsed_hash = PasswordHash::new(&hash).unwrap();
        assert!(argon2
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok());
    }

    #[test]
    fn test_argon2_verify_wrong_password_fails() {
        let password = "CorrectPassword123";
        let wrong_password = "WrongPassword123";
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .unwrap()
            .to_string();

        let parsed_hash = PasswordHash::new(&hash).unwrap();
        assert!(argon2
            .verify_password(wrong_password.as_bytes(), &parsed_hash)
            .is_err());
    }

    fn dev_pems() -> (String, String) {
        let (private, public, _) = crate::config::development_signing_material();
        (private, public)
    }

    #[test]
    fn test_jwt_generation_and_verification() {
        let user_id = Uuid::new_v4();
        let tenant_id = Uuid::new_v4();
        let role = "gestor";
        let (private_pem, public_pem) = dev_pems();

        let token = generate_jwt(user_id, tenant_id, role, &private_pem)
            .expect("Token should be generated");
        assert!(!token.is_empty());

        let claims = verify_jwt(&token, &public_pem).expect("Token should be valid");
        assert_eq!(claims.sub, user_id.to_string());
        assert_eq!(claims.tenant_id, tenant_id.to_string());
        assert_eq!(claims.role, role);

        let now = Utc::now().timestamp() as usize;
        assert!(claims.exp > now);
        assert!(claims.exp <= now + ACCESS_TOKEN_SECONDS + 5);
    }

    #[test]
    fn test_jwt_verification_fails_with_wrong_secret() {
        let user_id = Uuid::new_v4();
        let tenant_id = Uuid::new_v4();
        let (private_pem, _) = dev_pems();
        let other = crate::config::material_from_seed(&[7u8; 32]).unwrap();
        let token = generate_jwt(user_id, tenant_id, "admin", &private_pem).unwrap();

        let result = verify_jwt(&token, &other.1);
        assert!(result.is_err());
    }

    #[test]
    fn test_hs256_token_is_rejected() {
        let (_, public_pem) = dev_pems();
        let claims = Claims {
            sub: Uuid::new_v4().to_string(),
            tenant_id: Uuid::new_v4().to_string(),
            role: "admin".to_string(),
            exp: (Utc::now() + Duration::minutes(15)).timestamp() as usize,
        };
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(b"secretsecretsecretsecretsecret12"),
        )
        .unwrap();
        assert!(verify_jwt(&token, &public_pem).is_err());
    }

    #[test]
    fn test_refresh_token_revoked_is_unusable() {
        let now = Utc::now();
        let expires_at = now + Duration::days(7);
        assert!(refresh_token_usable(None, expires_at, now));
        assert!(!refresh_token_usable(Some(now), expires_at, now));
        assert!(!refresh_token_usable(None, now - Duration::seconds(1), now));
    }

    #[test]
    fn test_is_valid_email_rfc5322() {
        assert!(is_valid_email("admin@alpha.edu.br"));
        assert!(is_valid_email("gestor@escola.com"));
        assert!(is_valid_email("user.name+tag@sub.domain.org"));

        assert!(!is_valid_email("plainaddress"));
        assert!(!is_valid_email("admin@"));
        assert!(!is_valid_email("@domain.com"));
        assert!(!is_valid_email("admin@domain"));
        assert!(!is_valid_email("admin@.com"));
        assert!(!is_valid_email("admin@domain..com"));
    }

    #[test]
    fn test_password_complexity_rules() {
        let valid_pw = "SenhaForte2026!";
        assert!(valid_pw.len() >= 8);
        assert!(valid_pw.chars().any(|c| c.is_alphabetic()));
        assert!(valid_pw.chars().any(|c| c.is_numeric()));

        let only_digits = "12345678";
        assert!(!only_digits.chars().any(|c| c.is_alphabetic()));

        let only_letters = "abcdefgh";
        assert!(!only_letters.chars().any(|c| c.is_numeric()));
    }

    #[test]
    fn test_base64_url_encode() {
        let data = b"Hello, World!";
        let encoded = base64_url_encode(data);
        assert!(!encoded.contains('+'));
        assert!(!encoded.contains('/'));
        assert!(!encoded.contains('='));
    }

    #[test]
    fn test_pkce_verification_valid_sha256() {
        let code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        let hash = hasher.finalize();
        let code_challenge = base64_url_encode(&hash);

        assert!(verify_pkce(code_verifier, &code_challenge));
    }

    #[test]
    fn test_pkce_verification_invalid_verifier_fails() {
        let code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let wrong_verifier = "wrong_code_verifier_1234567890_abcdefghij";
        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        let hash = hasher.finalize();
        let code_challenge = base64_url_encode(&hash);

        assert!(!verify_pkce(wrong_verifier, &code_challenge));
    }

    #[test]
    fn test_oidc_id_token_claims_encoding() {
        let claims = OidcIdTokenClaims {
            iss: "https://auth.escola.edu.br".to_string(),
            sub: Uuid::new_v4().to_string(),
            aud: "lms-moodle-client-id".to_string(),
            tenant_id: Uuid::new_v4().to_string(),
            role: "aluno".to_string(),
            email: "aluno@escola.edu.br".to_string(),
            name: "Aluno Teste OIDC".to_string(),
            exp: 1758800000,
            iat: 1758700000,
        };

        let (private_pem, _) = dev_pems();
        let token = encode(
            &eddsa_header(),
            &claims,
            &EncodingKey::from_ed_pem(private_pem.as_bytes()).unwrap(),
        )
        .unwrap();
        assert!(!token.is_empty());
        assert_eq!(token.split('.').count(), 3);
    }
}
