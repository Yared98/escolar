use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde_json::{json, Value};
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
    models::academico::{
        AdicionarDisciplinaTurmaDto, AtribuirProfessorDto, CreateDisciplinaDto, Disciplina,
        TurmaDisciplina, TurmaDisciplinaDetalhada, TurmaProfessor, TurmaProfessorDetalhado,
        UpdateDisciplinaDto,
    },
};

pub async fn listar_disciplinas(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Disciplina>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let count =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM disciplinas WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_one(&mut *db)
            .await?;

    // Seed inteligente caso tenant novo ainda não possua disciplinas
    if count == 0 {
        let padroes = vec![
            (
                "PORT-01",
                "Língua Portuguesa",
                "linguagens",
                5,
                200,
                "Comunicação, leitura, gramática e interpretação textual",
            ),
            (
                "MAT-01",
                "Matemática",
                "matematica",
                5,
                200,
                "Aritmética, álgebra, geometria e raciocínio lógico",
            ),
            (
                "HIST-01",
                "História",
                "ciencias_humanas",
                3,
                120,
                "História do Brasil, geral e cidadania crítica",
            ),
            (
                "GEOG-01",
                "Geografia",
                "ciencias_humanas",
                3,
                120,
                "Geografia física, geopolítica e cartografia",
            ),
            (
                "CIEN-01",
                "Ciências da Natureza",
                "ciencias_natureza",
                4,
                160,
                "Biologia, ecologia, química e física integrada",
            ),
            (
                "ARTE-01",
                "Arte & Cultura",
                "linguagens",
                2,
                80,
                "Artes visuais, teatro, música e patrimônio cultural",
            ),
            (
                "EDFIS-01",
                "Educação Física",
                "linguagens",
                2,
                80,
                "Cultura corporal, esportes coletivos e saúde preventiva",
            ),
            (
                "ING-01",
                "Língua Inglesa",
                "linguagens",
                2,
                80,
                "Língua estrangeira moderna e comunicação global",
            ),
        ];

        for (cod, nome, area, ch_sem, ch_anu, desc) in padroes {
            let _ = sqlx::query(
                r#"
                INSERT INTO disciplinas (tenant_id, codigo, nome, area_conhecimento, carga_horaria_semanal, carga_horaria_anual, descricao, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'ativo')
                ON CONFLICT (tenant_id, codigo) DO NOTHING
                "#
            )
            .bind(tenant_id)
            .bind(cod)
            .bind(nome)
            .bind(area)
            .bind(ch_sem)
            .bind(ch_anu)
            .bind(desc)
            .execute(&mut *db)
            .await;
        }
    }

    let disciplinas = sqlx::query_as::<_, Disciplina>(
        "SELECT * FROM disciplinas WHERE tenant_id = $1 ORDER BY area_conhecimento ASC, nome ASC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(disciplinas))
}

pub async fn criar_disciplina(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateDisciplinaDto>,
) -> Result<Json<Disciplina>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;
    let area = dto
        .area_conhecimento
        .unwrap_or_else(|| "linguagens".to_string());
    let ch_sem = dto.carga_horaria_semanal.unwrap_or(4);
    let ch_anu = dto.carga_horaria_anual.unwrap_or(160);
    let status = dto.status.unwrap_or_else(|| "ativo".to_string());

    let disciplina = sqlx::query_as::<_, Disciplina>(
        r#"
        INSERT INTO disciplinas (tenant_id, codigo, nome, area_conhecimento, carga_horaria_semanal, carga_horaria_anual, descricao, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.codigo)
    .bind(&dto.nome)
    .bind(&area)
    .bind(ch_sem)
    .bind(ch_anu)
    .bind(&dto.descricao)
    .bind(&status)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_DISCIPLINA",
        "disciplinas",
        Some(disciplina.id.to_string()),
        Some(json!({ "codigo": disciplina.codigo, "nome": disciplina.nome })),
    )
    .await;

    Ok(Json(disciplina))
}

pub async fn atualizar_disciplina(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(disciplina_id): Path<Uuid>,
    Json(dto): Json<UpdateDisciplinaDto>,
) -> Result<Json<Disciplina>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let disciplina = sqlx::query_as::<_, Disciplina>(
        r#"
        UPDATE disciplinas
        SET
            codigo = COALESCE($1, codigo),
            nome = COALESCE($2, nome),
            area_conhecimento = COALESCE($3, area_conhecimento),
            carga_horaria_semanal = COALESCE($4, carga_horaria_semanal),
            carga_horaria_anual = COALESCE($5, carga_horaria_anual),
            descricao = COALESCE($6, descricao),
            status = COALESCE($7, status)
        WHERE id = $8 AND tenant_id = $9
        RETURNING *
        "#,
    )
    .bind(dto.codigo)
    .bind(dto.nome)
    .bind(dto.area_conhecimento)
    .bind(dto.carga_horaria_semanal)
    .bind(dto.carga_horaria_anual)
    .bind(dto.descricao)
    .bind(dto.status)
    .bind(disciplina_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_DISCIPLINA",
        "disciplinas",
        Some(disciplina_id.to_string()),
        None,
    )
    .await;

    Ok(Json(disciplina))
}

