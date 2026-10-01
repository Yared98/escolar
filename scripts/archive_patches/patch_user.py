import os

with open('backend/src/models/user.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "pub role: String,\n    pub created_at: DateTime<Utc>,",
    "pub role: String,\n    pub created_at: DateTime<Utc>,\n    pub features: Vec<String>,"
)

content = content.replace(
    "role: user.role,\n            created_at: user.created_at,\n        }",
    "role: user.role,\n            created_at: user.created_at,\n            features: vec![],\n        }"
)

with open('backend/src/models/user.rs', 'w', encoding='utf-8') as f:
    f.write(content)
