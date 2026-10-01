import os

with open('frontend/src/context/AuthContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "role: string;\n}",
    "role: string;\n  features?: string[];\n}"
)

with open('frontend/src/context/AuthContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
