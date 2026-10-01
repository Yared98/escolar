use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificacaoSistema {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub destinatario_id: Option<Uuid>,
    pub aluno_id: Option<Uuid>,
    pub modulo: String,
    pub titulo: String,
    pub mensagem: String,
    pub prioridade: String,
    pub lida: bool,
    pub canal_disparo: String,
    pub created_at: DateTime<Utc>,
    pub status_processamento: String,
    pub tentativas: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateNotificacaoDto {
    pub destinatario_id: Option<Uuid>,
    pub aluno_id: Option<Uuid>,
    pub modulo: String,
    pub titulo: String,
    pub mensagem: String,
    pub prioridade: Option<String>,
    pub canal_disparo: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PushSubscriptionDto {
    pub endpoint: String,
    pub keys: PushKeysDto,
}

#[derive(Debug, Deserialize)]
pub struct PushKeysDto {
    pub p256dh: String,
    pub auth: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificacaoDisparoLog {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub notificacao_id: Option<Uuid>,
    pub canal: String,
    pub destino: String,
    pub status_envio: String,
    pub disparado_em: DateTime<Utc>,
}
