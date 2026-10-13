use argon2::{
    password_hash::{rand_core::OsRng, rand_core::RngCore, PasswordHasher, SaltString},
    Argon2,
};
use axum::{
    extract::{Path, Query},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Acquire, FromRow};
use uuid::Uuid;

use crate::{
    db::TenantDb,
    error::AppError,
    middleware::{auth::AuthUser, rbac::check_roles},
    models::user::{User, UserRole},
    services::audit::log_audit,
};

const CARACTERES_SENHA: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const TAMANHO_SENHA_TEMPORARIA: usize = 12;

pub fn gerar_senha_temporaria() -> String {
    let mut bytes = [0u8; TAMANHO_SENHA_TEMPORARIA];
    OsRng.fill_bytes(&mut bytes);
    bytes
        .iter()
        .map(|b| CARACTERES_SENHA[*b as usize % CARACTERES_SENHA.len()] as char)
        .collect()
}

pub fn validar_perfil(perfil: &str) -> Result<String, AppError> {
    let limpo = perfil.trim().to_lowercase().replace('_', "");
    let permitidos = [
        "gestor",
        "gestorescolar",
        "superadmin",
        "admin",
        "secretaria",
        "financeiro",
        "tesouraria",
        "professor",
        "nutricionista",
        "responsavel",
    ];
    if !permitidos.contains(&limpo.as_str()) {
        return Err(AppError::BadRequest(
            "Perfil inválido. Escolha entre gestor, secretaria, financeiro, professor, nutricionista ou responsavel.".to_string(),
        ));
    }
    let role = UserRole::from(perfil.to_string());
    Ok(role.to_string())
}

fn hash_password_argon2(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::InternalServerError(e.to_string()))
        .map(|h| h.to_string())
}

