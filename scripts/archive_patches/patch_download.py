import os

with open('frontend/src/components/SecretariaSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("UserCheck,", "UserCheck,\n  Download,")

with open('frontend/src/components/SecretariaSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
