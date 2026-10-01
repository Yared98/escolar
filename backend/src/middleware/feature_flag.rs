use axum::{
    extract::{Request, State, Extension},
    middleware::Next,
    response::Response,
};
use crate::middleware::tenant::ActiveTenant;
use crate::error::AppError;
use crate::AppState;

pub async fn check_feature_flag(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let path = req.uri().path();
    
    let required_feature = if path.contains("/simulados") || path.contains("/apuracao-gabarito") {
        Some("module_tri")
    } else if path.contains("/crm") {
        Some("module_crm")
    } else if path.contains("/ia/evasao") {
        Some("module_ia")
    } else {
        None
    };

    if let Some(feature) = required_feature {
        let mut conn = match crate::db::acquire_tenant(&state.pool, active_tenant.0).await {
            Ok(conn) => conn,
            Err(_) => return Err(AppError::InternalServerError("Falha ao isolar o tenant da funcionalidade.".into())),
        };
        let is_enabled = crate::utils::is_feature_enabled(&mut *conn, active_tenant.0, feature).await.unwrap_or(false);
        if !is_enabled {
            return Err(AppError::BadRequest(format!("O Módulo '{}' está desabilitado para esta escola.", feature)));
        }
    }

    Ok(next.run(req).await)
}
