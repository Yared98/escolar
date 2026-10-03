pub async fn is_feature_enabled<'e, E>(
    executor: E,
    tenant_id: uuid::Uuid,
    feature_name: &str,
) -> Result<bool, sqlx::Error>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    let result = sqlx::query_scalar::<_, bool>(
        "SELECT is_enabled FROM tenant_feature_flags WHERE tenant_id = $1 AND feature_name = $2",
    )
    .bind(tenant_id)
    .bind(feature_name)
    .fetch_optional(executor)
    .await?;

    Ok(result.unwrap_or(false))
}
