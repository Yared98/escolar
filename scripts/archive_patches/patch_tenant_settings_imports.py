import os

with open('backend/src/handlers/tenant_settings.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('crate::models::auth::{ActiveTenant, AuthUser}', 'crate::models::user::{ActiveTenant, AuthUser}')
content = content.replace('crate::handlers::financeiro::check_roles', 'crate::middleware::rbac::check_roles')

with open('backend/src/handlers/tenant_settings.rs', 'w', encoding='utf-8') as f:
    f.write(content)
