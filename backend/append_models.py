import os

secretaria_models = """
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AutorizadoRetirada {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub nome: String,
    pub rg_cpf: String,
    pub grau_parentesco: String,
    pub foto_url: Option<String>,
    pub telefone: Option<String>,
    pub autorizado_por: Uuid,
    pub ativo: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAutorizadoRetiradaDto {
    pub aluno_id: Uuid,
    pub nome: String,
    pub rg_cpf: String,
    pub grau_parentesco: String,
    pub foto_url: Option<String>,
    pub telefone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GrupoFamiliar {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub responsavel_financeiro_id: Uuid,
    pub nome_familia: String,
    pub desconto_percentual: f64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGrupoFamiliarDto {
    pub responsavel_financeiro_id: Uuid,
    pub nome_familia: String,
    pub desconto_percentual: f64,
}
"""

with open('src/models/secretaria.rs', 'a', encoding='utf-8') as f:
    f.write(secretaria_models)

agenda_models = """
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AutorizacaoMedicamento {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub responsavel_id: Uuid,
    pub medicamento: String,
    pub dosagem: String,
    pub horario_aplicacao: String,
    pub receita_medica_url: Option<String>,
    pub observacoes: Option<String>,
    pub data_inicio: chrono::NaiveDate,
    pub data_fim: chrono::NaiveDate,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAutorizacaoMedicamentoDto {
    pub aluno_id: Uuid,
    pub medicamento: String,
    pub dosagem: String,
    pub horario_aplicacao: String,
    pub receita_medica_url: Option<String>,
    pub observacoes: Option<String>,
    pub data_inicio: chrono::NaiveDate,
    pub data_fim: chrono::NaiveDate,
}
"""

with open('src/models/agenda_admin.rs', 'a', encoding='utf-8') as f:
    f.write(agenda_models)

academico_models = """
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PortfolioInfantil {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub professor_id: Uuid,
    pub turma_id: Option<Uuid>,
    pub data_registro: chrono::NaiveDate,
    pub titulo: String,
    pub descricao: String,
    pub midia_url: Option<String>,
    pub campos_experiencia_bncc: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePortfolioInfantilDto {
    pub aluno_id: Uuid,
    pub turma_id: Option<Uuid>,
    pub data_registro: Option<chrono::NaiveDate>,
    pub titulo: String,
    pub descricao: String,
    pub midia_url: Option<String>,
    pub campos_experiencia_bncc: Option<String>,
}
"""

with open('src/models/academico.rs', 'a', encoding='utf-8') as f:
    f.write(academico_models)

