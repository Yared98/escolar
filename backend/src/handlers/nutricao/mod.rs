use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::{Datelike, Duration, NaiveDate, Utc};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::{Acquire, Row};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::academico::{EditarCardapioDto, Prato, RecorrenciaCardapioDto, UpsertPratoDto},
};

#[derive(Debug, sqlx::FromRow)]
struct Cobertura {
    titulo: String,
    data_inicio: NaiveDate,
    data_fim: NaiveDate,
}

#[derive(Debug, sqlx::FromRow)]
struct CardapioOcupado {
    data_dia: NaiveDate,
    turma_id: Option<Uuid>,
    titulo_menu: String,
}

#[derive(Serialize)]
struct PreviaDia {
    data: NaiveDate,
    conflito: bool,
    feriado: Option<String>,
    motivo: Option<String>,
}

fn hoje_escola() -> NaiveDate {
    (Utc::now() - Duration::hours(3)).date_naive()
}

fn validar_vigencia(inicio: NaiveDate, fim: NaiveDate, dias: &[i16]) -> Result<(), AppError> {
    if fim < inicio {
        return Err(AppError::BadRequest(
            "A vigência termina antes de começar.".into(),
        ));
    }
    if (fim - inicio).num_days() > 180 {
        return Err(AppError::BadRequest(
            "A vigência aceita no máximo 180 dias.".into(),
        ));
    }
    if dias.is_empty() || dias.iter().any(|dia| !(1_i16..=7).contains(dia)) {
        return Err(AppError::BadRequest(
            "Escolha ao menos um dia da semana, de segunda a domingo.".into(),
        ));
    }
    Ok(())
}

fn datas_da_vigencia(inicio: NaiveDate, fim: NaiveDate, dias: &[i16]) -> Vec<NaiveDate> {
    let mut cursor = inicio;
    let mut datas = Vec::new();
    while cursor <= fim {
        let iso = cursor.weekday().number_from_monday() as i16;
        if dias.contains(&iso) {
            datas.push(cursor);
        }
        cursor = match cursor.succ_opt() {
            Some(proxima) => proxima,
            None => break,
        };
    }
    datas
}

fn semana_ano(data: NaiveDate) -> String {
    let semana = data.iso_week();
    format!("Semana {}/{}", semana.week(), semana.year())
}

fn conflita(ocupado: &CardapioOcupado, turma_nova: Option<Uuid>) -> bool {
    ocupado.turma_id == turma_nova || ocupado.turma_id.is_none() || turma_nova.is_none()
}

async fn nutricionista_ativo(
    db: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    nutricionista_id: Uuid,
) -> Result<String, AppError> {
    sqlx::query_scalar::<_, String>(
        "SELECT nome FROM funcionarios WHERE id = $1 AND tenant_id = $2 AND status = 'ativo'",
    )
    .bind(nutricionista_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Nutricionista inativo ou não cadastrado no RH deste tenant.".into())
    })
}

async fn coberturas(
    db: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    inicio: NaiveDate,
    fim: NaiveDate,
    turma_id: Option<Uuid>,
) -> Result<Vec<Cobertura>, AppError> {
    let rows = sqlx::query_as::<_, Cobertura>(
        r#"
        SELECT titulo, data_inicio, data_fim
        FROM eventos_calendario
        WHERE tenant_id = $1
          AND tipo IN ('feriado', 'ferias')
          AND data_inicio <= $3
          AND data_fim >= $2
          AND (turma_id IS NULL OR turma_id = $4)
        "#,
    )
    .bind(tenant_id)
    .bind(inicio)
    .bind(fim)
    .bind(turma_id)
    .fetch_all(&mut *db)
    .await?;
    Ok(rows)
}

async fn ocupados(
    db: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    datas: &[NaiveDate],
    tipo_refeicao: &str,
) -> Result<Vec<CardapioOcupado>, AppError> {
    if datas.is_empty() {
        return Ok(Vec::new());
    }
    let rows = sqlx::query_as::<_, CardapioOcupado>(
        r#"
        SELECT data_dia, turma_id, titulo_menu
        FROM cardapios
        WHERE tenant_id = $1
          AND tipo_refeicao = $2
          AND data_dia = ANY($3)
        "#,
    )
    .bind(tenant_id)
    .bind(tipo_refeicao)
    .bind(datas)
    .fetch_all(&mut *db)
    .await?;
    Ok(rows)
}

fn classificar(
    datas: &[NaiveDate],
    ocupados: &[CardapioOcupado],
    coberturas: &[Cobertura],
    turma_id: Option<Uuid>,
) -> Vec<PreviaDia> {
    datas
        .iter()
        .map(|data| {
            let conflito = ocupados
                .iter()
                .find(|item| item.data_dia == *data && conflita(item, turma_id));
            let feriado = coberturas
                .iter()
                .find(|evento| evento.data_inicio <= *data && evento.data_fim >= *data);
            let motivo = conflito.map(|item| format!("Já existe {} nesta data.", item.titulo_menu));
            PreviaDia {
                data: *data,
                conflito: conflito.is_some(),
                feriado: feriado.map(|evento| evento.titulo.clone()),
                motivo,
            }
        })
        .collect()
}

mod cardapio;
mod pratos;

pub use cardapio::*;
pub use pratos::*;
