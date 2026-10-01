import os

with open('src/routes.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
content = content.replace(
    "atualizar_evento_calendario, deletar_evento_calendario,\n        },",
    "atualizar_evento_calendario, deletar_evento_calendario, responder_rsvp, listar_rsvps_evento,\n        },"
)

# Add routes
new_routes = """        .route("/agenda/calendario/:evento_id/rsvp", post(responder_rsvp).get(listar_rsvps_evento))
        .route("/health", get(health_check))"""

content = content.replace(
    ".route(\"/health\", get(health_check))",
    new_routes
)

with open('src/routes.rs', 'w', encoding='utf-8') as f:
    f.write(content)
