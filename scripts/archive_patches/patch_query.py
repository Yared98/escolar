import os

with open('backend/src/handlers/financeiro.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'sqlx::query!("SELECT client_id, client_secret FROM tenant_cora_config WHERE tenant_id = $1", tenant_id)',
    'sqlx::query_as::<_, (String, String)>("SELECT client_id, client_secret FROM tenant_cora_config WHERE tenant_id = $1").bind(tenant_id)'
)
content = content.replace(
    'if let Some(config) = creds {',
    'if let Some((client_id, client_secret)) = creds {'
)
content = content.replace(
    '&config.client_id, &config.client_secret',
    '&client_id, &client_secret'
)

with open('backend/src/handlers/financeiro.rs', 'w', encoding='utf-8') as f:
    f.write(content)

with open('backend/src/handlers/webhooks_cora.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'let _ = sqlx::query!(',
    'let _ = sqlx::query('
)

with open('backend/src/handlers/webhooks_cora.rs', 'w', encoding='utf-8') as f:
    f.write(content)
