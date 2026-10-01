import os
import re

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"setToastMsg\(\{ text: '(.*?)', type: '.*?' \}\);", r"alert('\1');", content)
content = re.sub(r"setToastMsg\(\{ text: (err\.message \|\| '.*?'), type: 'error' \}\);", r"alert(\1);", content)
content = content.replace("setTimeout(() => setToastMsg(null), 4000);", "")

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
