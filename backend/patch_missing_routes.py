import os

with open('src/routes.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
content = content.replace(
    "sincronizar_diario_pwa, registrar_portfolio_infantil,\n        },",
    "sincronizar_diario_pwa, registrar_portfolio_infantil, listar_portfolio_infantil,\n        },"
)

content = content.replace(
    "relatorios_operacionais_auditoria, criar_autorizacao_medicamento,\n        },",
    "relatorios_operacionais_auditoria, criar_autorizacao_medicamento, listar_autorizacoes_medicamento, atualizar_status_medicamento,\n        },"
)

content = content.replace(
    "obter_turma, renumerar_chamada_turma, salvar_prontuario, transferir_aluno_turma,\n            vincular_responsavel_aluno, criar_autorizado_retirada, listar_autorizados_retirada,",
    "obter_turma, renumerar_chamada_turma, salvar_prontuario, transferir_aluno_turma,\n            vincular_responsavel_aluno, criar_autorizado_retirada, listar_autorizados_retirada, atualizar_autorizado_retirada, deletar_autorizado_retirada, criar_grupo_familiar, listar_grupos_familiares,"
)

# Add routes
new_routes = """        .route("/secretaria/grupos-familiares", post(criar_grupo_familiar).get(listar_grupos_familiares))
        .route("/secretaria/alunos/:aluno_id/autorizados/:autorizado_id", put(atualizar_autorizado_retirada).delete(deletar_autorizado_retirada))
        .route("/agenda/medicamentos/:aluno_id", get(listar_autorizacoes_medicamento))
        .route("/agenda/medicamentos/:aluno_id/:auth_id", put(atualizar_status_medicamento))
        .route("/pedagogico/portfolio/:aluno_id", get(listar_portfolio_infantil))"""

content = content.replace(
    ".route(\"/pedagogico/portfolio\", post(registrar_portfolio_infantil))",
    ".route(\"/pedagogico/portfolio\", post(registrar_portfolio_infantil))\n" + new_routes
)

with open('src/routes.rs', 'w', encoding='utf-8') as f:
    f.write(content)
