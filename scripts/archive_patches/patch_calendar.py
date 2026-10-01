import os

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_bad = "import {\n  BookOpen,\n  BrainCircuit,\n  Calendar,"
import_good = "import {\n  BookOpen,\n  BrainCircuit,"
content = content.replace(import_bad, import_good)

with open('frontend/src/components/PedagocioNutricaoSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
