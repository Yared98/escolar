use super::{
    check_aluno_ownership, check_roles, json, log_audit, ActiveTenant, AppError, AppState,
    AuthUser, CreateRotinaDiariaDto, DiarioInfantilQuery, Extension, Json, NaiveDate, Path, Query,
    RotinaDiariaInfantil, State, TenantDb, Uuid, Value,
};
use sqlx::Row;

pub async fn registrar_rotina_diaria(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateRotinaDiariaDto>,
) -> Result<Json<RotinaDiariaInfantil>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "professor", "nutricionista", "gestor"],
    )?;
    let tenant_id = active_tenant.0;
    let data_rotina = dto.data.unwrap_or_else(|| chrono::Utc::now().date_naive());

    let (status_presenca, _) =
        presenca_do_dia(&mut db, tenant_id, dto.aluno_id, data_rotina).await?;
    if status_presenca == "falta" || status_presenca == "justificada" {
        return Err(AppError::BadRequest(
            "Aluno ausente nesta data. Corrija a presença antes de registrar a rotina.".to_string(),
        ));
    }

    let refeicoes = serde_json::to_value(dto.refeicoes.clone().unwrap_or_default())
        .unwrap_or_else(|_| json!([]));

    let existente = sqlx::query_as::<_, RotinaDiariaInfantil>(
        "SELECT * FROM rotina_diaria_infantil WHERE tenant_id = $1 AND aluno_id = $2 AND data = $3 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(data_rotina)
    .fetch_optional(&mut *db)
    .await?;

    let rotina = if let Some(atual) = existente {
        sqlx::query_as::<_, RotinaDiariaInfantil>(
            r#"
            UPDATE rotina_diaria_infantil
            SET refeicao_status = $1,
                sono_minutos = $2,
                fraldas_trocas = $3,
                humor = $4,
                medicamento_ministrado = $5,
                observacao_pedagogica = $6,
                refeicoes = $7
            WHERE id = $8 AND tenant_id = $9
            RETURNING *
            "#,
        )
        .bind(&dto.refeicao_status)
        .bind(dto.sono_minutos)
        .bind(dto.fraldas_trocas)
        .bind(&dto.humor)
        .bind(dto.medicamento_ministrado)
        .bind(dto.observacao_pedagogica)
        .bind(&refeicoes)
        .bind(atual.id)
        .bind(tenant_id)
        .fetch_one(&mut *db)
        .await?
    } else {
        sqlx::query_as::<_, RotinaDiariaInfantil>(
            r#"
            INSERT INTO rotina_diaria_infantil (tenant_id, aluno_id, data, refeicao_status, sono_minutos, fraldas_trocas, humor, medicamento_ministrado, observacao_pedagogica, refeicoes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(dto.aluno_id)
        .bind(data_rotina)
        .bind(&dto.refeicao_status)
        .bind(dto.sono_minutos)
        .bind(dto.fraldas_trocas)
        .bind(&dto.humor)
        .bind(dto.medicamento_ministrado)
        .bind(dto.observacao_pedagogica)
        .bind(&refeicoes)
        .fetch_one(&mut *db)
        .await?
    };

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "REGISTRAR_ROTINA_DIARIA",
        "rotina_diaria_infantil",
        Some(rotina.id.to_string()),
        Some(json!({"aluno_id": dto.aluno_id, "data": data_rotina})),
    )
    .await;

    Ok(Json(rotina))
}

pub async fn consultar_rotina_aluno(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<Vec<RotinaDiariaInfantil>>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "nutricionista",
            "responsavel",
        ],
    )?;
    let tenant_id = active_tenant.0;
    check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let rotinas = sqlx::query_as::<_, RotinaDiariaInfantil>(
        "SELECT * FROM rotina_diaria_infantil WHERE tenant_id = $1 AND aluno_id = $2 ORDER BY data DESC",
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(rotinas))
}

