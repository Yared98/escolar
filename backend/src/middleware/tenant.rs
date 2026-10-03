use axum::{extract::Request, middleware::Next, response::Response};
use uuid::Uuid;

use crate::{error::AppError, middleware::auth::AuthUser};

#[derive(Clone, Debug)]
pub struct ActiveTenant(pub Uuid);

pub fn validate_tenant_match(
    jwt_tenant_id: Uuid,
    header_val: Option<&str>,
) -> Result<Uuid, AppError> {
    match header_val {
        Some(val) => {
            let header_tenant_id = Uuid::parse_str(val).map_err(|_| {
                AppError::Forbidden("Header X-Tenant-ID malformado ou inválido.".to_string())
            })?;

            if header_tenant_id != jwt_tenant_id {
                return Err(AppError::Forbidden(
                    "Violação de Multi-Tenancy: X-Tenant-ID não corresponde ao tenant autenticado."
                        .to_string(),
                ));
            }
            Ok(jwt_tenant_id)
        }
        None => Err(AppError::MissingTenantHeader),
    }
}

pub async fn tenant_middleware(mut req: Request, next: Next) -> Result<Response, AppError> {
    // 1. Tenta obter o AuthUser preenchido pelo auth_middleware
    let auth_user = req.extensions().get::<AuthUser>().cloned();

    let tenant_id = if let Some(user) = auth_user {
        let header_val = req
            .headers()
            .get("X-Tenant-ID")
            .and_then(|v| v.to_str().ok());
        validate_tenant_match(user.tenant_id, header_val)?
    } else {
        // Para requisições não autenticadas que utilizem tenant_middleware, exige header válido
        let tenant_id_header = req
            .headers()
            .get("X-Tenant-ID")
            .and_then(|val| val.to_str().ok())
            .ok_or(AppError::MissingTenantHeader)?;

        Uuid::parse_str(tenant_id_header).map_err(|_| AppError::MissingTenantHeader)?
    };

    req.extensions_mut().insert(ActiveTenant(tenant_id));

    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_tenant_match_identical() {
        let tenant_id = Uuid::new_v4();
        let header_str = tenant_id.to_string();
        let result = validate_tenant_match(tenant_id, Some(&header_str));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), tenant_id);
    }

    #[test]
    fn test_validate_tenant_match_none_header_fails() {
        let tenant_id = Uuid::new_v4();
        let result = validate_tenant_match(tenant_id, None);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::MissingTenantHeader => (),
            _ => panic!("Expected MissingTenantHeader"),
        }
    }

    #[test]
    fn test_validate_tenant_match_malformed_header_fails() {
        let jwt_tenant_id = Uuid::new_v4();
        let result = validate_tenant_match(jwt_tenant_id, Some("invalid-uuid-format"));
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::Forbidden(msg) => assert!(msg.contains("malformado ou inválido")),
            _ => panic!("Expected Forbidden for malformed header"),
        }
    }

    #[test]
    fn test_validate_tenant_match_different_fails() {
        let jwt_tenant_id = Uuid::new_v4();
        let attack_tenant_id = Uuid::new_v4();
        let header_str = attack_tenant_id.to_string();

        let result = validate_tenant_match(jwt_tenant_id, Some(&header_str));
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::Forbidden(msg) => assert!(msg.contains("Violação de Multi-Tenancy")),
            _ => panic!("Expected Forbidden"),
        }
    }
}
