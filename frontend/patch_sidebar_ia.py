import os

with open('src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add to NavRoute
content = content.replace(
    "| 'crm';",
    "| 'crm'\n  | 'ia_evasao';"
)

# Add to imports
content = content.replace(
    "Megaphone,",
    "Megaphone,\n  Brain,"
)

# Add to menuItems
content = content.replace(
    "{ id: 'crm' as NavRoute, label: 'CRM & Captação', icon: Megaphone },",
    "{ id: 'crm' as NavRoute, label: 'CRM & Captação', icon: Megaphone },\n    { id: 'ia_evasao' as NavRoute, label: 'IA Anti-Evasão (EWS)', icon: Brain },"
)

# Add to isAllowed switch statement
content = content.replace(
    "case 'crm':\n        return role === 'admin' || role === 'gestor' || role === 'secretaria';",
    "case 'crm':\n        return role === 'admin' || role === 'gestor' || role === 'secretaria';\n      case 'ia_evasao':\n        return role === 'admin' || role === 'gestor';"
)

with open('src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
