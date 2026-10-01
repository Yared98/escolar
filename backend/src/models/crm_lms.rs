use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Lead {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub nome: String,
    pub email: String,
    pub telefone: String,
    pub estagio_funil: String,
    pub custo_aquisicao: f64,
    pub canal_aquisicao: Option<String>,
    pub observacoes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateLeadDto {
    pub nome: String,
    pub email: String,
    pub telefone: String,
    pub estagio_funil: Option<String>,
    pub custo_aquisicao: Option<f64>,
    pub canal_aquisicao: Option<String>,
    pub observacoes: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateLeadDto {
    pub nome: Option<String>,
    pub email: Option<String>,
    pub telefone: Option<String>,
    pub estagio_funil: Option<String>,
    pub custo_aquisicao: Option<f64>,
    pub canal_aquisicao: Option<String>,
    pub observacoes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LeadInteracao {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub lead_id: Uuid,
    pub tipo: String,
    pub descricao: String,
    pub usuario_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateInteracaoDto {
    pub tipo: String,
    pub descricao: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RelatorioFunilResponse {
    pub total_leads: i64,
    pub novo_lead: i64,
    pub visita_agendada: i64,
    pub proposta_enviada: i64,
    pub matriculado: i64,
    pub perdido: i64,
    pub taxa_conversao_pct: f64,
    pub custo_total_aquisicao: f64,
    pub cac_medio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LmsConfig {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub lms_type: String,
    pub client_id: String,
    pub platform_url: String,
    pub lti_version: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SaveLmsConfigDto {
    pub lms_type: String, // moodle, canvas, google_classroom
    pub client_id: String,
    pub platform_url: String,
    pub lti_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LtiLaunchResponse {
    pub status: String,
    pub lti_version: String,
    pub launch_url: String,
    pub jwt_target_link: String,
    pub user_id: Uuid,
    pub role: String,
    pub state_token: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct LtiGradeSyncDto {
    pub aluno_id: Uuid,
    pub disciplina_nome: String,
    pub atividade_nome: String,
    pub nota: f64,
    pub periodo: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ScormTrackDto {
    pub aluno_id: Uuid,
    pub package_id: String,
    pub lesson_status: String, // 'passed', 'completed', 'failed', 'incomplete', 'browsed'
    pub score_raw: Option<f64>,
    pub score_min: Option<f64>,
    pub score_max: Option<f64>,
    pub session_time: Option<String>,
    pub suspend_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScormTrackingRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub package_id: String,
    pub lesson_status: String,
    pub score_raw: Option<f64>,
    pub score_min: Option<f64>,
    pub score_max: Option<f64>,
    pub session_time: Option<String>,
    pub suspend_data: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct WhatsAppIncomingPayload {
    pub from: Option<String>,
    pub text: Option<Value>,
    pub message: Option<String>,
    pub message_id: Option<String>,
    pub entry: Option<Value>,
    pub tenant_id: Option<Uuid>,
    pub tenant_slug: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WhatsAppVerifyParams {
    #[serde(rename = "hub.mode")]
    pub hub_mode: Option<String>,
    #[serde(rename = "hub.verify_token")]
    pub hub_verify_token: Option<String>,
    #[serde(rename = "hub.challenge")]
    pub hub_challenge: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AtendimentoProtocolo {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub protocolo: String,
    pub telefone_contato: String,
    pub aluno_id: Option<Uuid>,
    pub assunto: String,
    pub status: String,
    pub setor_transbordo: Option<String>,
    pub ultima_mensagem: Option<String>,
    pub resposta_enviada: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ResponderProtocoloDto {
    pub resposta: String,
}
