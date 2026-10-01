import os

with open('backend/src/handlers/academico.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# For criar_simulado_tri
tri_check = """
    // Feature Flag Check: TRI Module
    let is_tri_enabled = crate::utils::is_feature_enabled(&state.pool, active_tenant.0, "module_tri").await.unwrap_or(false);
    if !is_tri_enabled {
        return Err(AppError::BadRequest("O Módulo TRI está desabilitado para esta escola.".to_string()));
    }
"""

content = content.replace(
    "pub async fn criar_simulado_tri(\n    State(state): State<AppState>,\n    Extension(active_tenant): Extension<ActiveTenant>,\n    Extension(auth_user): Extension<AuthUser>,\n    axum::extract::Json(dto): axum::extract::Json<crate::models::academico::CreateSimuladoTriDto>,\n) -> Result<axum::Json<crate::models::academico::SimuladoTri>, AppError> {\n    crate::middleware::rbac::check_roles(&auth_user, &[\"admin\", \"gestor\", \"professor\"])?;\n    let tenant_id = active_tenant.0;",
    "pub async fn criar_simulado_tri(\n    State(state): State<AppState>,\n    Extension(active_tenant): Extension<ActiveTenant>,\n    Extension(auth_user): Extension<AuthUser>,\n    axum::extract::Json(dto): axum::extract::Json<crate::models::academico::CreateSimuladoTriDto>,\n) -> Result<axum::Json<crate::models::academico::SimuladoTri>, AppError> {\n    crate::middleware::rbac::check_roles(&auth_user, &[\"admin\", \"gestor\", \"professor\"])?;\n    let tenant_id = active_tenant.0;\n" + tri_check
)

content = content.replace(
    "pub async fn apurar_gabarito_tri(\n    State(state): State<AppState>,\n    Extension(active_tenant): Extension<ActiveTenant>,\n    Extension(auth_user): Extension<AuthUser>,\n    axum::extract::Json(dto): axum::extract::Json<crate::models::academico::ApurarGabaritoDto>,\n) -> Result<axum::Json<crate::models::academico::ResultadoTriAluno>, AppError> {\n    crate::middleware::rbac::check_roles(&auth_user, &[\"admin\", \"professor\"])?;\n    let tenant_id = active_tenant.0;",
    "pub async fn apurar_gabarito_tri(\n    State(state): State<AppState>,\n    Extension(active_tenant): Extension<ActiveTenant>,\n    Extension(auth_user): Extension<AuthUser>,\n    axum::extract::Json(dto): axum::extract::Json<crate::models::academico::ApurarGabaritoDto>,\n) -> Result<axum::Json<crate::models::academico::ResultadoTriAluno>, AppError> {\n    crate::middleware::rbac::check_roles(&auth_user, &[\"admin\", \"professor\"])?;\n    let tenant_id = active_tenant.0;\n" + tri_check
)

content = content.replace(
    "pub async fn listar_simulados_tri(\n    State(state): State<AppState>,\n    Extension(active_tenant): Extension<ActiveTenant>,\n    Extension(auth_user): Extension<AuthUser>,\n) -> Result<axum::Json<Vec<crate::models::academico::SimuladoTri>>, AppError> {\n    let tenant_id = active_tenant.0;",
    "pub async fn listar_simulados_tri(\n    State(state): State<AppState>,\n    Extension(active_tenant): Extension<ActiveTenant>,\n    Extension(auth_user): Extension<AuthUser>,\n) -> Result<axum::Json<Vec<crate::models::academico::SimuladoTri>>, AppError> {\n    let tenant_id = active_tenant.0;\n" + tri_check
)

with open('backend/src/handlers/academico.rs', 'w', encoding='utf-8') as f:
    f.write(content)
