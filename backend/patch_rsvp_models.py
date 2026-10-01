import os
import re

with open('src/models/agenda_admin.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Add exige_confirmacao to EventoCalendario
content = content.replace(
    "pub visibilidade: String,\n    pub criado_por: Uuid,",
    "pub visibilidade: String,\n    pub exige_confirmacao: bool,\n    pub criado_por: Uuid,"
)

# Add exige_confirmacao to CreateEventoCalendarioDto
content = content.replace(
    "pub visibilidade: String,\n}",
    "pub visibilidade: String,\n    pub exige_confirmacao: Option<bool>,\n}"
)

# Add exige_confirmacao to UpdateEventoCalendarioDto
content = content.replace(
    "pub visibilidade: String,\n}",
    "pub visibilidade: String,\n    pub exige_confirmacao: Option<bool>,\n}"
)

# Append EventoRsvp models
rsvp_models = """
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EventoRsvp {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub evento_id: Uuid,
    pub usuario_id: Uuid,
    pub status: String,
    pub acompanhantes: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertRsvpDto {
    pub status: String,
    pub acompanhantes: i32,
}
"""

with open('src/models/agenda_admin.rs', 'w', encoding='utf-8') as f:
    f.write(content + rsvp_models)
