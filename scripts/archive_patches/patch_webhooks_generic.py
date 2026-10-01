import os

with open('backend/src/handlers/webhooks_cora.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('cora_invoice_id = $2', 'gateway_invoice_id = $2 AND gateway_name = \'cora\'')

with open('backend/src/handlers/webhooks_cora.rs', 'w', encoding='utf-8') as f:
    f.write(content)
