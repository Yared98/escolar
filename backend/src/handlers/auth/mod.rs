use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    http::{header, HeaderMap},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::auth::AuthUser,
    models::{
        tenant::Tenant,
        user::{User, UserResponseDto, UserRole},
    },
    services::audit::log_audit,
};

pub mod cookie;
pub mod oidc;
pub mod sessao;
pub use oidc::*;
pub use sessao::*;

pub const DUMMY_ARGON2_HASH: &str =
    "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

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
pub struct AlterarSenhaDto {
    pub senha_atual: String,
    pub nova_senha: String,
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
    headers: HeaderMap,
    Json(dto): Json<RegisterTenantDto>,
) -> Result<Response, AppError> {
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

    if cookie::modo_cookie(&headers)
        && !cookie::origem_permitida(&headers, &state.config.allowed_origins)
    {
        return Err(AppError::Forbidden("Origem não permitida.".into()));
    }
    cookie::resposta_sessao(
        AuthResponseDto {
            token,
            refresh_token,
            expires_in,
            tenant,
            user: user.into(),
        },
        cookie::modo_cookie(&headers),
        cookie::cookie_secure(&state.config.environment),
    )
}

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(dto): Json<LoginDto>,
) -> Result<Response, AppError> {
    if cookie::modo_cookie(&headers)
        && !cookie::origem_permitida(&headers, &state.config.allowed_origins)
    {
        return Err(AppError::Forbidden("Origem não permitida.".into()));
    }
    let clean_slug = dto.tenant_slug.trim().to_lowercase();
    let clean_email = dto.email.trim().to_lowercase();

    let tenant =
        sqlx::query_as::<_, Tenant>("SELECT * FROM tenants WHERE slug = $1 AND status = 'active'")
            .bind(&clean_slug)
            .fetch_optional(&state.pool)
            .await?
            .ok_or(AppError::TenantNotFound)?;

    let mut db = crate::db::acquire_tenant(&state.pool, tenant.id).await?;
    let client_ip =
        crate::middleware::security::extract_client_ip_from_req(&headers, None, &state.config);

    // 1. Checar tentativas de login com falha na janela de tempo
    let failed_attempts: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint FROM login_attempts
        WHERE tenant_id = $1
          AND email = $2
          AND success = false
          AND created_at > COALESCE(
              (SELECT MAX(created_at) FROM login_attempts WHERE tenant_id = $1 AND email = $2 AND success = true),
              '1970-01-01 00:00:00+00'::timestamptz
          )
          AND created_at > NOW() - ($3 || ' minutes')::INTERVAL
        "#,
    )
    .bind(tenant.id)
    .bind(&clean_email)
    .bind(state.config.account_lock_window_minutes)
    .fetch_one(&mut *db)
    .await?;

    if failed_attempts >= state.config.account_lock_max_attempts {
        log_audit(
            &mut *db,
            tenant.id,
            None,
            "LOGIN_BLOQUEADO",
            "users",
            None,
            Some(serde_json::json!({
                "email": clean_email,
                "ip": client_ip,
                "reason": "excesso_tentativas_invalidas"
            })),
        )
        .await;

        return Err(AppError::TooManyRequests(
            "Muitas tentativas incorretas. Conta bloqueada temporariamente. Tente novamente mais tarde.".to_string(),
        ));
    }

    // 2. Consultar usuário
    let user_opt =
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE tenant_id = $1 AND email = $2")
            .bind(tenant.id)
            .bind(&clean_email)
            .fetch_optional(&mut *db)
            .await?;

    let user = match user_opt {
        Some(u) => u,
        None => {
            sqlx::query(
                "INSERT INTO login_attempts (tenant_id, email, ip, success) VALUES ($1, $2, $3, false)",
            )
            .bind(tenant.id)
            .bind(&clean_email)
            .bind(&client_ip)
            .execute(&mut *db)
            .await?;

            if let Ok(parsed_dummy) = PasswordHash::new(DUMMY_ARGON2_HASH) {
                let _ = Argon2::default().verify_password(dto.password.as_bytes(), &parsed_dummy);
            }

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

    // 3. Verificar senha
    let parsed_hash = PasswordHash::new(&user.password_hash);
    let verify_res = match parsed_hash {
        Ok(hash) => Argon2::default().verify_password(dto.password.as_bytes(), &hash),
        Err(_) => Err(argon2::password_hash::Error::Password),
    };

    if verify_res.is_err() {
        sqlx::query(
            "INSERT INTO login_attempts (tenant_id, email, ip, success) VALUES ($1, $2, $3, false)",
        )
        .bind(tenant.id)
        .bind(&clean_email)
        .bind(&client_ip)
        .execute(&mut *db)
        .await?;

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

    if !user.ativo {
        log_audit(
            &mut *db,
            tenant.id,
            Some(user.id),
            "AUTH_LOGIN_FAILED",
            "users",
            Some(user.id.to_string()),
            Some(serde_json::json!({
                "email": user.email,
                "reason": "usuario_inativo"
            })),
        )
        .await;
        return Err(AppError::InvalidCredentials);
    }

    // 4. Sucesso: insere tentativa positiva e zera contador de falhas
    sqlx::query(
        "INSERT INTO login_attempts (tenant_id, email, ip, success) VALUES ($1, $2, $3, true)",
    )
    .bind(tenant.id)
    .bind(&clean_email)
    .bind(&client_ip)
    .execute(&mut *db)
    .await?;

    sqlx::query(
        "DELETE FROM login_attempts WHERE tenant_id = $1 AND email = $2 AND success = false",
    )
    .bind(tenant.id)
    .bind(&clean_email)
    .execute(&mut *db)
    .await?;

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

    cookie::resposta_sessao(
        AuthResponseDto {
            token,
            refresh_token,
            expires_in,
            tenant,
            user: user.into(),
        },
        cookie::modo_cookie(&headers),
        cookie::cookie_secure(&state.config.environment),
    )
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

pub async fn alterar_senha(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<AlterarSenhaDto>,
) -> Result<Json<serde_json::Value>, AppError> {
    use argon2::{
        password_hash::{PasswordHash, PasswordVerifier},
        Argon2,
    };

    if dto.nova_senha.len() < 8 {
        return Err(AppError::BadRequest(
            "A nova senha deve ter pelo menos 8 caracteres.".to_string(),
        ));
    }
    if dto.nova_senha == dto.senha_atual {
        return Err(AppError::BadRequest(
            "A nova senha deve ser diferente da senha atual.".to_string(),
        ));
    }

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 AND tenant_id = $2")
        .bind(auth_user.id)
        .bind(auth_user.tenant_id)
        .fetch_optional(&mut *db)
        .await?
        .ok_or(AppError::NotFound)?;

    let parsed_hash =
        PasswordHash::new(&user.password_hash).map_err(|_| AppError::InvalidCredentials)?;
    Argon2::default()
        .verify_password(dto.senha_atual.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::InvalidCredentials)?;

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let new_hash = argon2
        .hash_password(dto.nova_senha.as_bytes(), &salt)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?
        .to_string();

    sqlx::query(
        "UPDATE users SET password_hash = $1, deve_trocar_senha = false, updated_at = NOW() WHERE id = $2 AND tenant_id = $3"
    )
    .bind(&new_hash)
    .bind(auth_user.id)
    .bind(auth_user.tenant_id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        auth_user.tenant_id,
        Some(auth_user.id),
        "USUARIO_ALTERAR_SENHA",
        "users",
        Some(auth_user.id.to_string()),
        Some(serde_json::json!({
            "email": user.email,
            "perfil": user.role
        })),
    )
    .await;

    Ok(Json(serde_json::json!({
        "status": "sucesso",
        "mensagem": "Senha alterada com sucesso."
    })))
}

pub async fn logout(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    headers: HeaderMap,
    Extension(auth_user): Extension<AuthUser>,
    body: Option<Json<LogoutDto>>,
) -> Result<Response, AppError> {
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

    let mut resposta = Json(serde_json::json!({
        "status": "sucesso",
        "mensagem": "Sessão encerrada com sucesso e token revogado."
    }))
    .into_response();
    if cookie::modo_cookie(&headers) {
        resposta.headers_mut().append(
            header::SET_COOKIE,
            cookie::set_cookie_limpar(cookie::cookie_secure(&state.config.environment))?,
        );
    }
    Ok(resposta)
}

#[cfg(test)]
use crate::middleware::auth::Claims;
#[cfg(test)]
use jsonwebtoken::{encode, EncodingKey, Header};
#[cfg(test)]
use sha2::{Digest, Sha256};

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

    #[test]
    fn test_dummy_argon2_hash_validity() {
        let parsed = PasswordHash::new(DUMMY_ARGON2_HASH);
        assert!(
            parsed.is_ok(),
            "DUMMY_ARGON2_HASH deve ser aceito por PasswordHash::new"
        );
        let verify_res = Argon2::default().verify_password(b"any_password", &parsed.unwrap());
        assert!(verify_res.is_err());
    }
}
