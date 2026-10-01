import os

with open('backend/src/models/financeiro.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "pub qr_code_pix: Option<String>,\n    pub created_at: DateTime<Utc>,",
    "pub qr_code_pix: Option<String>,\n    pub cora_invoice_id: Option<String>,\n    pub cora_invoice_url: Option<String>,\n    pub created_at: DateTime<Utc>,"
)

with open('backend/src/models/financeiro.rs', 'w', encoding='utf-8') as f:
    f.write(content)
