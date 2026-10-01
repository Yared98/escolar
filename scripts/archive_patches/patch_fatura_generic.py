import os

with open('backend/src/models/financeiro.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('pub cora_invoice_id: Option<String>,', 'pub gateway_invoice_id: Option<String>,')
content = content.replace('pub cora_invoice_url: Option<String>,', 'pub gateway_invoice_url: Option<String>,')
content = content.replace('pub created_at: DateTime<Utc>,', 'pub gateway_name: Option<String>,\n    pub created_at: DateTime<Utc>,')

with open('backend/src/models/financeiro.rs', 'w', encoding='utf-8') as f:
    f.write(content)
