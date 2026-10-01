import os
import re

with open('backend/src/models/agenda_admin.rs', 'r', encoding='utf-8') as f:
    content = f.read()

bad = """pub struct CreateEventoCalendarioDto {
    pub turma_id: Option<Uuid>,
    pub titulo: String,
    pub descricao: Option<String>,
    pub data_inicio: chrono::NaiveDate,
    pub data_fim: chrono::NaiveDate,
    pub tipo: String,
    pub visibilidade: String,
    pub exige_confirmacao: Option<bool>,
}"""

good = """pub struct CreateEventoCalendarioDto {
    #[serde(default)]
    pub turma_id: Option<Uuid>,
    pub titulo: String,
    #[serde(default)]
    pub descricao: Option<String>,
    pub data_inicio: chrono::NaiveDate,
    pub data_fim: chrono::NaiveDate,
    pub tipo: String,
    pub visibilidade: String,
    #[serde(default)]
    pub exige_confirmacao: Option<bool>,
}"""

content = content.replace(bad, good)

with open('backend/src/models/agenda_admin.rs', 'w', encoding='utf-8') as f:
    f.write(content)