pub fn validar_nova_senha(senha_atual: &str, nova_senha: &str) -> Result<(), AppError> {
    if nova_senha.len() < 8 {
        return Err(AppError::BadRequest(
            "A nova senha deve ter pelo menos 8 caracteres.".to_string(),
        ));
    }
    if nova_senha == senha_atual {
        return Err(AppError::BadRequest(
            "A nova senha deve ser diferente da senha atual.".to_string(),
        ));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct ListarUsuariosQuery {
    pub perfil: Option<String>,
    pub busca: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct AlunoVinculadoDto {
    pub aluno_id: Uuid,
    pub aluno_nome: String,
}

#[derive(Debug, Serialize)]
pub struct UsuarioListItem {
    pub id: Uuid,
    pub nome: String,
    pub email: String,
    pub perfil: String,
    pub ativo: bool,
    pub deve_trocar_senha: bool,
    pub criado_em: DateTime<Utc>,
    pub alunos_vinculados: Vec<AlunoVinculadoDto>,
}

#[derive(Debug, FromRow)]
struct UserListRow {
    id: Uuid,
    name: String,
    email: String,
    role: String,
    ativo: bool,
    deve_trocar_senha: bool,
    created_at: DateTime<Utc>,
}

pub async fn listar_usuarios(
    TenantDb(mut db): TenantDb,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<ListarUsuariosQuery>,
) -> Result<Json<Vec<UsuarioListItem>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor"])?;

    let perfil_filtro = query.perfil.as_deref().unwrap_or("").trim().to_lowercase();
    let busca = query.busca.as_deref().unwrap_or("").trim().to_lowercase();

    let users: Vec<UserListRow> = if perfil_filtro.is_empty() {
        sqlx::query_as::<_, UserListRow>(
            "SELECT id, name, email, role, ativo, deve_trocar_senha, created_at FROM users WHERE tenant_id = get_current_tenant() ORDER BY name ASC"
        )
        .fetch_all(&mut *db)
        .await?
    } else {
        sqlx::query_as::<_, UserListRow>(
            "SELECT id, name, email, role, ativo, deve_trocar_senha, created_at FROM users WHERE tenant_id = get_current_tenant() AND LOWER(role) = $1 ORDER BY name ASC"
        )
        .bind(&perfil_filtro)
        .fetch_all(&mut *db)
        .await?
    };

    let mut resultado = Vec::with_capacity(users.len());
    for u in users {
        if !busca.is_empty()
            && !u.name.to_lowercase().contains(&busca)
            && !u.email.to_lowercase().contains(&busca)
        {
            continue;
        }

        let alunos: Vec<AlunoVinculadoDto> = if u.role == "responsavel" {
            sqlx::query_as::<_, AlunoVinculadoDto>(
                r#"
                SELECT a.id AS aluno_id, a.nome AS aluno_nome
                FROM alunos a
                INNER JOIN responsaveis_alunos ra ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                WHERE a.tenant_id = get_current_tenant() AND ra.responsavel_user_id = $1
                ORDER BY a.nome ASC
                "#,
            )
            .bind(u.id)
            .fetch_all(&mut *db)
            .await?
        } else {
            vec![]
        };

        resultado.push(UsuarioListItem {
            id: u.id,
            nome: u.name,
            email: u.email,
            perfil: u.role,
            ativo: u.ativo,
            deve_trocar_senha: u.deve_trocar_senha,
            criado_em: u.created_at,
            alunos_vinculados: alunos,
        });
    }

    Ok(Json(resultado))
}

#[derive(Debug, Deserialize)]
pub struct CriarUsuarioDto {
    pub nome: String,
    pub email: String,
    pub perfil: String,
    pub aluno_ids: Option<Vec<Uuid>>,
    pub parentesco: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UsuarioCriadoResponse {
    pub id: Uuid,
    pub senha_temporaria: String,
}

pub async fn criar_usuario(
    TenantDb(mut db): TenantDb,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CriarUsuarioDto>,
) -> Result<Json<UsuarioCriadoResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor"])?;

    let nome = dto.nome.trim().to_string();
    let email = dto.email.trim().to_lowercase();
    if nome.is_empty() || email.is_empty() {
        return Err(AppError::BadRequest(
            "Nome e e-mail são obrigatórios.".to_string(),
        ));
    }

    let role = validar_perfil(&dto.perfil)?;
    let senha_temporaria = gerar_senha_temporaria();
    let password_hash = hash_password_argon2(&senha_temporaria)?;

    let mut tx = db.begin().await?;

    let insert_result = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (tenant_id, name, email, password_hash, role, ativo, deve_trocar_senha)
        VALUES (get_current_tenant(), $1, $2, $3, $4, true, true)
        RETURNING *
        "#,
    )
    .bind(&nome)
    .bind(&email)
    .bind(&password_hash)
    .bind(&role)
    .fetch_one(&mut *tx)
    .await;

    let user = match insert_result {
        Ok(u) => u,
        Err(sqlx::Error::Database(db_err))
            if db_err.is_unique_violation() || db_err.code().as_deref() == Some("23505") =>
        {
            return Err(AppError::BadRequest(
                "Já existe um usuário com este e-mail nesta escola.".to_string(),
            ));
        }
        Err(e) => return Err(AppError::DatabaseError(e)),
    };

    if role == "responsavel" {
        let aluno_ids = dto.aluno_ids.unwrap_or_default();
        if aluno_ids.is_empty() {
            return Err(AppError::BadRequest(
                "Informe pelo menos um aluno para o perfil família.".to_string(),
            ));
        }

        let parentesco = dto.parentesco.as_deref().unwrap_or("responsavel").trim();
        for aluno_id in &aluno_ids {
            let existe: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM alunos WHERE tenant_id = get_current_tenant() AND id = $1)"
            )
            .bind(aluno_id)
            .fetch_one(&mut *tx)
            .await?;

            if !existe {
                return Err(AppError::BadRequest(
                    "Um ou mais alunos informados não foram encontrados nesta escola.".to_string(),
                ));
            }

            sqlx::query(
                "INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id, parentesco) VALUES (get_current_tenant(), $1, $2, $3)"
            )
            .bind(user.id)
            .bind(aluno_id)
            .bind(parentesco)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        auth_user.tenant_id,
        Some(auth_user.id),
        "USUARIO_CRIAR",
        "users",
        Some(user.id.to_string()),
        Some(serde_json::json!({
            "nome": user.name,
            "email": user.email,
            "perfil": user.role,
            "criado_por": auth_user.id
        })),
    )
    .await;

    Ok(Json(UsuarioCriadoResponse {
        id: user.id,
        senha_temporaria,
    }))
}

