import os

agenda_models = """
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EventoCalendario {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub turma_id: Option<Uuid>,
    pub titulo: String,
    pub descricao: Option<String>,
    pub data_inicio: chrono::NaiveDate,
    pub data_fim: chrono::NaiveDate,
    pub tipo: String,
    pub visibilidade: String,
    pub criado_por: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEventoCalendarioDto {
    pub turma_id: Option<Uuid>,
    pub titulo: String,
    pub descricao: Option<String>,
    pub data_inicio: chrono::NaiveDate,
    pub data_fim: chrono::NaiveDate,
    pub tipo: String,
    pub visibilidade: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateEventoCalendarioDto {
    pub titulo: String,
    pub descricao: Option<String>,
    pub data_inicio: chrono::NaiveDate,
    pub data_fim: chrono::NaiveDate,
    pub tipo: String,
    pub visibilidade: String,
}
"""

with open('src/models/agenda_admin.rs', 'a', encoding='utf-8') as f:
    f.write(agenda_models)
