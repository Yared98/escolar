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

pub async fn listar_pratos(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Prato>>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "nutricionista",
            "professor",
            "responsavel",
        ],
    )?;
    let pratos = sqlx::query_as::<_, Prato>(
        "SELECT * FROM pratos WHERE tenant_id = $1 AND ativo = TRUE ORDER BY titulo",
    )
    .bind(active_tenant.0)
    .fetch_all(&mut *db)
    .await?;
    Ok(Json(pratos))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RecorrenciaResumo {
    pub id: Uuid,
    pub prato_id: Uuid,
    pub titulo: String,
    pub descricao_ingredientes: String,
    pub alergicos_atencao: Option<String>,
    pub tipo_refeicao: String,
    pub turma_id: Option<Uuid>,
    pub dias_semana: Vec<i16>,
    pub data_inicio: NaiveDate,
    pub data_fim: NaiveDate,
    pub nutricionista_id: Option<Uuid>,
    pub nutricionista_responsavel: String,
    pub dias_publicados: i64,
    pub excecoes: i64,
    pub status: String,
}

pub async fn listar_recorrencias_cardapio(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<RecorrenciaResumo>>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "nutricionista",
            "professor",
            "responsavel",
        ],
    )?;
    let hoje = hoje_escola();
    let rows = sqlx::query_as::<_, RecorrenciaResumo>(
        r#"
        SELECT
            r.id,
            r.prato_id,
            p.titulo,
            p.descricao_ingredientes,
            p.alergicos_atencao,
            r.tipo_refeicao,
            r.turma_id,
            r.dias_semana,
            r.data_inicio,
            r.data_fim,
            r.nutricionista_id,
            r.nutricionista_responsavel,
            COALESCE((
                SELECT COUNT(*)::bigint FROM cardapios c
                WHERE c.recorrencia_id = r.id AND c.tenant_id = r.tenant_id
            ), 0) AS dias_publicados,
            COALESCE((
                SELECT COUNT(*)::bigint FROM cardapios c
                WHERE c.recorrencia_id = r.id AND c.tenant_id = r.tenant_id AND c.origem = 'excecao'
            ), 0) AS excecoes,
            CASE
                WHEN r.data_fim < $2 THEN 'encerrada'
                WHEN r.data_inicio > $2 THEN 'futura'
                ELSE 'ativa'
            END AS status
        FROM cardapio_recorrencias r
        JOIN pratos p ON p.id = r.prato_id
        WHERE r.tenant_id = $1
        ORDER BY r.data_inicio DESC, r.tipo_refeicao, p.titulo
        "#,
    )
    .bind(active_tenant.0)
    .bind(hoje)
    .fetch_all(&mut *db)
    .await?;
    Ok(Json(rows))
}

pub async fn criar_prato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<UpsertPratoDto>,
) -> Result<Json<Prato>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    if dto.titulo.trim().is_empty() || dto.descricao_ingredientes.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Informe o nome e os ingredientes do prato.".into(),
        ));
    }
    let prato = sqlx::query_as::<_, Prato>(
        r#"
        INSERT INTO pratos (tenant_id, titulo, descricao_ingredientes, alergicos_atencao, tipo_refeicao)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(active_tenant.0)
    .bind(dto.titulo.trim())
    .bind(dto.descricao_ingredientes.trim())
    .bind(dto.alergicos_atencao.filter(|valor| !valor.trim().is_empty()))
    .bind(dto.tipo_refeicao.filter(|valor| !valor.trim().is_empty()))
    .fetch_one(&mut *db)
    .await?;
    log_audit(
        &mut *db,
        active_tenant.0,
        Some(auth_user.id),
        "CRIAR_PRATO",
        "pratos",
        Some(prato.id.to_string()),
        Some(json!({
            "titulo": prato.titulo,
            "tipo_refeicao": prato.tipo_refeicao,
        })),
    )
    .await;
    Ok(Json(prato))
}