async fn presenca_do_dia(
    db: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    aluno_id: Uuid,
    data: NaiveDate,
) -> Result<(String, Option<String>), AppError> {
    let row = sqlx::query(
        r#"
        SELECT p.presente, p.justificativa
        FROM presencas p
        JOIN diarios_classe d ON d.id = p.diario_id AND d.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1 AND p.aluno_id = $2 AND d.data_aula = $3
        ORDER BY p.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .bind(data)
    .fetch_optional(&mut *db)
    .await?;

    Ok(match row {
        None => ("sem_registro".to_string(), None),
        Some(r) => {
            let presente: bool = r.get("presente");
            let justificativa: Option<String> = r.get("justificativa");
            if presente {
                ("presente".to_string(), None)
            } else if justificativa.is_some() {
                ("justificada".to_string(), justificativa)
            } else {
                ("falta".to_string(), None)
            }
        }
    })
}

pub async fn consultar_diario_infantil(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
    Query(query): Query<DiarioInfantilQuery>,
) -> Result<Json<Value>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "nutricionista",
            "responsavel",
        ],
    )?;
    let tenant_id = active_tenant.0;
    check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let turma = sqlx::query(
        r#"
        SELECT t.id, t.nome, t.etapa_ensino
        FROM turma_alunos ta
        JOIN turmas t ON t.id = ta.turma_id AND t.tenant_id = ta.tenant_id
        WHERE ta.tenant_id = $1 AND ta.aluno_id = $2 AND ta.status = 'ativo'
        ORDER BY (t.etapa_ensino ILIKE '%infantil%') DESC, ta.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_optional(&mut *db)
    .await?;

    let turma_id: Option<Uuid> = turma.as_ref().map(|r| r.get("id"));
    let turma_json = turma.as_ref().map(|r| {
        json!({
            "id": r.get::<Uuid, _>("id"),
            "nome": r.get::<String, _>("nome"),
            "etapa_ensino": r.get::<String, _>("etapa_ensino"),
        })
    });

    let (presenca, justificativa) =
        presenca_do_dia(&mut db, tenant_id, aluno_id, query.data).await?;

    let rotina = sqlx::query_as::<_, RotinaDiariaInfantil>(
        "SELECT * FROM rotina_diaria_infantil WHERE tenant_id = $1 AND aluno_id = $2 AND data = $3 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .bind(query.data)
    .fetch_optional(&mut *db)
    .await?;

    let cardapio_rows = sqlx::query(
        r#"
        SELECT tipo_refeicao, titulo_menu, descricao_ingredientes, alergicos_atencao
        FROM cardapios
        WHERE tenant_id = $1 AND data_dia = $2 AND (turma_id IS NULL OR turma_id = $3)
        ORDER BY created_at
        "#,
    )
    .bind(tenant_id)
    .bind(query.data)
    .bind(turma_id)
    .fetch_all(&mut *db)
    .await?;

    let cardapio: Vec<Value> = cardapio_rows
        .iter()
        .map(|r| {
            json!({
                "tipo_refeicao": r.get::<String, _>("tipo_refeicao"),
                "titulo_menu": r.get::<String, _>("titulo_menu"),
                "descricao_ingredientes": r.get::<String, _>("descricao_ingredientes"),
                "alergicos_atencao": r.get::<Option<String>, _>("alergicos_atencao"),
            })
        })
        .collect();

    Ok(Json(json!({
        "aluno_id": aluno_id,
        "data": query.data,
        "turma": turma_json,
        "presenca": presenca,
        "justificativa": justificativa,
        "rotina": rotina,
        "cardapio": cardapio,
    })))
}

pub async fn criar_autorizacao_medicamento(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<
        crate::models::agenda_admin::CreateAutorizacaoMedicamentoDto,
    >,
) -> Result<axum::Json<crate::models::agenda_admin::AutorizacaoMedicamento>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "responsavel"])?;
    let tenant_id = active_tenant.0;

    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, dto.aluno_id).await?;

    let auth_med = sqlx::query_as::<_, crate::models::agenda_admin::AutorizacaoMedicamento>(
        r#"
        INSERT INTO autorizacoes_medicamento (tenant_id, aluno_id, responsavel_id, medicamento, dosagem, horario_aplicacao, receita_medica_url, observacoes, data_inicio, data_fim)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(auth_user.id)
    .bind(&dto.medicamento)
    .bind(&dto.dosagem)
    .bind(&dto.horario_aplicacao)
    .bind(&dto.receita_medica_url)
    .bind(&dto.observacoes)
    .bind(dto.data_inicio)
    .bind(dto.data_fim)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_AUTORIZACAO_MEDICAMENTO",
        "autorizacoes_medicamento",
        Some(auth_med.id.to_string()),
        Some(serde_json::json!({"aluno_id": dto.aluno_id, "medicamento": dto.medicamento})),
    )
    .await;

    Ok(axum::Json(auth_med))
}

pub async fn listar_autorizacoes_medicamento(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(aluno_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::agenda_admin::AutorizacaoMedicamento>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "professor", "responsavel"])?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let auths = sqlx::query_as::<_, crate::models::agenda_admin::AutorizacaoMedicamento>(
        "SELECT * FROM autorizacoes_medicamento WHERE tenant_id = $1 AND aluno_id = $2 ORDER BY created_at DESC"
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(axum::Json(auths))
}

pub async fn atualizar_status_medicamento(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path((aluno_id, auth_id)): axum::extract::Path<(Uuid, Uuid)>,
    axum::extract::Json(payload): axum::extract::Json<serde_json::Value>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "professor"])?;
    let tenant_id = active_tenant.0;

    let status = payload
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("aplicado");

    sqlx::query(
        "UPDATE autorizacoes_medicamento SET status = $1 WHERE id = $2 AND tenant_id = $3 AND aluno_id = $4"
    )
    .bind(status)
    .bind(auth_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .execute(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_STATUS_MEDICAMENTO",
        "autorizacoes_medicamento",
        Some(auth_id.to_string()),
        Some(serde_json::json!({"aluno_id": aluno_id, "status": status})),
    )
    .await;

    Ok(axum::Json(serde_json::json!({"status": "sucesso"})))
}
