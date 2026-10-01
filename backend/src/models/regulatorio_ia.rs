use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DiplomaDigital {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub curso_nome: String,
    pub xml_diplomado: String,
    pub xml_documentacao: String,
    pub rvdd_pdf_url: Option<String>,
    pub hash_xades: String,
    pub carimbo_tempo: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub codigo_validacao: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EmitirDiplomaDto {
    pub curso_nome: Option<String>,
    pub livro_registro: Option<String>,
    pub folha_registro: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmitirDiplomaResponse {
    pub diploma_id: String,
    pub hash_xades: String,
    pub qr_code_validacao_url: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidarDiplomaResponse {
    pub valido: bool,
    pub status: String,
    pub diploma_id: Option<Uuid>,
    pub aluno_nome: Option<String>,
    pub cpf: Option<String>,
    pub curso_nome: Option<String>,
    pub hash_xades: Option<String>,
    pub carimbo_tempo: Option<DateTime<Utc>>,
    pub data_emissao: Option<DateTime<Utc>>,
    pub integridade_verificada: bool,
    pub mensagem: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AnaliseEvasaoLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub score_risco_evasao: f64,
    pub fator_principal: String,
    pub calculado_em: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DetalhesEvasao {
    pub faturas_atrasadas: i64,
    pub frequencia_ultimos_30_dias: f64,
    pub media_disciplinas: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PredizerEvasaoResponse {
    pub aluno_id: Uuid,
    pub score_risco_evasao: f64,
    pub nivel_urgencia: String,
    pub fator_principal: String,
    pub detalhes: DetalhesEvasao,
    pub recomendacao: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EducacensoExportResponse {
    pub status: String,
    pub versao_layout_inep: String,
    pub total_alunos_validados: usize,
    pub total_turmas_validadas: usize,
    pub total_professores_validados: usize,
    pub erros_validacao: Vec<String>,
    pub arquivo_exportado_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conteudo_arquivo_amostra: Option<String>,
}

#[allow(dead_code)]
pub type EducacensoExportDto = EducacensoExportResponse;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LgpdTermo {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub responsavel_user_id: Option<Uuid>,
    pub consentimento_responsavel: bool,
    pub data_aceite: DateTime<Utc>,
    pub versao_termo: String,
    pub ip_subscritor: Option<String>,
    pub hash_termo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrarConsentimentoLgpdDto {
    pub aluno_id: Uuid,
    pub consentimento_responsavel: bool,
    pub versao_termo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidarAcessoPerimetralDto {
    pub tipo_identificador: String,
    pub codigo: String,
    pub direcao: Option<String>,
    pub ponto_acesso: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ValidarAcessoPerimetralResponse {
    pub acesso_permitido: bool,
    pub nome_aluno: Option<String>,
    pub turma: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motivo_bloqueio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadastrarCredencialPerimetralDto {
    pub aluno_id: Uuid,
    pub tipo_identificador: Option<String>,
    pub codigo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PerimetroCredencial {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub tipo_identificador: String,
    pub codigo: String,
    pub ativo: bool,
    pub created_at: DateTime<Utc>,
}