pub async fn atualizar_prato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(prato_id): Path<Uuid>,
    Json(dto): Json<UpsertPratoDto>,
) -> Result<Json<Prato>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    if dto.titulo.trim().is_empty() || dto.descricao_ingredientes.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Informe o nome e os ingredientes do prato.".into(),
        ));
    }
    let tenant_id = active_tenant.0;

    let prato = sqlx::query_as::<_, Prato>(
        r#"
        UPDATE pratos
        SET titulo = $3,
            descricao_ingredientes = $4,
            alergicos_atencao = $5,
            tipo_refeicao = $6
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(prato_id)
    .bind(tenant_id)
    .bind(dto.titulo.trim())
    .bind(dto.descricao_ingredientes.trim())
    .bind(
        dto.alergicos_atencao
            .filter(|valor| !valor.trim().is_empty()),
    )
    .bind(dto.tipo_refeicao.filter(|valor| !valor.trim().is_empty()))
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_PRATO",
        "pratos",
        Some(prato_id.to_string()),
        Some(json!({
            "titulo": prato.titulo,
            "tipo_refeicao": prato.tipo_refeicao,
        })),
    )
    .await;

    Ok(Json(prato))
}

pub async fn excluir_prato(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(prato_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    let tenant_id = active_tenant.0;

    let prato =
        sqlx::query("SELECT id, titulo, ativo FROM pratos WHERE id = $1 AND tenant_id = $2")
            .bind(prato_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .ok_or(AppError::NotFound)?;

    let titulo: String = prato.try_get("titulo").unwrap_or_default();

    let cardapios_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM cardapios WHERE prato_id = $1 AND tenant_id = $2",
    )
    .bind(prato_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    let recorrencias_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM cardapio_recorrencias WHERE prato_id = $1 AND tenant_id = $2",
    )
    .bind(prato_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    let em_uso = cardapios_count > 0 || recorrencias_count > 0;
    let soft_delete = em_uso;

    let mut tx = db.begin().await?;

    if soft_delete {
        sqlx::query("UPDATE pratos SET ativo = FALSE WHERE id = $1 AND tenant_id = $2")
            .bind(prato_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
    } else {
        sqlx::query("DELETE FROM pratos WHERE id = $1 AND tenant_id = $2")
            .bind(prato_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
    }

    log_audit(
        &mut *tx,
        tenant_id,
        Some(auth_user.id),
        "EXCLUIR_PRATO",
        "pratos",
        Some(prato_id.to_string()),
        Some(json!({
            "titulo": titulo,
            "soft_delete": soft_delete,
            "cardapios_vinculados": cardapios_count,
            "recorrencias_vinculadas": recorrencias_count,
        })),
    )
    .await;

    tx.commit().await?;

    Ok(Json(json!({
        "excluido": true,
        "id": prato_id,
        "soft_delete": soft_delete,
        "cardapios_vinculados": cardapios_count,
        "recorrencias_vinculadas": recorrencias_count,
        "mensagem": if soft_delete {
            "Prato desativado do catálogo pois possui vínculos a cardápios ou recorrências existentes."
        } else {
            "Prato excluído permanentemente do catálogo."
        }
    })))
}

pub async fn prever_recorrencia_cardapio(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<RecorrenciaCardapioDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    validar_vigencia(dto.data_inicio, dto.data_fim, &dto.dias_semana)?;
    let datas = datas_da_vigencia(dto.data_inicio, dto.data_fim, &dto.dias_semana);
    if datas.is_empty() {
        return Err(AppError::BadRequest(
            "Nenhuma data da vigência cai nos dias escolhidos.".into(),
        ));
    }
    let tenant_id = active_tenant.0;
    let ocupacao = ocupados(&mut db, tenant_id, &datas, &dto.tipo_refeicao).await?;
    let ferias = coberturas(
        &mut db,
        tenant_id,
        dto.data_inicio,
        dto.data_fim,
        dto.turma_id,
    )
    .await?;
    let dias = classificar(&datas, &ocupacao, &ferias, dto.turma_id);
    let conflitos = dias.iter().filter(|dia| dia.conflito).count();
    let feriados = dias.iter().filter(|dia| dia.feriado.is_some()).count();
    Ok(Json(json!({
        "dias": dias,
        "total": datas.len(),
        "conflitos": conflitos,
        "feriados": feriados,
    })))
}

pub async fn confirmar_recorrencia_cardapio(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<RecorrenciaCardapioDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    validar_vigencia(dto.data_inicio, dto.data_fim, &dto.dias_semana)?;
    if dto.titulo_menu.trim().is_empty() || dto.descricao_ingredientes.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Informe o nome e os ingredientes do prato.".into(),
        ));
    }
    let datas = datas_da_vigencia(dto.data_inicio, dto.data_fim, &dto.dias_semana);
    if datas.is_empty() {
        return Err(AppError::BadRequest(
            "Nenhuma data da vigência cai nos dias escolhidos.".into(),
        ));
    }

    let tenant_id = active_tenant.0;
    let nutricionista = nutricionista_ativo(&mut db, tenant_id, dto.nutricionista_id).await?;
    let ocupacao = ocupados(&mut db, tenant_id, &datas, &dto.tipo_refeicao).await?;
    let ferias = coberturas(
        &mut db,
        tenant_id,
        dto.data_inicio,
        dto.data_fim,
        dto.turma_id,
    )
    .await?;
    let previa = classificar(&datas, &ocupacao, &ferias, dto.turma_id);
    let pular_feriados = dto.pular_feriados.unwrap_or(false);

    let mut tx = db.begin().await?;
    let prato_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO pratos (tenant_id, titulo, descricao_ingredientes, alergicos_atencao, tipo_refeicao)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#,
    )
    .bind(tenant_id)
    .bind(dto.titulo_menu.trim())
    .bind(dto.descricao_ingredientes.trim())
    .bind(dto.alergicos_atencao.as_deref().map(str::trim).filter(|valor| !valor.is_empty()))
    .bind(&dto.tipo_refeicao)
    .fetch_one(&mut *tx)
    .await?;

    let recorrencia_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO cardapio_recorrencias (
            tenant_id, prato_id, turma_id, tipo_refeicao, dias_semana,
            data_inicio, data_fim, nutricionista_id, nutricionista_responsavel
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        "#,
    )
    .bind(tenant_id)
    .bind(prato_id)
    .bind(dto.turma_id)
    .bind(&dto.tipo_refeicao)
    .bind(&dto.dias_semana)
    .bind(dto.data_inicio)
    .bind(dto.data_fim)
    .bind(dto.nutricionista_id)
    .bind(&nutricionista)
    .fetch_one(&mut *tx)
    .await?;

    let mut geradas = 0_i64;
    let mut ignoradas = Vec::new();
    for dia in &previa {
        if dia.conflito {
            ignoradas.push(json!({ "data": dia.data, "motivo": dia.motivo }));
            continue;
        }
        if pular_feriados && dia.feriado.is_some() {
            ignoradas.push(json!({
                "data": dia.data,
                "motivo": format!("Feriado ou férias: {}", dia.feriado.clone().unwrap_or_default()),
            }));
            continue;
        }
        sqlx::query(
            r#"
            INSERT INTO cardapios (
                tenant_id, turma_id, semana_ano, data_dia, tipo_refeicao, titulo_menu,
                descricao_ingredientes, alergicos_atencao, nutricionista_id, nutricionista_responsavel,
                prato_id, recorrencia_id, origem, editado_manualmente
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'recorrencia', FALSE)
            "#,
        )
        .bind(tenant_id)
        .bind(dto.turma_id)
        .bind(semana_ano(dia.data))
        .bind(dia.data)
        .bind(&dto.tipo_refeicao)
        .bind(dto.titulo_menu.trim())
        .bind(dto.descricao_ingredientes.trim())
        .bind(dto.alergicos_atencao.as_deref().map(str::trim).filter(|valor| !valor.is_empty()))
        .bind(dto.nutricionista_id)
        .bind(&nutricionista)
        .bind(prato_id)
        .bind(recorrencia_id)
        .execute(&mut *tx)
        .await?;
        geradas += 1;
    }

    if geradas == 0 {
        return Err(AppError::BadRequest(
            "Nenhuma data foi gerada. Os dias escolhidos já têm cardápio ou foram pulados.".into(),
        ));
    }

    log_audit(
        &mut *tx,
        tenant_id,
        Some(auth_user.id),
        "GERAR_CARDAPIO_RECORRENTE",
        "cardapio_recorrencias",
        Some(recorrencia_id.to_string()),
        Some(json!({ "geradas": geradas, "ignoradas": ignoradas.len() })),
    )
    .await;
    tx.commit().await?;

    Ok(Json(json!({
        "recorrencia_id": recorrencia_id,
        "prato_id": prato_id,
        "geradas": geradas,
        "ignoradas": ignoradas,
    })))
}

