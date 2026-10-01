import os

with open('backend/src/handlers/webhooks_cora.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'let _ = sqlx::query(\n            "UPDATE faturas SET status = \'pago\', updated_at = NOW() WHERE tenant_id = $1 AND cora_invoice_id = $2 AND status = \'pendente\'",\n            tenant_id,\n            cora_id\n        )',
    'let _ = sqlx::query(\n            "UPDATE faturas SET status = \'pago\', updated_at = NOW() WHERE tenant_id = $1 AND cora_invoice_id = $2 AND status = \'pendente\'"\n        )\n        .bind(tenant_id)\n        .bind(cora_id)'
)

with open('backend/src/handlers/webhooks_cora.rs', 'w', encoding='utf-8') as f:
    f.write(content)
