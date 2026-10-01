import os
import re

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "const [activeTab, setActiveTab] = useState<'turmas' | 'disciplinas_matriz' | 'atribuicao_horarios' | 'projetos' | 'nutricao'>('turmas');",
    "const [activeTab, setActiveTab] = useState<'turmas' | 'disciplinas_matriz' | 'atribuicao_horarios' | 'projetos' | 'nutricao' | 'tri'>('turmas');"
)

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
