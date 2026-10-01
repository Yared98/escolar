import os

with open('src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add to NavRoute
content = content.replace(
    "| 'calendario';",
    "| 'calendario'\n  | 'crm';"
)

# Add to imports
content = content.replace(
    "Smartphone,",
    "Smartphone,\n  Megaphone,"
)

# Add to menuItems
content = content.replace(
    "{ id: 'calendario' as NavRoute, label: 'Planner & Calendário Escolar', icon: CalendarDays },",
    "{ id: 'calendario' as NavRoute, label: 'Planner & Calendário Escolar', icon: CalendarDays },\n    { id: 'crm' as NavRoute, label: 'CRM & Captação', icon: Megaphone },"
)

# Add to isAllowed switch statement
content = content.replace(
    "case 'calendario':\n        return true;",
    "case 'calendario':\n        return true;\n      case 'crm':\n        return role === 'admin' || role === 'gestor' || role === 'secretaria';"
)

with open('src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
