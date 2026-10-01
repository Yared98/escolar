import os

with open('backend/src/handlers/webhooks_cora.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'let creds = sqlx::query_as::<_, (String,)>(',
    'let creds = sqlx::query_as::<_, (Option<String>,)>('
)

content = content.replace(
    'Some((secret,)) => secret,',
    'Some((Some(secret),)) => secret,'
)

with open('backend/src/handlers/webhooks_cora.rs', 'w', encoding='utf-8') as f:
    f.write(content)
