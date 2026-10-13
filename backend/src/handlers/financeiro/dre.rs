use super::*;

/// Estimativa de recuperação de inadimplência usada no DFC projetado (MVP).
/// Indicador gerencial: assume que ~40% das faturas atrasadas voltam a entrar
/// como caixa futuro. Não é previsão contábil/fiscal.
pub const FATOR_RECUPERACAO_INADIMPLENCIA: f64 = 0.4;

/// Fatura está atrasada quando está marcada como 'atrasado' ou está 'pendente'
/// com data de vencimento anterior à data de referência. Pagas/canceladas não entram.
pub fn fatura_esta_atrasada(fatura: &Fatura, hoje: chrono::NaiveDate) -> bool {
    match fatura.status.as_str() {
        "atrasado" => true,
        "pendente" => fatura.data_vencimento < hoje,
        _ => false,
    }
}

/// Calcula o total e a quantidade de faturas atrasadas de forma pura,
/// recebendo a lista e a data de referência.
pub fn calcular_inadimplencia(faturas: &[Fatura], hoje: chrono::NaiveDate) -> (f64, usize) {
    let mut total = 0.0;
    let mut count = 0usize;
    for fatura in faturas {
        if fatura_esta_atrasada(fatura, hoje) {
            total += fatura.valor;
            count += 1;
        }
    }
    (total, count)
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct FiltroDreQuery {
    pub ano: Option<i32>,
    pub mes: Option<i32>,
    pub data_inicio: Option<chrono::NaiveDate>,
    pub data_fim: Option<chrono::NaiveDate>,
}

pub async fn relatorio_dre(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<FiltroDreQuery>,
) -> Result<Json<DreReportDto>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let (data_inicio, data_fim) = match (query.data_inicio, query.data_fim) {
        (Some(i), Some(f)) => (Some(i), Some(f)),
        _ => match (query.ano, query.mes) {
            (Some(ano), Some(mes)) => {
                let start = chrono::NaiveDate::from_ymd_opt(ano, mes as u32, 1).unwrap_or_default();
                let end = if mes == 12 {
                    chrono::NaiveDate::from_ymd_opt(ano + 1, 1, 1).unwrap_or_default()
                        - chrono::Duration::days(1)
                } else {
                    chrono::NaiveDate::from_ymd_opt(ano, (mes + 1) as u32, 1).unwrap_or_default()
                        - chrono::Duration::days(1)
                };
                (Some(start), Some(end))
            }
            (Some(ano), None) => {
                let start = chrono::NaiveDate::from_ymd_opt(ano, 1, 1).unwrap_or_default();
                let end = chrono::NaiveDate::from_ymd_opt(ano, 12, 31).unwrap_or_default();
                (Some(start), Some(end))
            }
            _ => (None, None),
        },
    };

    let metricas_faturas: (Option<f64>, Option<f64>, i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT
            SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as receita_bruta,
            SUM(CASE WHEN (status = 'atrasado' OR (status = 'pendente' AND data_vencimento < CURRENT_DATE)) THEN valor ELSE 0 END) as inadimplencia,
            COUNT(CASE WHEN status = 'pago' THEN 1 END) as total_pagas,
            COUNT(CASE WHEN (status = 'pendente' OR status = 'atrasado') THEN 1 END) as total_pendentes,
            COUNT(CASE WHEN (status = 'atrasado' OR (status = 'pendente' AND data_vencimento < CURRENT_DATE)) THEN 1 END) as total_atrasadas
        FROM faturas
        WHERE tenant_id = $1
          AND ($2::date IS NULL OR data_vencimento >= $2)
          AND ($3::date IS NULL OR data_vencimento <= $3)
        "#
    )
    .bind(tenant_id)
    .bind(data_inicio)
    .bind(data_fim)
    .fetch_one(&mut *db)
    .await?;

    let despesas_totais: Option<f64> = sqlx::query_scalar(
        r#"
        SELECT SUM(valor)
        FROM despesas
        WHERE tenant_id = $1
          AND status NOT IN ('cancelado', 'estornada')
          AND ($2::date IS NULL OR data_vencimento >= $2)
          AND ($3::date IS NULL OR data_vencimento <= $3)
        "#,
    )
    .bind(tenant_id)
    .bind(data_inicio)
    .bind(data_fim)
    .fetch_one(&mut *db)
    .await?;

    let receita_bruta = metricas_faturas.0.unwrap_or(0.0);
    let inadimplencia_total = metricas_faturas.1.unwrap_or(0.0);
    let total_pagas = metricas_faturas.2;
    let total_pendentes = metricas_faturas.3;
    let total_atrasadas = metricas_faturas.4;
    let despesas_totais = despesas_totais.unwrap_or(0.0);

    let resultado_liquido = ((receita_bruta - despesas_totais) * 100.0).round() / 100.0;
    let dfc_caixa_projetado =
        ((resultado_liquido + (inadimplencia_total * FATOR_RECUPERACAO_INADIMPLENCIA)) * 100.0)
            .round()
            / 100.0;

    Ok(Json(DreReportDto {
        receita_bruta: (receita_bruta * 100.0).round() / 100.0,
        despesas_totais: (despesas_totais * 100.0).round() / 100.0,
        resultado_liquido,
        inadimplencia_total: (inadimplencia_total * 100.0).round() / 100.0,
        total_faturas_pagas: total_pagas,
        total_faturas_pendentes: total_pendentes,
        total_faturas_atrasadas: total_atrasadas,
        dfc_caixa_projetado,
    }))
}
