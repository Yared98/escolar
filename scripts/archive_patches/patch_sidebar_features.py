import os

with open('frontend/src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_isAllowed = """
  const isAllowed = (routeId: NavRoute) => {
    const role = user?.role || 'responsavel';
    
    // Feature Flag Rules
    if (routeId === 'crm' && !user?.features?.includes('module_crm')) return false;
    if (routeId === 'ia_evasao' && !user?.features?.includes('module_ia')) return false;

    // RBAC Rules
    switch (routeId) {
      case 'overview':
        return role === 'admin' || role === 'gestor';
      case 'secretaria':
      case 'administrativo':
        return role === 'admin' || role === 'secretaria' || role === 'gestor';
      case 'financeiro':
        return role === 'admin' || role === 'financeiro' || role === 'gestor';
      case 'pedagogico':
        return role === 'admin' || role === 'professor' || role === 'coordenador';
      case 'academico':
        return role === 'admin' || role === 'professor';
      case 'crm':
        return role === 'admin' || role === 'gestor' || role === 'secretaria';
      case 'ia_evasao':
        return role === 'admin' || role === 'gestor';
      case 'portal_aluno':
        return role === 'aluno' || role === 'responsavel';
      case 'calendario':
      case 'agenda':
        return true;
      default:
        return false;
    }
  };
"""

content = content.replace(
    "const isAllowed = (routeId: NavRoute) => {\n    const role = user?.role || 'responsavel';\n    switch (routeId) {\n      case 'overview':\n        return role === 'admin' || role === 'gestor';\n      case 'secretaria':\n      case 'administrativo':\n        return role === 'admin' || role === 'secretaria' || role === 'gestor';\n      case 'financeiro':\n        return role === 'admin' || role === 'financeiro' || role === 'gestor';\n      case 'pedagogico':\n        return role === 'admin' || role === 'professor' || role === 'coordenador';\n      case 'academico':\n        return role === 'admin' || role === 'professor';\n      case 'crm':\n        return role === 'admin' || role === 'gestor' || role === 'secretaria';\n      case 'ia_evasao':\n        return role === 'admin' || role === 'gestor';\n      case 'portal_aluno':\n        return role === 'aluno' || role === 'responsavel';\n      case 'calendario':\n      case 'agenda':\n        return true;\n      default:\n        return false;\n    }\n  };",
    new_isAllowed.strip()
)

with open('frontend/src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
