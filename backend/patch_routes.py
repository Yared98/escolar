import os

with open('src/routes.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
content = content.replace(
    "sincronizar_diario_pwa,\n        },",
    "sincronizar_diario_pwa, registrar_portfolio_infantil,\n        },"
)

content = content.replace(
    "relatorios_operacionais_auditoria,\n        },",
    "relatorios_operacionais_auditoria, criar_autorizacao_medicamento,\n        },"
)

content = content.replace(
    "obter_turma, renumerar_chamada_turma, salvar_prontuario, transferir_aluno_turma,\n            vincular_responsavel_aluno,",
    "obter_turma, renumerar_chamada_turma, salvar_prontuario, transferir_aluno_turma,\n            vincular_responsavel_aluno, criar_autorizado_retirada, listar_autorizados_retirada,"
)

# Add routes
new_routes = """        .route("/atendimento/protocolos/:id/responder", post(responder_protocolo_atendimento))
        
        // Novas Rotas Escola Infantil (Goal)
        .route("/secretaria/alunos/:aluno_id/autorizados", post(criar_autorizado_retirada).get(listar_autorizados_retirada))
        .route("/agenda/medicamentos", post(criar_autorizacao_medicamento))
        .route("/pedagogico/portfolio", post(registrar_portfolio_infantil))"""

content = content.replace(
    ".route(\"/atendimento/protocolos/:id/responder\", post(responder_protocolo_atendimento))",
    new_routes
)

with open('src/routes.rs', 'w', encoding='utf-8') as f:
    f.write(content)

