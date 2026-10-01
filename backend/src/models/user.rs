use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum UserRole {
    Admin,
    Gestor,
    Secretaria,
    Financeiro,
    Professor,
    Aluno,
    Responsavel,
    Nutricionista,
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            UserRole::Admin => "admin",
            UserRole::Gestor => "gestor",
            UserRole::Secretaria => "secretaria",
            UserRole::Financeiro => "financeiro",
            UserRole::Professor => "professor",
            UserRole::Aluno => "aluno",
            UserRole::Responsavel => "responsavel",
            UserRole::Nutricionista => "nutricionista",
        };
        write!(f, "{}", s)
    }
}

impl From<String> for UserRole {
    fn from(s: String) -> Self {
        match s.to_lowercase().replace('_', "").as_str() {
            "admin" | "superadmin" => UserRole::Admin,
            "secretaria" => UserRole::Secretaria,
            "financeiro" | "tesouraria" => UserRole::Financeiro,
            "professor" => UserRole::Professor,
            "aluno" => UserRole::Aluno,
            "responsavel" => UserRole::Responsavel,
            "nutricionista" => UserRole::Nutricionista,
            _ => UserRole::Gestor,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct UserResponseDto {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub features: Vec<String>,
}

impl From<User> for UserResponseDto {
    fn from(user: User) -> Self {
        UserResponseDto {
            id: user.id,
            tenant_id: user.tenant_id,
            name: user.name,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
            features: vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_role_display_canonical() {
        assert_eq!(UserRole::Admin.to_string(), "admin");
        assert_eq!(UserRole::Gestor.to_string(), "gestor");
        assert_eq!(UserRole::Secretaria.to_string(), "secretaria");
        assert_eq!(UserRole::Financeiro.to_string(), "financeiro");
        assert_eq!(UserRole::Professor.to_string(), "professor");
        assert_eq!(UserRole::Aluno.to_string(), "aluno");
        assert_eq!(UserRole::Responsavel.to_string(), "responsavel");
        assert_eq!(UserRole::Nutricionista.to_string(), "nutricionista");
    }

    #[test]
    fn test_user_role_from_string_case_insensitive() {
        assert_eq!(UserRole::from("SuperAdmin".to_string()), UserRole::Admin);
        assert_eq!(UserRole::from("admin".to_string()), UserRole::Admin);
        assert_eq!(UserRole::from("GestorEscolar".to_string()), UserRole::Gestor);
        assert_eq!(UserRole::from("gestor".to_string()), UserRole::Gestor);
        assert_eq!(UserRole::from("Tesouraria".to_string()), UserRole::Financeiro);
        assert_eq!(UserRole::from("financeiro".to_string()), UserRole::Financeiro);
        assert_eq!(UserRole::from("professor".to_string()), UserRole::Professor);
        assert_eq!(UserRole::from("responsavel".to_string()), UserRole::Responsavel);
    }
}
