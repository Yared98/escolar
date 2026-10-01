import os

with open('backend/src/routes.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "let public_routes = Router::new()",
    "let public_routes = Router::new()\n        .route(\"/api/webhooks/cora/:tenant_id\", post(crate::handlers::webhooks_cora::cora_webhook_handler))"
)

with open('backend/src/routes.rs', 'w', encoding='utf-8') as f:
    f.write(content)
