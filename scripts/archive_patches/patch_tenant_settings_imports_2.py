import os

with open('backend/src/handlers/tenant_settings.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('crate::models::user::{ActiveTenant, AuthUser}', 'crate::middleware::{auth::AuthUser, tenant::ActiveTenant}')

with open('backend/src/handlers/tenant_settings.rs', 'w', encoding='utf-8') as f:
    f.write(content)
