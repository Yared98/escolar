use argon2::{
    password_hash::{rand_core::OsRng, rand_core::RngCore, PasswordHasher, SaltString},
    Argon2,
};
use axum::{extract::State, Extension, Json};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Acquire;
use uuid::Uuid;

use crate::{
    config::AppState,
    db::{acquire_tenant, TenantDb},
    error::AppError,
    middleware::{auth::AuthUser, rbac::check_roles},
    models::{tenant::Tenant, user::User},
    services::{
        audit::log_audit,
        email::{
            listar_emails_saida, EmailAdapter, EmailMode as AdapterEmailMode, EmailOutboxRecord,
        },
    },
};

#[derive(Debug, Deserialize)]
pub struct EsqueciSenhaDto {
    pub tenant_slug: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct RedefinirSenhaDto {
    pub tenant_slug: String,
    pub token: String,
    pub nova_senha: String,
}

#[derive(Debug, Serialize)]
pub struct RecuperacaoSenhaResponse {
    pub mensagem: String,
}

#[derive(Debug, Serialize)]
pub struct RedefinirSenhaResponse {
    pub status: String,
    pub mensagem: String,
}

const TOKEN_BYTES: usize = 32;
const TOKEN_VALIDITY_MINUTES: i64 = 30;
const MENSAGEM_NEUTRA: &str = "Se o e-mail estiver cadastrado, enviaremos as instruções.";
const MENSAGEM_LINK_INVALIDO: &str = "Link inválido ou expirado. Peça um novo.";

pub fn sha256_hex(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn generate_recovery_token() -> String {
    let mut bytes = [0u8; TOKEN_BYTES];
    OsRng.fill_bytes(&mut bytes);
    crate::handlers::auth::base64_url_encode(&bytes)
}

fn hash_password_argon2(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::InternalServerError(e.to_string()))
        .map(|h| h.to_string())
}

/// Rota pública: solicita recuperação de senha.
/// Retorna sempre a mesma mensagem para não enumerar usuários/escolas.
pub async fn esqueci_senha(
    State(state): State<AppState>,
    Json(dto): Json<EsqueciSenhaDto>,
) -> Result<Json<RecuperacaoSenhaResponse>, AppError> {
    let clean_slug = dto.tenant_slug.trim().to_lowercase();
    let clean_email = dto.email.trim().to_lowercase();

    // Resolve o tenant; se não existir, responde com a mensagem neutra (sem enumeração).
    let tenant = match sqlx::query_as::<_, Tenant>(
        "SELECT * FROM tenants WHERE slug = $1 AND status = 'active'",
    )
    .bind(&clean_slug)
    .fetch_optional(&state.pool)
    .await?
    {
        Some(t) => t,
        None => {
            return Ok(Json(RecuperacaoSenhaResponse {
                mensagem: MENSAGEM_NEUTRA.to_string(),
            }));
        }
    };

    let mut db = acquire_tenant(&state.pool, tenant.id).await?;

    let user_opt =
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE tenant_id = $1 AND email = $2")
            .bind(tenant.id)
            .bind(&clean_email)
            .fetch_optional(&mut *db)
            .await?;

    let user = match user_opt {
        Some(u) if u.ativo => u,
        _ => {
            return Ok(Json(RecuperacaoSenhaResponse {
                mensagem: MENSAGEM_NEUTRA.to_string(),
            }));
        }
    };

    // Invalida tokens anteriores não usados do usuário.
    sqlx::query(
        "UPDATE tokens_recuperacao_senha SET usado_em = NOW() WHERE tenant_id = $1 AND user_id = $2 AND usado_em IS NULL"
    )
    .bind(tenant.id)
    .bind(user.id)
    .execute(&mut *db)
    .await?;

    let token = generate_recovery_token();
    let token_hash = sha256_hex(&token);
    let expires_at = Utc::now() + Duration::minutes(TOKEN_VALIDITY_MINUTES);

    sqlx::query(
        "INSERT INTO tokens_recuperacao_senha (tenant_id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)"
    )
    .bind(tenant.id)
    .bind(user.id)
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&mut *db)
    .await?;

    let link = format!(
        "{}/?redefinir={}&escola={}",
        state.config.app_public_url.trim_end_matches('/'),
        token,
        clean_slug
    );

