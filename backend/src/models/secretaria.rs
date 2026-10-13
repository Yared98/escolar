use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Aluno {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub nome: String,
    pub cpf: String,
    pub data_nascimento: NaiveDate,

    // Responsável Legal
    pub nome_responsavel: String,
    pub cpf_responsavel_legal: Option<String>,
    pub email_responsavel: String,
    pub telefone_responsavel: String,
    pub parentesco_responsavel_legal: Option<String>,

    // Responsável Financeiro & Flag de Unificação
    pub responsavel_financeiro_igual_legal: bool,
    pub nome_responsavel_financeiro: Option<String>,
    pub cpf_responsavel_financeiro: Option<String>,
    pub email_responsavel_financeiro: Option<String>,
    pub telefone_responsavel_financeiro: Option<String>,
    pub parentesco_responsavel_financeiro: Option<String>,

    // Endereço Residencial
    pub cep: Option<String>,
    pub logradouro: Option<String>,
    pub numero: Option<String>,
    pub complemento: Option<String>,
    pub bairro: Option<String>,
    pub cidade: Option<String>,
    pub estado: Option<String>,

    // Telefones de Contato & Emergência
    pub telefone_secundario: Option<String>,
    pub contato_emergencia_nome: Option<String>,
    pub contato_emergencia_telefone: Option<String>,
    pub contato_emergencia_parentesco: Option<String>,

    pub status: String,
    pub responsavel_user_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAlunoDto {
    pub nome: String,
    pub cpf: String,
    pub data_nascimento: NaiveDate,

    // Responsável Legal
    pub nome_responsavel: String,
    pub cpf_responsavel_legal: Option<String>,
    pub email_responsavel: String,
    pub telefone_responsavel: String,
    pub parentesco_responsavel_legal: Option<String>,

    // Responsável Financeiro
    #[serde(default = "default_true")]
    pub responsavel_financeiro_igual_legal: bool,
    pub nome_responsavel_financeiro: Option<String>,
    pub cpf_responsavel_financeiro: Option<String>,
    pub email_responsavel_financeiro: Option<String>,
    pub telefone_responsavel_financeiro: Option<String>,
    pub parentesco_responsavel_financeiro: Option<String>,

    // Endereço
    pub cep: Option<String>,
    pub logradouro: Option<String>,
    pub numero: Option<String>,
    pub complemento: Option<String>,
    pub bairro: Option<String>,
    pub cidade: Option<String>,
    pub estado: Option<String>,

    // Contato & Emergência
    pub telefone_secundario: Option<String>,
    pub contato_emergencia_nome: Option<String>,
    pub contato_emergencia_telefone: Option<String>,
    pub contato_emergencia_parentesco: Option<String>,

    pub responsavel_user_id: Option<Uuid>,

    /// Ciclo de vida inicial: `pre_matricula` | `ativo` (padrão `ativo`).
    pub status: Option<String>,

    // Prontuário Inicial Opcional
    pub tipo_sanguineo: Option<String>,
    pub alergias: Option<String>,
    pub restricoes_alimentares: Option<String>,
    pub medicamentos_continuos: Option<String>,
    pub cuidados_especiais: Option<String>,
    pub historico_observacoes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAlunoDto {
    pub nome: Option<String>,
    pub cpf: Option<String>,
    pub data_nascimento: Option<NaiveDate>,

    pub nome_responsavel: Option<String>,
    pub cpf_responsavel_legal: Option<String>,
    pub email_responsavel: Option<String>,
    pub telefone_responsavel: Option<String>,
    pub parentesco_responsavel_legal: Option<String>,

    pub responsavel_financeiro_igual_legal: Option<bool>,
    pub nome_responsavel_financeiro: Option<String>,
    pub cpf_responsavel_financeiro: Option<String>,
    pub email_responsavel_financeiro: Option<String>,
    pub telefone_responsavel_financeiro: Option<String>,
    pub parentesco_responsavel_financeiro: Option<String>,

    pub cep: Option<String>,
    pub logradouro: Option<String>,
    pub numero: Option<String>,
    pub complemento: Option<String>,
    pub bairro: Option<String>,
    pub cidade: Option<String>,
    pub estado: Option<String>,

    pub telefone_secundario: Option<String>,
    pub contato_emergencia_nome: Option<String>,
    pub contato_emergencia_telefone: Option<String>,
    pub contato_emergencia_parentesco: Option<String>,

    pub status: Option<String>,
    pub responsavel_user_id: Option<Uuid>,
}

/// Status válidos do ciclo de vida do aluno na secretaria.
pub const STATUS_ALUNO_VALIDOS: &[&str] = &[
    "pre_matricula",
    "ativo",
    "trancado",
    "transferido",
    "inativo",
];

#[derive(Debug, Deserialize)]
pub struct ListAlunosQuery {
    /// Busca textual (nome, CPF, responsáveis, cidade).
    pub q: Option<String>,
    /// `pre_matricula` | `ativo` | `trancado` | `transferido` | `inativo` | `todos`.
    /// Omitido = todos (consumidores devem filtrar explicitamente).
    pub status: Option<String>,
    pub turma_id: Option<Uuid>,
    /// Quando true, retorna apenas alunos sem vínculo ativo em turma.
    pub sem_turma: Option<bool>,
    pub ano_letivo: Option<i32>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlunoListItem {
    #[serde(flatten)]
    pub aluno: Aluno,
    pub turma_atual_id: Option<Uuid>,
    pub turma_atual_nome: Option<String>,
    pub turma_atual_codigo: Option<String>,
    pub numero_chamada: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlunoStatusContagem {
    pub status: String,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlunosPage {
    pub items: Vec<AlunoListItem>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub contagem_status: Vec<AlunoStatusContagem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Prontuario {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub tipo_sanguineo: Option<String>,
    pub alergias: Option<String>,
    pub restricoes_alimentares: Option<String>,
    pub medicamentos_continuos: Option<String>,
    pub cuidados_especiais: Option<String>,
    pub historico_observacoes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SalvarProntuarioDto {
    pub tipo_sanguineo: Option<String>,
    pub alergias: Option<String>,
    pub restricoes_alimentares: Option<String>,
    pub medicamentos_continuos: Option<String>,
    pub cuidados_especiais: Option<String>,
    pub historico_observacoes: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ResponsavelAluno {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub responsavel_user_id: Uuid,
    pub aluno_id: Uuid,
    pub parentesco: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct VincularResponsavelDto {
    pub responsavel_user_id: Uuid,
    pub aluno_id: Uuid,
    pub parentesco: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Contrato {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub ano_letivo: i32,
    pub valor_total: f64,
    pub status: String,
    pub hash_documento: Option<String>,
    pub assinado_em: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateContratoDto {
    pub aluno_id: Uuid,
    pub ano_letivo: i32,
    pub valor_total: f64,
}

#[derive(Debug, Deserialize)]
pub struct AssinarContratoDto {
    pub aceite_termos: bool,
}

#[derive(Debug, Deserialize)]
pub struct ListContratosQuery {
    pub aluno_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContratoListItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub ano_letivo: i32,
    pub valor_total: f64,
    pub status: String,
    pub hash_documento: Option<String>,
    pub assinado_em: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub aluno_nome: Option<String>,
    pub aluno_cpf: Option<String>,
    pub total_parcelas: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContratoDetalhado {
    #[serde(flatten)]
    pub contrato: ContratoListItem,
    pub parcelas: Vec<crate::models::financeiro::Fatura>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Sala {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub nome: String,
    pub capacidade: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSalaDto {
    pub nome: String,
    pub capacidade: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Turma {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub sala_id: Option<Uuid>,
    pub codigo: Option<String>,
    pub nome: String,
    pub etapa_ensino: String,
    pub serie: Option<String>,
    pub turno: String,
    pub ano_letivo: i32,
    pub capacidade_maxima: i32,
    pub professor_regente_id: Option<Uuid>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurmaDetalhada {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub sala_id: Option<Uuid>,
    pub sala_nome: Option<String>,
    pub codigo: Option<String>,
    pub nome: String,
    pub etapa_ensino: String,
    pub serie: Option<String>,
    pub turno: String,
    pub ano_letivo: i32,
    pub capacidade_maxima: i32,
    pub professor_regente_id: Option<Uuid>,
    pub professor_regente_nome: Option<String>,
    pub status: String,
    pub alunos_matriculados: i64,
    pub vagas_restantes: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTurmaDto {
    pub sala_id: Option<Uuid>,
    pub codigo: Option<String>,
    pub nome: String,
    pub etapa_ensino: Option<String>,
    pub serie: Option<String>,
    pub turno: Option<String>,
    pub ano_letivo: i32,
    pub capacidade_maxima: Option<i32>,
    pub professor_regente_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTurmaDto {
    pub sala_id: Option<Uuid>,
    pub codigo: Option<String>,
    pub nome: Option<String>,
    pub etapa_ensino: Option<String>,
    pub serie: Option<String>,
    pub turno: Option<String>,
    pub ano_letivo: Option<i32>,
    pub capacidade_maxima: Option<i32>,
    pub professor_regente_id: Option<Uuid>,
    pub status: Option<String>,
}

fn deserialize_optional_i32<'de, D>(deserializer: D) -> Result<Option<i32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum IntOrString {
        Int(i32),
        String(String),
    }

    match Option::<IntOrString>::deserialize(deserializer)? {
        None => Ok(None),
        Some(IntOrString::Int(n)) => Ok(Some(n)),
        Some(IntOrString::String(s)) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                trimmed
                    .parse::<i32>()
                    .map(Some)
                    .map_err(serde::de::Error::custom)
            }
        }
    }
}

#[derive(Debug, Deserialize, Default)]
pub struct ListTurmasQuery {
    /// Busca textual (nome, código, série, etapa de ensino).
    pub q: Option<String>,
    pub busca: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_i32")]
    pub ano_letivo: Option<i32>,
    pub turno: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TurmaAluno {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub turma_id: Uuid,
    pub aluno_id: Uuid,
    pub numero_chamada: Option<i32>,
    pub data_matricula: NaiveDate,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlunoTurmaDetalhado {
    pub id: Uuid,
    pub aluno_id: Uuid,
    pub nome: String,
    pub cpf: String,
    pub data_nascimento: NaiveDate,
    pub numero_chamada: Option<i32>,
    pub nome_responsavel: String,
    pub telefone_responsavel: String,
    pub status: String,
    pub data_matricula: NaiveDate,
    pub responsavel_user_id: Option<Uuid>,
    pub responsavel_nome: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MatricularTurmaDto {
    pub turma_id: Uuid,
    pub aluno_id: Uuid,
    pub numero_chamada: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct TransferirAlunoTurmaDto {
    pub aluno_id: Uuid,
    pub turma_origem_id: Uuid,
    pub turma_destino_id: Uuid,
}

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
