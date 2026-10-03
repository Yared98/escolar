use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Funcionario {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub nome: String,
    pub cpf: String,
    pub cargo: String,
    pub departamento: String,
    pub data_admissao: NaiveDate,
    pub salario: f64,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFuncionarioDto {
    pub nome: String,
    pub cpf: String,
    pub cargo: String,
    pub departamento: String,
    pub data_admissao: NaiveDate,
    pub salario: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFuncionarioDto {
    pub nome: Option<String>,
    pub cpf: Option<String>,
    pub cargo: Option<String>,
    pub departamento: Option<String>,
    pub salario: Option<f64>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Fornecedor {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub razao_social: String,
    pub cnpj: String,
    pub ramo_atividade: String,
    pub email: String,
    pub telefone: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFornecedorDto {
    pub razao_social: String,
    pub cnpj: String,
    pub ramo_atividade: String,
    pub email: String,
    pub telefone: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFornecedorDto {
    pub razao_social: Option<String>,
    pub cnpj: Option<String>,
    pub ramo_atividade: Option<String>,
    pub email: Option<String>,
    pub telefone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Option<Uuid>,
    pub acao: String,
    pub entidade: String,
    pub entidade_id: Option<String>,
    pub ip_origem: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MensagemAgenda {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub remetente_id: Uuid,
    pub destinatario_id: Option<Uuid>,
    pub turma_id: Option<Uuid>,
    pub canal: String,
    pub titulo: String,
    pub conteudo: String,
    pub anexo_url: Option<String>,
    pub lida: bool,
    pub created_at: DateTime<Utc>,
    pub resposta_a_id: Option<Uuid>,
    pub thread_id: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MensagemAgendaView {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub remetente_id: Uuid,
    pub destinatario_id: Option<Uuid>,
    pub turma_id: Option<Uuid>,
    pub canal: String,
    pub titulo: String,
    pub conteudo: String,
    pub anexo_url: Option<String>,
    pub lida: bool,
    pub created_at: DateTime<Utc>,
    pub resposta_a_id: Option<Uuid>,
    pub thread_id: Option<Uuid>,
    pub remetente_nome: Option<String>,
    pub remetente_role: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMensagemAgendaDto {
    pub destinatario_id: Option<Uuid>,
    pub aluno_id: Option<Uuid>,
    pub turma_id: Option<Uuid>,
    pub resposta_a_id: Option<Uuid>,
    pub canal: String,
    pub titulo: String,
    pub conteudo: String,
    pub anexo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RotinaDiariaInfantil {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub data: NaiveDate,
    pub refeicao_status: String,
    pub sono_minutos: i32,
    pub fraldas_trocas: i32,
    pub humor: String,
    pub medicamento_ministrado: Option<String>,
    pub observacao_pedagogica: Option<String>,
    pub created_at: DateTime<Utc>,
    pub refeicoes: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefeicaoRotinaItem {
    pub tipo_refeicao: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRotinaDiariaDto {
    pub aluno_id: Uuid,
    pub data: Option<NaiveDate>,
    pub refeicao_status: String,
    pub sono_minutos: i32,
    pub fraldas_trocas: i32,
    pub humor: String,
    pub medicamento_ministrado: Option<String>,
    pub observacao_pedagogica: Option<String>,
    pub refeicoes: Option<Vec<RefeicaoRotinaItem>>,
}

#[derive(Debug, Deserialize)]
pub struct DiarioInfantilQuery {
    pub data: NaiveDate,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OcorrenciaAluno {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub professor_id: Uuid,
    pub turma_id: Option<Uuid>,
    pub tipo_ocorrencia: String,
    pub descricao: String,
    pub prioridade: String,
    pub notificado_responsavel: bool,
    pub lido_pelo_responsavel: bool,
    pub lido_em: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOcorrenciaDto {
    pub aluno_id: Uuid,
    pub turma_id: Option<Uuid>,
    pub tipo_ocorrencia: String,
    pub descricao: String,
    pub prioridade: Option<String>,
}

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
    pub exige_confirmacao: bool,
    pub criado_por: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEventoCalendarioDto {
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateEventoCalendarioDto {
    pub titulo: String,
    pub descricao: Option<String>,
    pub data_inicio: chrono::NaiveDate,
    pub data_fim: chrono::NaiveDate,
    pub tipo: String,
    pub visibilidade: String,
    pub exige_confirmacao: Option<bool>,
}

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
