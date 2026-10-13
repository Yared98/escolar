use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmailMode {
    Simulado,
}

impl std::fmt::Display for EmailMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EmailMode::Simulado => write!(f, "simulado"),
        }
    }
}

impl From<crate::config::EmailMode> for EmailMode {
    fn from(mode: crate::config::EmailMode) -> Self {
        match mode {
            crate::config::EmailMode::Simulado => EmailMode::Simulado,
        }
    }
}

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct EmailOutboxRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub destinatario: String,
    pub assunto: String,
    pub corpo: String,
    pub modo: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Adapter de envio de e-mail. Nesta versão só existe o modo `simulado`, que grava a mensagem
/// em `emails_saida` para que a gestão possa visualizar/repassar o link manualmente.
pub struct EmailAdapter {
    pub mode: EmailMode,
}

impl EmailAdapter {
    pub fn new(mode: EmailMode) -> Self {
        Self { mode }
    }

    pub async fn send(
        &self,
        executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
        tenant_id: Uuid,
        destinatario: &str,
        assunto: &str,
        corpo: &str,
    ) -> Result<Uuid, AppError> {
        match self.mode {
            EmailMode::Simulado => {
                self.gravar_simulado(executor, tenant_id, destinatario, assunto, corpo)
                    .await
            }
        }
    }

    async fn gravar_simulado(
        &self,
        executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
        tenant_id: Uuid,
        destinatario: &str,
        assunto: &str,
        corpo: &str,
    ) -> Result<Uuid, AppError> {
        let id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO emails_saida (id, tenant_id, destinatario, assunto, corpo, modo)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(id)
        .bind(tenant_id)
        .bind(destinatario)
        .bind(assunto)
        .bind(corpo)
        .bind(self.mode.to_string())
        .execute(executor)
        .await?;
        Ok(id)
    }
}

/// Envia um e-mail usando a conexão de tenant já configurada.
pub async fn enviar_email_simulado(
    conn: &mut sqlx::pool::PoolConnection<sqlx::Postgres>,
    tenant_id: Uuid,
    destinatario: &str,
    assunto: &str,
    corpo: &str,
) -> Result<Uuid, AppError> {
    let adapter = EmailAdapter::new(EmailMode::Simulado);
    adapter
        .send(&mut **conn, tenant_id, destinatario, assunto, corpo)
        .await
}

pub async fn listar_emails_saida(
    executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
    tenant_id: Uuid,
    limite: i64,
) -> Result<Vec<EmailOutboxRecord>, AppError> {
    let rows = sqlx::query_as::<_, EmailOutboxRecord>(
        r#"
        SELECT id, tenant_id, destinatario, assunto, corpo, modo, created_at
        FROM emails_saida
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
    )
    .bind(tenant_id)
    .bind(limite)
    .fetch_all(executor)
    .await?;
    Ok(rows)
}