    let assunto = "Recuperação de senha - Escolar ERP";
    let corpo = format!(
        "Olá,\n\nVocê solicitou a recuperação de senha da sua conta na escola {}.\n\nClique no link abaixo para criar uma nova senha. Ele é válido por 30 minutos e só pode ser usado uma vez:\n\n{}\n\nSe você não fez essa solicitação, ignore este e-mail.\n\nAtenciosamente,\nEquipe Escolar ERP",
        tenant.name, link
    );

    let adapter = EmailAdapter::new(AdapterEmailMode::from(state.config.email_mode));
    adapter
        .send(&mut *db, tenant.id, &user.email, assunto, &corpo)
        .await?;

    log_audit(
        &mut *db,
        tenant.id,
        Some(user.id),
        "SENHA_RECUPERACAO_SOLICITADA",
        "users",
        Some(user.id.to_string()),
        Some(serde_json::json!({ "email": user.email })),
    )
    .await;

    Ok(Json(RecuperacaoSenhaResponse {
        mensagem: MENSAGEM_NEUTRA.to_string(),
    }))
}

/// Rota pública: redefine a senha a partir do token recebido por e-mail.
pub async fn redefinir_senha_publico(
    State(state): State<AppState>,
    Json(dto): Json<RedefinirSenhaDto>,
) -> Result<Json<RedefinirSenhaResponse>, AppError> {
    let clean_slug = dto.tenant_slug.trim().to_lowercase();
    let token = dto.token.trim();
    let nova_senha = &dto.nova_senha;

    if nova_senha.len() < 8 {
        return Err(AppError::BadRequest(
            "A nova senha deve ter pelo menos 8 caracteres.".to_string(),
        ));
    }

    let tenant = match sqlx::query_as::<_, Tenant>(
        "SELECT * FROM tenants WHERE slug = $1 AND status = 'active'",
    )
    .bind(&clean_slug)
    .fetch_optional(&state.pool)
    .await?
    {
        Some(t) => t,
        None => {
            return Err(AppError::BadRequest(MENSAGEM_LINK_INVALIDO.to_string()));
        }
    };

    let mut db = acquire_tenant(&state.pool, tenant.id).await?;
    let token_hash = sha256_hex(token);

    let row = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            Option<chrono::DateTime<Utc>>,
            chrono::DateTime<Utc>,
        ),
    >(
        r#"
        SELECT id, user_id, usado_em, expires_at
        FROM tokens_recuperacao_senha
        WHERE tenant_id = $1 AND token_hash = $2
        "#,
    )
    .bind(tenant.id)
    .bind(&token_hash)
    .fetch_optional(&mut *db)
    .await?;

    let (token_id, user_id, usado_em, expires_at) = match row {
        Some(r) => r,
        None => {
            return Err(AppError::BadRequest(MENSAGEM_LINK_INVALIDO.to_string()));
        }
    };

    if usado_em.is_some() || expires_at <= Utc::now() {
        return Err(AppError::BadRequest(MENSAGEM_LINK_INVALIDO.to_string()));
    }

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1 AND tenant_id = $2 AND ativo = true",
    )
    .bind(user_id)
    .bind(tenant.id)
    .fetch_optional(&mut *db)
    .await?;

    if user.is_none() {
        return Err(AppError::BadRequest(MENSAGEM_LINK_INVALIDO.to_string()));
    }

    let password_hash = hash_password_argon2(nova_senha)?;

    let mut tx = (&mut *db).begin().await?;

    sqlx::query(
        "UPDATE users SET password_hash = $1, deve_trocar_senha = false, updated_at = NOW() WHERE id = $2 AND tenant_id = $3"
    )
    .bind(&password_hash)
    .bind(user_id)
    .bind(tenant.id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE tokens_recuperacao_senha SET usado_em = NOW() WHERE id = $1 AND tenant_id = $2",
    )
    .bind(token_id)
    .bind(tenant.id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL"
    )
    .bind(user_id)
    .bind(tenant.id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant.id,
        Some(user_id),
        "SENHA_REDEFINIDA",
        "users",
        Some(user_id.to_string()),
        None,
    )
    .await;

    Ok(Json(RedefinirSenhaResponse {
        status: "sucesso".to_string(),
        mensagem: "Senha redefinida com sucesso.".to_string(),
    }))
}

/// Lista os e-mails simulados enviados (gestão/admin).
pub async fn listar_emails_saida_handler(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<EmailOutboxRecord>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor"])?;

    let emails = listar_emails_saida(&mut *db, auth_user.tenant_id, 50).await?;
    Ok(Json(emails))
}