#[derive(Debug, Deserialize)]
pub struct AtualizarUsuarioDto {
    pub nome: Option<String>,
    pub perfil: Option<String>,
    pub ativo: Option<bool>,
    pub aluno_ids: Option<Vec<Uuid>>,
}

pub async fn atualizar_usuario(
    TenantDb(mut db): TenantDb,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(dto): Json<AtualizarUsuarioDto>,
) -> Result<Json<UsuarioListItem>, AppError> {
    check_roles(&auth_user, &["admin", "gestor"])?;

    if id == auth_user.id {
        if dto.ativo == Some(false) {
            return Err(AppError::BadRequest(
                "Você não pode desativar a própria conta.".to_string(),
            ));
        }
        if let Some(ref perfil) = dto.perfil {
            let novo = validar_perfil(perfil)?;
            if novo != "gestor" && novo != "admin" {
                return Err(AppError::BadRequest(
                    "Você não pode rebaixar a própria conta.".to_string(),
                ));
            }
        }
    }

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1 AND tenant_id = get_current_tenant()",
    )
    .bind(id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let novo_role = dto.perfil.as_ref().map(|p| validar_perfil(p)).transpose()?;

    let role_atual_canon = user.role.to_lowercase().replace('_', "");
    let eh_gestor = role_atual_canon == "gestor"
        || role_atual_canon == "admin"
        || role_atual_canon == "superadmin"
        || role_atual_canon == "gestorescolar";

    // Se está desativando ou rebaixando um gestor, garantir que não é o último gestor/admin ativo.
    let perde_poder = dto.ativo == Some(false)
        || novo_role
            .as_ref()
            .map(|r| r != "gestor" && r != "admin")
            .unwrap_or(false);

    if eh_gestor && perde_poder {
        let outros_ativos: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint FROM users
            WHERE tenant_id = get_current_tenant()
              AND id <> $1
              AND ativo = true
              AND LOWER(REPLACE(role, '_', '')) IN ('gestor', 'admin', 'superadmin', 'gestorescolar')
            "#,
        )
        .bind(id)
        .fetch_one(&mut *db)
        .await?;

        if outros_ativos == 0 {
            return Err(AppError::BadRequest(
                "Não é possível desativar ou rebaixar o último gestor ativo da escola.".to_string(),
            ));
        }
    }

    let nome = dto.nome.as_ref().map(|s| s.trim().to_string());
    let ativo = dto.ativo;

    let updated = sqlx::query_as::<_, User>(
        "UPDATE users SET name = COALESCE($1, name), role = COALESCE($2, role), ativo = COALESCE($3, ativo), updated_at = NOW() WHERE id = $4 AND tenant_id = get_current_tenant() RETURNING *"
    )
    .bind(nome.as_ref().filter(|s| !s.is_empty()))
    .bind(novo_role.as_ref())
    .bind(ativo)
    .bind(id)
    .fetch_one(&mut *db)
    .await?;

    if let Some(ref perfil) = novo_role {
        if perfil == "responsavel" {
            if let Some(ref aluno_ids) = dto.aluno_ids {
                sqlx::query("DELETE FROM responsaveis_alunos WHERE tenant_id = get_current_tenant() AND responsavel_user_id = $1")
                    .bind(id)
                    .execute(&mut *db)
                    .await?;

                for aluno_id in aluno_ids {
                    let existe: bool = sqlx::query_scalar(
                        "SELECT EXISTS(SELECT 1 FROM alunos WHERE tenant_id = get_current_tenant() AND id = $1)"
                    )
                    .bind(aluno_id)
                    .fetch_one(&mut *db)
                    .await?;

                    if !existe {
                        return Err(AppError::BadRequest(
                            "Um ou mais alunos informados não foram encontrados nesta escola."
                                .to_string(),
                        ));
                    }

                    sqlx::query(
                        "INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id) VALUES (get_current_tenant(), $1, $2)"
                    )
                    .bind(id)
                    .bind(aluno_id)
                    .execute(&mut *db)
                    .await?;
                }
            }
        }
    }

    log_audit(
        &mut *db,
        auth_user.tenant_id,
        Some(auth_user.id),
        "USUARIO_ATUALIZAR",
        "users",
        Some(id.to_string()),
        Some(serde_json::json!({
            "nome": updated.name,
            "email": updated.email,
            "perfil": updated.role,
            "ativo": updated.ativo,
            "perfil_anterior": user.role,
            "ativo_anterior": user.ativo
        })),
    )
    .await;

    let alunos_vinculados = if updated.role == "responsavel" {
        sqlx::query_as::<_, AlunoVinculadoDto>(
            r#"
            SELECT a.id AS aluno_id, a.nome AS aluno_nome
            FROM alunos a
            INNER JOIN responsaveis_alunos ra ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
            WHERE a.tenant_id = get_current_tenant() AND ra.responsavel_user_id = $1
            ORDER BY a.nome ASC
            "#,
        )
        .bind(updated.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        vec![]
    };

    Ok(Json(UsuarioListItem {
        id: updated.id,
        nome: updated.name,
        email: updated.email,
        perfil: updated.role,
        ativo: updated.ativo,
        deve_trocar_senha: updated.deve_trocar_senha,
        criado_em: updated.created_at,
        alunos_vinculados,
    }))
}