pub async fn deletar_disciplina(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(disciplina_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let res = sqlx::query("DELETE FROM disciplinas WHERE id = $1 AND tenant_id = $2")
        .bind(disciplina_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DELETAR_DISCIPLINA",
        "disciplinas",
        Some(disciplina_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Disciplina removida com sucesso." }),
    ))
}

pub async fn listar_disciplinas_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Vec<TurmaDisciplinaDetalhada>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let rows = sqlx::query(
        r#"
        SELECT 
            td.id,
            td.turma_id,
            td.disciplina_id,
            d.codigo AS disciplina_codigo,
            d.nome AS disciplina_nome,
            d.area_conhecimento,
            td.carga_horaria_semanal,
            td.carga_horaria_anual,
            tp.professor_id,
            u.name AS professor_nome,
            td.created_at
        FROM turma_disciplinas td
        JOIN disciplinas d ON td.disciplina_id = d.id
        LEFT JOIN turma_professores tp ON td.turma_id = tp.turma_id AND td.disciplina_id = tp.disciplina_id
        LEFT JOIN users u ON tp.professor_id = u.id
        WHERE td.turma_id = $1 AND td.tenant_id = $2
        ORDER BY d.nome ASC
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let lista = rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            TurmaDisciplinaDetalhada {
                id: row.get("id"),
                turma_id: row.get("turma_id"),
                disciplina_id: row.get("disciplina_id"),
                disciplina_codigo: row.get("disciplina_codigo"),
                disciplina_nome: row.get("disciplina_nome"),
                area_conhecimento: row.get("area_conhecimento"),
                carga_horaria_semanal: row.get("carga_horaria_semanal"),
                carga_horaria_anual: row.get("carga_horaria_anual"),
                professor_id: row.get("professor_id"),
                professor_nome: row.get("professor_nome"),
                created_at: row.get("created_at"),
            }
        })
        .collect();

    Ok(Json(lista))
}

pub async fn adicionar_disciplina_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
    Json(dto): Json<AdicionarDisciplinaTurmaDto>,
) -> Result<Json<TurmaDisciplina>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let disc = sqlx::query_as::<_, Disciplina>(
        "SELECT * FROM disciplinas WHERE id = $1 AND tenant_id = $2",
    )
    .bind(dto.disciplina_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let ch_sem = dto
        .carga_horaria_semanal
        .unwrap_or(disc.carga_horaria_semanal);
    let ch_anu = dto.carga_horaria_anual.unwrap_or(disc.carga_horaria_anual);

    let registro = sqlx::query_as::<_, TurmaDisciplina>(
        r#"
        INSERT INTO turma_disciplinas (tenant_id, turma_id, disciplina_id, carga_horaria_semanal, carga_horaria_anual)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, turma_id, disciplina_id) 
        DO UPDATE SET 
            carga_horaria_semanal = EXCLUDED.carga_horaria_semanal,
            carga_horaria_anual = EXCLUDED.carga_horaria_anual
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(dto.disciplina_id)
    .bind(ch_sem)
    .bind(ch_anu)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ADICIONAR_DISCIPLINA_TURMA",
        "turma_disciplinas",
        Some(registro.id.to_string()),
        Some(json!({ "turma_id": turma_id, "disciplina_id": dto.disciplina_id })),
    )
    .await;

    Ok(Json(registro))
}

