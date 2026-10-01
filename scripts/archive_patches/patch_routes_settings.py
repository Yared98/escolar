import os

with open('backend/src/routes.rs', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '        .route("/secretaria/turmas/transferir", post(transferir_aluno_turma))',
    '        .route("/secretaria/turmas/transferir", post(transferir_aluno_turma))\n\n        // Settings\n        .route("/tenant/integrations/banking", get(crate::handlers::tenant_settings::get_bank_integrations).put(crate::handlers::tenant_settings::save_bank_integration))'
)

with open('backend/src/routes.rs', 'w', encoding='utf-8') as f:
    f.write(content)
