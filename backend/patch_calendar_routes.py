import os

with open('src/routes.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
content = content.replace(
    "relatorios_operacionais_auditoria, criar_autorizacao_medicamento, listar_autorizacoes_medicamento, atualizar_status_medicamento,\n        },",
    "relatorios_operacionais_auditoria, criar_autorizacao_medicamento, listar_autorizacoes_medicamento, atualizar_status_medicamento, criar_evento_calendario, listar_eventos_calendario, atualizar_evento_calendario, deletar_evento_calendario,\n        },"
)

# Add routes
new_routes = """        .route("/agenda/calendario", post(criar_evento_calendario).get(listar_eventos_calendario))
        .route("/agenda/calendario/:evento_id", put(atualizar_evento_calendario).delete(deletar_evento_calendario))
        .route("/health", get(health_check))"""

content = content.replace(
    ".route(\"/health\", get(health_check))",
    new_routes
)

with open('src/routes.rs', 'w', encoding='utf-8') as f:
    f.write(content)
