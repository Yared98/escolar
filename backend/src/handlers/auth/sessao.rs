use argon2::password_hash::rand_core::{OsRng, RngCore};
use axum::{extract::State, Json};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::oidc::base64_url_encode;
use super::RefreshDto;
use crate::{config::AppState, error::AppError, middleware::auth::Claims};

pub const ACCESS_TOKEN_SECONDS: usize = 15 * 60;

pub(super) fn eddsa_header() -> Header {
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
