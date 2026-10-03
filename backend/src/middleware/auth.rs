use axum::{extract::Request, middleware::Next, response::Response};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{config::Config, error::AppError};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,       // user_id
    pub tenant_id: String, // tenant_id
    pub role: String,      // user_role
    pub exp: usize,        // expiration timestamp
}

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub role: String,
}

pub async fn auth_middleware(mut req: Request, next: Next) -> Result<Response, AppError> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|val| val.to_str().ok())
        .map(|s| s.to_string());

    let query_token = req.uri().query().and_then(|q| {
        q.split('&').find_map(|pair| {
            let (key, val) = pair.split_once('=')?;
            if key == "access_token" || key == "token" {
                Some(val.to_string())
            } else {
                None
            }
        })
    });

    let token = match auth_header.as_deref() {
        Some(header) if header.starts_with("Bearer ") => header[7..].to_string(),
        _ => query_token.ok_or_else(|| {
            AppError::Unauthorized("Missing or invalid Authorization header".to_string())
        })?,
    };

    let config = req.extensions().get::<Config>().ok_or_else(|| {
        AppError::InternalServerError("Config missing from extensions".to_string())
    })?;

    let mut validation = Validation::new(jsonwebtoken::Algorithm::EdDSA);
    validation.validate_exp = true;
    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_ed_pem(config.jwt_public_pem.as_bytes())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?,
        &validation,
    )
    .map_err(|e| AppError::InvalidToken(e.to_string()))?;

    let user_id = Uuid::parse_str(&token_data.claims.sub)
        .map_err(|_| AppError::InvalidToken("Invalid user ID in token".to_string()))?;

    let tenant_id = Uuid::parse_str(&token_data.claims.tenant_id)
        .map_err(|_| AppError::InvalidToken("Invalid tenant ID in token".to_string()))?;

    let auth_user = AuthUser {
        id: user_id,
        tenant_id,
        role: token_data.claims.role,
    };

    req.extensions_mut().insert(auth_user);

    Ok(next.run(req).await)
}