pub async fn editar_cardapio_escopo(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(cardapio_id): Path<Uuid>,
    Json(dto): Json<EditarCardapioDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    if dto.titulo_menu.trim().is_empty() || dto.descricao_ingredientes.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Informe o nome e os ingredientes do prato.".into(),
        ));
    }
    let tenant_id = active_tenant.0;
    let atual = sqlx::query(
        r#"
        SELECT data_dia, recorrencia_id, tipo_refeicao, turma_id, nutricionista_id, nutricionista_responsavel
        FROM cardapios
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(cardapio_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let alergicos = dto
        .alergicos_atencao
        .as_deref()
        .map(str::trim)
        .filter(|valor| !valor.is_empty());

    if dto.escopo == "dia" {
        let recorrencia_id: Option<Uuid> = atual.try_get("recorrencia_id").unwrap_or(None);
        let tipo_atual: String = atual
            .try_get("tipo_refeicao")
            .map_err(|_| AppError::NotFound)?;
        let data_atual: NaiveDate = atual.try_get("data_dia").map_err(|_| AppError::NotFound)?;
        let tipo = dto
            .tipo_refeicao
            .as_deref()
            .map(str::trim)
            .filter(|valor| !valor.is_empty())
            .unwrap_or(tipo_atual.as_str());
        let data_dia = dto.data_dia.unwrap_or(data_atual);
        let turma_id = if dto.limpar_turma.unwrap_or(false) {
            None
        } else if dto.turma_id.is_some() {
            dto.turma_id
        } else {
            atual.try_get("turma_id").unwrap_or(None)
        };

        let mut nutricionista_id: Option<Uuid> = atual.try_get("nutricionista_id").unwrap_or(None);
        let mut nutricionista_nome: String = atual
            .try_get("nutricionista_responsavel")
            .unwrap_or_else(|_| String::new());
        if let Some(id) = dto.nutricionista_id {
            nutricionista_nome = nutricionista_ativo(&mut db, tenant_id, id).await?;
            nutricionista_id = Some(id);
        }

        let origem = if recorrencia_id.is_some() {
            "excecao"
        } else {
            "avulso"
        };
        sqlx::query(
            r#"
            UPDATE cardapios
            SET titulo_menu = $1,
                descricao_ingredientes = $2,
                alergicos_atencao = $3,
                tipo_refeicao = $4,
                data_dia = $5,
                semana_ano = $6,
                turma_id = $7,
                nutricionista_id = $8,
                nutricionista_responsavel = COALESCE(NULLIF($9, ''), nutricionista_responsavel),
                origem = $10,
                editado_manualmente = TRUE
            WHERE id = $11 AND tenant_id = $12
            "#,
        )
        .bind(dto.titulo_menu.trim())
        .bind(dto.descricao_ingredientes.trim())
        .bind(alergicos)
        .bind(tipo)
        .bind(data_dia)
        .bind(semana_ano(data_dia))
        .bind(turma_id)
        .bind(nutricionista_id)
        .bind(&nutricionista_nome)
        .bind(origem)
        .bind(cardapio_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;
        return Ok(Json(json!({ "escopo": "dia", "atualizados": 1 })));
    }

    if dto.escopo != "seguintes" {
        return Err(AppError::BadRequest(
            "Escolha editar somente este dia ou este e os próximos.".into(),
        ));
    }

    let recorrencia_id: Option<Uuid> = atual.try_get("recorrencia_id").unwrap_or(None);
    let recorrencia_id = recorrencia_id.ok_or_else(|| {
        AppError::BadRequest(
            "Este cardápio não faz parte de uma vigência. Altere somente este dia.".into(),
        )
    })?;
    let data_dia: NaiveDate = atual.try_get("data_dia").map_err(|_| AppError::NotFound)?;
    let hoje = hoje_escola();
    let corte = if data_dia < hoje { hoje } else { data_dia };

    let serie = sqlx::query(
        "SELECT data_inicio, data_fim, dias_semana, turma_id, tipo_refeicao, nutricionista_id, nutricionista_responsavel FROM cardapio_recorrencias WHERE id = $1 AND tenant_id = $2",
    )
    .bind(recorrencia_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;
    let data_inicio: NaiveDate = serie
        .try_get("data_inicio")
        .map_err(|_| AppError::NotFound)?;
    let data_fim: NaiveDate = serie.try_get("data_fim").map_err(|_| AppError::NotFound)?;
    if corte > data_fim {
        return Err(AppError::BadRequest(
            "Não há dias futuros nesta vigência para alterar.".into(),
        ));
    }

    let mut tx = db.begin().await?;
    let prato_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO pratos (tenant_id, titulo, descricao_ingredientes, alergicos_atencao, tipo_refeicao)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        "#,
    )
    .bind(tenant_id)
    .bind(dto.titulo_menu.trim())
    .bind(dto.descricao_ingredientes.trim())
    .bind(alergicos)
    .bind(serie.try_get::<String, _>("tipo_refeicao").ok())
    .fetch_one(&mut *tx)
    .await?;

    let serie_id = if corte > data_inicio {
        sqlx::query(
            "UPDATE cardapio_recorrencias SET data_fim = $1 WHERE id = $2 AND tenant_id = $3",
        )
        .bind(corte - Duration::days(1))
        .bind(recorrencia_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;
        sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO cardapio_recorrencias (
                tenant_id, prato_id, turma_id, tipo_refeicao, dias_semana,
                data_inicio, data_fim, nutricionista_id, nutricionista_responsavel
            )
            SELECT tenant_id, $1, turma_id, tipo_refeicao, dias_semana, $2, $3, nutricionista_id, nutricionista_responsavel
            FROM cardapio_recorrencias
            WHERE id = $4 AND tenant_id = $5
            RETURNING id
            "#,
        )
        .bind(prato_id)
        .bind(corte)
        .bind(data_fim)
        .bind(recorrencia_id)
        .bind(tenant_id)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query(
            "UPDATE cardapio_recorrencias SET prato_id = $1 WHERE id = $2 AND tenant_id = $3",
        )
        .bind(prato_id)
        .bind(recorrencia_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;
        recorrencia_id
    };

    let atualizados = sqlx::query(
        r#"
        UPDATE cardapios
        SET titulo_menu = $1,
            descricao_ingredientes = $2,
            alergicos_atencao = $3,
            prato_id = $4,
            recorrencia_id = $5
        WHERE tenant_id = $6
          AND recorrencia_id = $7
          AND data_dia >= $8
          AND (editado_manualmente = FALSE OR id = $9)
        "#,
    )
    .bind(dto.titulo_menu.trim())
    .bind(dto.descricao_ingredientes.trim())
    .bind(alergicos)
    .bind(prato_id)
    .bind(serie_id)
    .bind(tenant_id)
    .bind(recorrencia_id)
    .bind(corte)
    .bind(cardapio_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    log_audit(
        &mut *tx,
        tenant_id,
        Some(auth_user.id),
        "EDITAR_CARDAPIO_SEGUINTES",
        "cardapio_recorrencias",
        Some(serie_id.to_string()),
        Some(json!({ "corte": corte, "atualizados": atualizados })),
    )
    .await;
    tx.commit().await?;

    Ok(Json(json!({
        "escopo": "seguintes",
        "corte": corte,
        "atualizados": atualizados,
        "congelados_antes_de": corte,
    })))
}

pub async fn excluir_cardapio_dia(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(cardapio_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    let tenant_id = active_tenant.0;
    let atual = sqlx::query(
        "SELECT data_dia, titulo_menu, origem, recorrencia_id FROM cardapios WHERE id = $1 AND tenant_id = $2",
    )
    .bind(cardapio_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let data_dia: NaiveDate = atual.try_get("data_dia").map_err(|_| AppError::NotFound)?;
    let hoje = hoje_escola();
    if data_dia < hoje {
        return Err(AppError::BadRequest(
            "Não é possível excluir cardápio já servido. O histórico do Diário permanece.".into(),
        ));
    }

    let mut tx = db.begin().await?;
    sqlx::query("DELETE FROM cardapios WHERE id = $1 AND tenant_id = $2")
        .bind(cardapio_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;

    log_audit(
        &mut *tx,
        tenant_id,
        Some(auth_user.id),
        "EXCLUIR_CARDAPIO_DIA",
        "cardapios",
        Some(cardapio_id.to_string()),
        Some(json!({
            "data_dia": data_dia,
            "titulo": atual.try_get::<String, _>("titulo_menu").ok(),
            "origem": atual.try_get::<String, _>("origem").ok(),
            "recorrencia_id": atual.try_get::<Option<Uuid>, _>("recorrencia_id").ok().flatten(),
        })),
    )
    .await;
    tx.commit().await?;

    Ok(Json(
        json!({ "excluido": true, "id": cardapio_id, "data_dia": data_dia }),
    ))
}

pub async fn encerrar_recorrencia_cardapio(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(recorrencia_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    let tenant_id = active_tenant.0;
    let serie = sqlx::query(
        "SELECT data_inicio, data_fim FROM cardapio_recorrencias WHERE id = $1 AND tenant_id = $2",
    )
    .bind(recorrencia_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let data_inicio: NaiveDate = serie
        .try_get("data_inicio")
        .map_err(|_| AppError::NotFound)?;
    let data_fim: NaiveDate = serie.try_get("data_fim").map_err(|_| AppError::NotFound)?;
    let hoje = hoje_escola();
    if data_fim < hoje {
        return Err(AppError::BadRequest(
            "Esta vigência já está encerrada.".into(),
        ));
    }

    let mut tx = db.begin().await?;
    let removidos = sqlx::query(
        "DELETE FROM cardapios WHERE recorrencia_id = $1 AND tenant_id = $2 AND data_dia >= $3",
    )
    .bind(recorrencia_id)
    .bind(tenant_id)
    .bind(hoje)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    let serie_removida;
    let data_fim_nova: Option<NaiveDate>;
    if hoje <= data_inicio {
        sqlx::query("DELETE FROM cardapio_recorrencias WHERE id = $1 AND tenant_id = $2")
            .bind(recorrencia_id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
        serie_removida = true;
        data_fim_nova = None;
    } else {
        let novo_fim = hoje - Duration::days(1);
        sqlx::query(
            "UPDATE cardapio_recorrencias SET data_fim = $1 WHERE id = $2 AND tenant_id = $3",
        )
        .bind(novo_fim)
        .bind(recorrencia_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;
        serie_removida = false;
        data_fim_nova = Some(novo_fim);
    }

    log_audit(
        &mut *tx,
        tenant_id,
        Some(auth_user.id),
        "ENCERRAR_CARDAPIO_RECORRENCIA",
        "cardapio_recorrencias",
        Some(recorrencia_id.to_string()),
        Some(json!({
            "removidos": removidos,
            "serie_removida": serie_removida,
            "data_fim": data_fim_nova,
            "corte": hoje,
        })),
    )
    .await;
    tx.commit().await?;

    Ok(Json(json!({
        "recorrencia_id": recorrencia_id,
        "removidos": removidos,
        "serie_removida": serie_removida,
        "data_fim": data_fim_nova,
        "corte": hoje,
    })))
}
