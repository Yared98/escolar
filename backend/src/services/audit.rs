use uuid::Uuid;

pub async fn log_audit(
    executor: impl sqlx::Executor<'_, Database = sqlx::Postgres>,
    tenant_id: Uuid,
    user_id: Option<Uuid>,
    acao: &str,
    entidade: &str,
    entidade_id: Option<String>,
    detalhes: Option<serde_json::Value>,
) {
    let _ = sqlx::query(
        r#"
        INSERT INTO audit_logs (tenant_id, user_id, acao, entidade, entidade_id, detalhes_json)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(tenant_id)
    .bind(user_id)
    .bind(acao)
    .bind(entidade)
    .bind(entidade_id)
    .bind(detalhes.unwrap_or_else(|| serde_json::json!({})))
    .execute(executor)
    .await;
}
