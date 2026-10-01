import os

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bad = "'disciplinas_matriz' | 'atribuicao_horarios' | 'turmas' | 'projetos' | 'nutricao'"
good = "'disciplinas_matriz' | 'atribuicao_horarios' | 'turmas' | 'projetos' | 'nutricao' | 'tri'"

content = content.replace(bad, good)

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
