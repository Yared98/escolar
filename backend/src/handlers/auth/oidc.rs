use axum::{extract::State, Extension, Json};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::sessao::{eddsa_header, generate_jwt, ACCESS_TOKEN_SECONDS};
use crate::{
    config::AppState, db::TenantDb, error::AppError, middleware::auth::AuthUser,
    models::user::User, services::audit::log_audit,
};

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