pub async fn remover_disciplina_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path((turma_id, disciplina_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let res = sqlx::query(
        "DELETE FROM turma_disciplinas WHERE turma_id = $1 AND disciplina_id = $2 AND tenant_id = $3"
    )
    .bind(turma_id)
    .bind(disciplina_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Limpar atribuições docentes e horários atrelados
    let _ = sqlx::query("DELETE FROM turma_professores WHERE turma_id = $1 AND disciplina_id = $2 AND tenant_id = $3")
        .bind(turma_id)
        .bind(disciplina_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await;

    let _ = sqlx::query(
        "DELETE FROM horarios_turma WHERE turma_id = $1 AND disciplina_id = $2 AND tenant_id = $3",
    )
    .bind(turma_id)
    .bind(disciplina_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "REMOVER_DISCIPLINA_TURMA",
        "turma_disciplinas",
        Some(turma_id.to_string()),
        Some(json!({ "disciplina_id": disciplina_id })),
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Disciplina desvinculada da turma com sucesso." }),
    ))
}

pub async fn listar_professores_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Vec<TurmaProfessorDetalhado>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let rows = sqlx::query(
        r#"
        SELECT 
            tp.id,
            tp.turma_id,
            t.nome AS turma_nome,
            tp.disciplina_id,
            d.nome AS disciplina_nome,
            tp.professor_id,
            u.name AS professor_nome,
            u.email AS professor_email,
            tp.ano_letivo,
            tp.created_at
        FROM turma_professores tp
        JOIN turmas t ON tp.turma_id = t.id
        JOIN disciplinas d ON tp.disciplina_id = d.id
        JOIN users u ON tp.professor_id = u.id
        WHERE tp.turma_id = $1 AND tp.tenant_id = $2
        ORDER BY d.nome ASC
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let lista = rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            TurmaProfessorDetalhado {
                id: row.get("id"),
                turma_id: row.get("turma_id"),
                turma_nome: row.get("turma_nome"),
                disciplina_id: row.get("disciplina_id"),
                disciplina_nome: row.get("disciplina_nome"),
                professor_id: row.get("professor_id"),
                professor_nome: row.get("professor_nome"),
                professor_email: row.get("professor_email"),
                ano_letivo: row.get("ano_letivo"),
                created_at: row.get("created_at"),
            }
        })
        .collect();

    Ok(Json(lista))
}

pub async fn atribuir_professor_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<AtribuirProfessorDto>,
) -> Result<Json<TurmaProfessor>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;
    let ano = dto.ano_letivo.unwrap_or(2026);

    // 1. Garantir que a disciplina está na matriz da turma
    let disciplina_na_turma = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM turma_disciplinas WHERE turma_id = $1 AND disciplina_id = $2 AND tenant_id = $3)"
    )
    .bind(dto.turma_id)
    .bind(dto.disciplina_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if !disciplina_na_turma {
        // Auto-adiciona a disciplina à matriz da turma se não estiver
        let _ = sqlx::query(
            r#"
            INSERT INTO turma_disciplinas (tenant_id, turma_id, disciplina_id, carga_horaria_semanal, carga_horaria_anual)
            SELECT tenant_id, $1, id, carga_horaria_semanal, carga_horaria_anual
            FROM disciplinas WHERE id = $2 AND tenant_id = $3
            ON CONFLICT DO NOTHING
            "#
        )
        .bind(dto.turma_id)
        .bind(dto.disciplina_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await;
    }

    let atribuicao = sqlx::query_as::<_, TurmaProfessor>(
        r#"
        INSERT INTO turma_professores (tenant_id, turma_id, disciplina_id, professor_id, ano_letivo)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, turma_id, disciplina_id, professor_id) 
        DO UPDATE SET ano_letivo = EXCLUDED.ano_letivo
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(dto.disciplina_id)
    .bind(dto.professor_id)
    .bind(ano)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATRIBUIR_PROFESSOR_TURMA",
        "turma_professores",
        Some(atribuicao.id.to_string()),
        Some(json!({ "turma_id": dto.turma_id, "disciplina_id": dto.disciplina_id, "professor_id": dto.professor_id })),
    )
    .await;

    Ok(Json(atribuicao))
}

pub async fn remover_atribuicao_docente(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(atribuicao_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let res = sqlx::query("DELETE FROM turma_professores WHERE id = $1 AND tenant_id = $2")
        .bind(atribuicao_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "REMOVER_ATRIBUICAO_DOCENTE",
        "turma_professores",
        Some(atribuicao_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Atribuição docente removida com sucesso." }),
    ))
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ProfessorItemDto {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
}

pub async fn listar_professores_disponiveis(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<ProfessorItemDto>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let rows = sqlx::query(
        "SELECT id, name, email, role FROM users WHERE tenant_id = $1 AND role IN ('professor', 'gestor', 'admin') ORDER BY name ASC"
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let profs: Vec<ProfessorItemDto> = rows
        .into_iter()
        .map(|r| {
            use sqlx::Row;
            ProfessorItemDto {
                id: r.get("id"),
                name: r.get("name"),
                email: r.get("email"),
                role: r.get("role"),
            }
        })
        .collect();

    Ok(Json(profs))
}
