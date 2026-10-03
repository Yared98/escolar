use crate::{error::AppError, middleware::auth::AuthUser};

pub fn check_roles(auth_user: &AuthUser, allowed_roles: &[&str]) -> Result<(), AppError> {
    let user_role = auth_user.role.to_lowercase().replace('_', "");

    // Admin e gestor têm privilégio total em rotas protegidas
    if user_role == "admin"
        || user_role == "gestor"
        || user_role == "superadmin"
        || user_role == "gestorescolar"
    {
        return Ok(());
    }

    let is_allowed = allowed_roles.iter().any(|&r| {
        let r_norm = r.to_lowercase().replace('_', "");
        user_role == r_norm
            || (r_norm == "financeiro" && user_role == "tesouraria")
            || (r_norm == "tesouraria" && user_role == "financeiro")
            || (r_norm == "admin" && (user_role == "superadmin" || user_role == "gestor"))
    });

    if is_allowed {
        Ok(())
    } else {
        Err(AppError::Forbidden(format!(
            "Acesso negado: o perfil '{}' não possui permissão para este recurso.",
            auth_user.role
        )))
    }
}

pub use crate::services::audit::log_audit;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlunoAccessMode {
    TenantStaff,
    SelfOnly,
    GuardianLink,
    ProfessorLink,
    Denied,
}

pub fn role_key(role: &str) -> String {
    role.to_lowercase().replace('_', "")
}

pub fn aluno_access_mode(role: &str) -> AlunoAccessMode {
    match role_key(role).as_str() {
        "admin" | "gestor" | "superadmin" | "gestorescolar" | "secretaria" => {
            AlunoAccessMode::TenantStaff
        }
        "aluno" => AlunoAccessMode::SelfOnly,
        "responsavel" => AlunoAccessMode::GuardianLink,
        "professor" => AlunoAccessMode::ProfessorLink,
        _ => AlunoAccessMode::Denied,
    }
}

pub fn can_notify_others(role: &str) -> bool {
    matches!(
        role_key(role).as_str(),
        "admin"
            | "gestor"
            | "superadmin"
            | "gestorescolar"
            | "secretaria"
            | "financeiro"
            | "tesouraria"
    )
}

pub async fn check_aluno_ownership(
    executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
    auth_user: &AuthUser,
    aluno_id: uuid::Uuid,
) -> Result<(), AppError> {
    match aluno_access_mode(&auth_user.role) {
        AlunoAccessMode::TenantStaff => Ok(()),
        AlunoAccessMode::SelfOnly => {
            if auth_user.id != aluno_id {
                return Err(AppError::Forbidden(
                    "Acesso negado: aluno só pode acessar seus próprios dados.".into(),
                ));
            }
            Ok(())
        }
        AlunoAccessMode::GuardianLink => {
            let is_linked: (bool,) = sqlx::query_as(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM alunos a
                    LEFT JOIN responsaveis_alunos ra ON a.id = ra.aluno_id
                    WHERE a.id = $1 AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)
                )
                "#,
            )
            .bind(aluno_id)
            .bind(auth_user.id)
            .fetch_one(executor)
            .await?;

            if !is_linked.0 {
                return Err(AppError::Forbidden(
                    "Acesso negado: responsável não vinculado a este aluno.".into(),
                ));
            }
            Ok(())
        }
        AlunoAccessMode::ProfessorLink => {
            let is_linked: (bool,) = sqlx::query_as(
                r#"
                SELECT EXISTS(
                    SELECT 1
                    FROM turma_alunos ta
                    INNER JOIN turma_professores tp
                        ON tp.turma_id = ta.turma_id
                       AND tp.tenant_id = ta.tenant_id
                    WHERE ta.aluno_id = $1
                      AND tp.professor_id = $2
                      AND ta.status = 'ativo'
                      AND ta.tenant_id = get_current_tenant()
                )
                "#,
            )
            .bind(aluno_id)
            .bind(auth_user.id)
            .fetch_one(executor)
            .await?;

            if !is_linked.0 {
                return Err(AppError::Forbidden(
                    "Acesso negado: professor não vinculado à turma deste aluno.".into(),
                ));
            }
            Ok(())
        }
        AlunoAccessMode::Denied => Err(AppError::Forbidden(
            "Acesso negado: perfil sem vínculo explícito com este aluno.".into(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn make_user(role: &str) -> AuthUser {
        AuthUser {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            role: role.to_string(),
        }
    }

    #[test]
    fn test_admin_and_gestor_have_full_access() {
        let admin = make_user("admin");
        assert!(check_roles(&admin, &["secretaria"]).is_ok());
        assert!(check_roles(&admin, &["financeiro"]).is_ok());

        let gestor = make_user("GestorEscolar");
        assert!(check_roles(&gestor, &["secretaria"]).is_ok());
        assert!(check_roles(&gestor, &["professor"]).is_ok());
    }

    #[test]
    fn test_allowed_role_passes() {
        let sec = make_user("secretaria");
        assert!(check_roles(&sec, &["admin", "gestor", "secretaria"]).is_ok());

        let prof = make_user("professor");
        assert!(check_roles(&prof, &["professor"]).is_ok());
    }

    #[test]
    fn test_disallowed_role_fails() {
        let aluno = make_user("aluno");
        let result = check_roles(&aluno, &["admin", "secretaria"]);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::Forbidden(msg) => assert!(msg.contains("Acesso negado")),
            _ => panic!("Expected Forbidden"),
        }
    }

    #[test]
    fn test_financeiro_tesouraria_alias() {
        let tes = make_user("tesouraria");
        assert!(check_roles(&tes, &["financeiro"]).is_ok());

        let fin = make_user("financeiro");
        assert!(check_roles(&fin, &["tesouraria"]).is_ok());
    }

    #[test]
    fn test_aluno_access_denies_unlinked_profiles() {
        assert_eq!(
            aluno_access_mode("professor"),
            AlunoAccessMode::ProfessorLink
        );
        assert_eq!(aluno_access_mode("nutricionista"), AlunoAccessMode::Denied);
        assert_eq!(
            aluno_access_mode("secretaria"),
            AlunoAccessMode::TenantStaff
        );
        assert_eq!(
            aluno_access_mode("responsavel"),
            AlunoAccessMode::GuardianLink
        );
        assert!(!can_notify_others("professor"));
        assert!(can_notify_others("secretaria"));
    }
}
