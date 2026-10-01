import os

with open('src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add to NavRoute
content = content.replace(
    "| 'portal_aluno';",
    "| 'portal_aluno'\n  | 'calendario';"
)

# Add to imports
content = content.replace(
    "Smartphone,",
    "Smartphone,\n  CalendarDays,"
)

# Add to menuItems
content = content.replace(
    "{ id: 'portal_aluno' as NavRoute, label: 'Portal do Aluno (Central da Família)', icon: GraduationCap },",
    "{ id: 'portal_aluno' as NavRoute, label: 'Portal do Aluno (Central da Família)', icon: GraduationCap },\n    { id: 'calendario' as NavRoute, label: 'Planner & Calendário Escolar', icon: CalendarDays },"
)

# Add to isAllowed switch statement
content = content.replace(
    "case 'agenda':",
    "case 'calendario':\n        return true;\n      case 'agenda':"
)

with open('src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
