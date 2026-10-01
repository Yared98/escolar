import os

with open('backend/src/handlers/webhooks_cora.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('Some((Some(secret),)) => secret,', 'Some((secret,)) => secret,')

with open('backend/src/handlers/webhooks_cora.rs', 'w', encoding='utf-8') as f:
    f.write(content)