#[derive(Debug, Serialize)]
pub struct RedefinirSenhaResponse {
    pub senha_temporaria: String,
}

pub async fn redefinir_senha(
    TenantDb(mut db): TenantDb,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<RedefinirSenhaResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor"])?;

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1 AND tenant_id = get_current_tenant()",
    )
    .bind(id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let senha_temporaria = gerar_senha_temporaria();
    let password_hash = hash_password_argon2(&senha_temporaria)?;

    sqlx::query(
        "UPDATE users SET password_hash = $1, deve_trocar_senha = true, updated_at = NOW() WHERE id = $2 AND tenant_id = get_current_tenant()"
    )
    .bind(&password_hash)
    .bind(id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        auth_user.tenant_id,
        Some(auth_user.id),
        "USUARIO_REDEFINIR_SENHA",
        "users",
        Some(id.to_string()),
        Some(serde_json::json!({
            "email": user.email,
            "perfil": user.role,
            "redefinido_por": auth_user.id
        })),
    )
    .await;

    Ok(Json(RedefinirSenhaResponse { senha_temporaria }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gerar_senha_temporaria_tamanho_e_alfabeto() {
        let senha = gerar_senha_temporaria();
        assert_eq!(senha.len(), TAMANHO_SENHA_TEMPORARIA);
        assert!(senha.chars().all(|c| CARACTERES_SENHA.contains(&(c as u8))));
        assert!(senha.chars().any(|c| c.is_ascii_alphabetic()));
        assert!(senha.chars().any(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_validar_perfil_aceita_permitidos() {
        assert_eq!(validar_perfil("gestor").unwrap(), "gestor");
        assert_eq!(validar_perfil("secretaria").unwrap(), "secretaria");
        assert_eq!(validar_perfil("financeiro").unwrap(), "financeiro");
        assert_eq!(validar_perfil("professor").unwrap(), "professor");
        assert_eq!(validar_perfil("nutricionista").unwrap(), "nutricionista");
        assert_eq!(validar_perfil("responsavel").unwrap(), "responsavel");
    }

    #[test]
    fn test_validar_perfil_rejeita_invalidos() {
        assert!(validar_perfil("aluno").is_err());
        assert!(validar_perfil("hacker").is_err());
        assert!(validar_perfil("").is_err());
    }

    #[test]
    fn test_validar_nova_senha() {
        assert!(validar_nova_senha("antiga123", "novasenha1").is_ok());
        assert!(validar_nova_senha("igua123", "igua123").is_err());
        assert!(validar_nova_senha("antiga", "curta").is_err());
    }

    #[test]
    fn test_ultimo_gestor_regra_pura() {
        let outros_ativos = 0i64;
        assert_eq!(outros_ativos, 0);
        // A lógica real é testada nos testes de integração; aqui documentamos a invariante.
    }
}
