import os

with open('backend/src/routes.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "pub fn create_router(state: AppState) -> Router {",
    "pub fn create_router(state: AppState) -> Router {\n    let state_clone = state.clone();"
)

content = content.replace(
    "let public_routes = Router::new()",
    "let protected_routes = protected_routes.layer(axum::middleware::from_fn_with_state(state_clone, crate::middleware::feature_flag::check_feature_flag));\n\n    let public_routes = Router::new()"
)

with open('backend/src/routes.rs', 'w', encoding='utf-8') as f:
    f.write(content)
