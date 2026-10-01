use sqlx::Acquire;
use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    config::AppState, db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit, check_aluno_ownership},
        tenant::ActiveTenant,
    },
    models::secretaria::{
        Aluno, AlunoListItem, AlunoStatusContagem, AlunoTurmaDetalhado, AlunosPage, AssinarContratoDto,
        Contrato, CreateAlunoDto, CreateContratoDto, CreateSalaDto, CreateTurmaDto, ListAlunosQuery,
        MatricularTurmaDto, Prontuario, Sala, SalvarProntuarioDto, STATUS_ALUNO_VALIDOS,
        TransferirAlunoTurmaDto, Turma, TurmaAluno, TurmaDetalhada, UpdateAlunoDto, UpdateTurmaDto,
        VincularResponsavelDto,
    },
};

fn normalizar_status_aluno(status: &str) -> Result<String, AppError> {
    let normalized = status.trim().to_ascii_lowercase();
    if STATUS_ALUNO_VALIDOS.contains(&normalized.as_str()) {
        Ok(normalized)
    } else {
        Err(AppError::BadRequest(format!(
            "Status inválido '{}'. Valores aceitos: {}.",
            status,
            STATUS_ALUNO_VALIDOS.join(", ")
        )))
    }
}

pub fn limpar_cpf(cpf: &str) -> String {
    cpf.chars().filter(|c| c.is_ascii_digit()).collect()
}

pub fn validar_cpf_brasileiro(cpf: &str) -> bool {
    let digits: Vec<u32> = cpf.chars().filter_map(|c| c.to_digit(10)).collect();
    if digits.len() != 11 {
        return false;
    }
    // Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11)
    if digits.iter().all(|&d| d == digits[0]) {
        return false;
    }

    // Primeiro dígito verificador (Módulo 11 Receita Federal)
    let soma1: u32 = digits.iter().take(9).enumerate().map(|(i, &d)| d * (10 - i as u32)).sum();
    let resto1 = soma1 % 11;
    let d1 = if resto1 < 2 { 0 } else { 11 - resto1 };
    if digits[9] != d1 {
        return false;
    }

    // Segundo dígito verificador (Módulo 11 Receita Federal)
    let soma2: u32 = digits.iter().take(10).enumerate().map(|(i, &d)| d * (11 - i as u32)).sum();
    let resto2 = soma2 % 11;
    let d2 = if resto2 < 2 { 0 } else { 11 - resto2 };
    digits[10] == d2
}

pub fn validar_telefone_brasileiro(tel: &str) -> bool {
    let digits: String = tel.chars().filter(|c| c.is_ascii_digit()).collect();
    digits.len() >= 10 && digits.len() <= 11
}

pub fn espelhar_responsavel_financeiro(dto: &CreateAlunoDto) -> (String, Option<String>, String, String, String) {
    if dto.responsavel_financeiro_igual_legal {
        (
            dto.nome_responsavel.clone(),
            dto.cpf_responsavel_legal.clone(),
            dto.email_responsavel.clone(),
            dto.telefone_responsavel.clone(),
            dto.parentesco_responsavel_legal.clone().unwrap_or_else(|| "Mãe/Pai/Tutor Legal".to_string()),
        )
    } else {
        let nome = dto.nome_responsavel_financeiro.clone().unwrap_or_else(|| dto.nome_responsavel.clone());
        let email = dto.email_responsavel_financeiro.clone().unwrap_or_else(|| dto.email_responsavel.clone());
        let tel = dto.telefone_responsavel_financeiro.clone().unwrap_or_else(|| dto.telefone_responsavel.clone());
        let parentesco = dto.parentesco_responsavel_financeiro.clone().unwrap_or_else(|| "Responsável Financeiro".to_string());
        (nome, dto.cpf_responsavel_financeiro.clone(), email, tel, parentesco)
    }
}

pub fn validar_tipo_sanguineo(tipo: &str) -> bool {
    let t = tipo.trim().to_uppercase();
    matches!(t.as_str(), "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "NÃO INFORMADO" | "NAO INFORMADO" | "")
}

pub async fn criar_matricula(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateAlunoDto>,
) -> Result<Json<Aluno>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let cpf_limpo = limpar_cpf(&dto.cpf);
    if !validar_cpf_brasileiro(&cpf_limpo) {
        return Err(AppError::BadRequest(
            "CPF informado é inválido segundo as regras de validação da Receita Federal.".to_string(),
        ));
    }

    if !validar_telefone_brasileiro(&dto.telefone_responsavel) {
        return Err(AppError::BadRequest(
            "Telefone do responsável legal inválido. Deve conter DDD e 8 ou 9 dígitos.".to_string(),
        ));
    }

    if let Some(ref ts) = dto.tipo_sanguineo {
        if !validar_tipo_sanguineo(ts) {
            return Err(AppError::BadRequest(
                "Tipo sanguíneo informado é inválido. Valores aceitos: A+, A-, B+, B-, AB+, AB-, O+, O- ou Não informado.".to_string(),
            ));
        }
    }

    // Regra de Duplo Responsável: Se a flag for true (único pai/mesmo responsável), espelha os dados
    let (nome_fin, cpf_fin, email_fin, tel_fin, parentesco_fin) = espelhar_responsavel_financeiro(&dto);

    // Checar duplicidade de CPF no mesmo tenant para retornar HTTP 409 Conflict
    let cpf_duplicado = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM alunos WHERE tenant_id = $1 AND cpf = $2)",
    )
    .bind(tenant_id)
    .bind(&dto.cpf)
    .fetch_one(&mut *db)
    .await?;

    if cpf_duplicado {
        return Err(AppError::UserAlreadyExists);
    }

    let status_inicial = match dto.status.as_deref() {
        Some(s) => normalizar_status_aluno(s)?,
        None => "ativo".to_string(),
    };
    if status_inicial != "ativo" && status_inicial != "pre_matricula" {
        return Err(AppError::BadRequest(
            "Na criação, o status inicial deve ser 'ativo' ou 'pre_matricula'.".to_string(),
        ));
    }

    let mut tx = (&mut *db).begin().await?;

    let aluno = match sqlx::query_as::<_, Aluno>(
        r#"
        INSERT INTO alunos (
            tenant_id, nome, cpf, data_nascimento,
            nome_responsavel, cpf_responsavel_legal, email_responsavel, telefone_responsavel, parentesco_responsavel_legal,
            responsavel_financeiro_igual_legal, nome_responsavel_financeiro, cpf_responsavel_financeiro,
            email_responsavel_financeiro, telefone_responsavel_financeiro, parentesco_responsavel_financeiro,
            cep, logradouro, numero, complemento, bairro, cidade, estado,
            telefone_secundario, contato_emergencia_nome, contato_emergencia_telefone, contato_emergencia_parentesco,
            status, responsavel_user_id
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22,
            $23, $24, $25, $26,
            $27, $28
        )
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.nome)
    .bind(&dto.cpf)
    .bind(dto.data_nascimento)
    .bind(&dto.nome_responsavel)
    .bind(&dto.cpf_responsavel_legal)
    .bind(&dto.email_responsavel)
    .bind(&dto.telefone_responsavel)
    .bind(&dto.parentesco_responsavel_legal)
    .bind(dto.responsavel_financeiro_igual_legal)
    .bind(&nome_fin)
    .bind(&cpf_fin)
    .bind(&email_fin)
    .bind(&tel_fin)
    .bind(&parentesco_fin)
    .bind(&dto.cep)
    .bind(&dto.logradouro)
    .bind(&dto.numero)
    .bind(&dto.complemento)
    .bind(&dto.bairro)
    .bind(&dto.cidade)
    .bind(&dto.estado)
    .bind(&dto.telefone_secundario)
    .bind(&dto.contato_emergencia_nome)
    .bind(&dto.contato_emergencia_telefone)
    .bind(&dto.contato_emergencia_parentesco)
    .bind(&status_inicial)
    .bind(dto.responsavel_user_id)
    .fetch_one(&mut *tx)
    .await {
        Ok(a) => a,
        Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => {
            return Err(AppError::UserAlreadyExists);
        }
        Err(e) => return Err(AppError::DatabaseError(e)),
    };

    // Inicialização do Prontuário Médico & Observações
    sqlx::query(
        r#"
        INSERT INTO prontuarios (
            tenant_id, aluno_id, tipo_sanguineo, alergias, restricoes_alimentares,
            medicamentos_continuos, cuidados_especiais, historico_observacoes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (tenant_id, aluno_id) DO UPDATE SET
            tipo_sanguineo = COALESCE(EXCLUDED.tipo_sanguineo, prontuarios.tipo_sanguineo),
            alergias = COALESCE(EXCLUDED.alergias, prontuarios.alergias),
            restricoes_alimentares = COALESCE(EXCLUDED.restricoes_alimentares, prontuarios.restricoes_alimentares),
            medicamentos_continuos = COALESCE(EXCLUDED.medicamentos_continuos, prontuarios.medicamentos_continuos),
            cuidados_especiais = COALESCE(EXCLUDED.cuidados_especiais, prontuarios.cuidados_especiais),
            historico_observacoes = COALESCE(EXCLUDED.historico_observacoes, prontuarios.historico_observacoes),
            updated_at = NOW()
        "#,
    )
    .bind(tenant_id)
    .bind(aluno.id)
    .bind(&dto.tipo_sanguineo)
    .bind(&dto.alergias)
    .bind(&dto.restricoes_alimentares)
    .bind(&dto.medicamentos_continuos)
    .bind(&dto.cuidados_especiais)
    .bind(&dto.historico_observacoes)
    .execute(&mut *tx)
    .await?;

    if let Some(resp_id) = dto.responsavel_user_id {
        sqlx::query(
            r#"
            INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id, parentesco)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (tenant_id, responsavel_user_id, aluno_id) DO NOTHING
            "#,
        )
        .bind(tenant_id)
        .bind(resp_id)
        .bind(aluno.id)
        .bind(dto.parentesco_responsavel_legal.unwrap_or_else(|| "Pai/Mãe/Responsável Legal".to_string()))
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_MATRICULA",
        "aluno",
        Some(aluno.id.to_string()),
        Some(json!({ 
            "nome": aluno.nome, 
            "cpf": aluno.cpf,
            "responsavel_financeiro_igual_legal": aluno.responsavel_financeiro_igual_legal,
            "cidade": aluno.cidade
        })),
    )
    .await;

    Ok(Json(aluno))
}

pub async fn listar_alunos(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<ListAlunosQuery>,
) -> Result<Json<AlunosPage>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.limit.unwrap_or(25).clamp(1, 200);
    let offset = (page - 1) * page_size;

    let q_trim = query
        .q
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let q_like = q_trim.as_ref().map(|s| format!("%{}%", s));

    let status_filter = match query.status.as_deref().map(str::trim) {
        None | Some("") | Some("todos") => None,
        Some(s) => Some(normalizar_status_aluno(s)?),
    };

    let sem_turma = query.sem_turma.unwrap_or(false);
    let is_professor = auth_user.role == "professor";

    let contagem_status = if is_professor {
        sqlx::query_as::<_, AlunoStatusContagem>(
            r#"
            SELECT a.status, COUNT(DISTINCT a.id)::BIGINT AS total
            FROM alunos a
            JOIN turma_alunos ta ON ta.aluno_id = a.id AND ta.status = 'ativo'
            JOIN turma_professores tp ON tp.turma_id = ta.turma_id
            WHERE a.tenant_id = $1 AND tp.professor_id = $2
            GROUP BY a.status
            ORDER BY a.status
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        sqlx::query_as::<_, AlunoStatusContagem>(
            r#"
            SELECT status, COUNT(*)::BIGINT AS total
            FROM alunos
            WHERE tenant_id = $1
            GROUP BY status
            ORDER BY status
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&mut *db)
        .await?
    };

    let total = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT a.id)::BIGINT
        FROM alunos a
        WHERE a.tenant_id = $1
          AND ($2::TEXT IS NULL OR a.status = $2)
          AND (
            $3::TEXT IS NULL
            OR a.nome ILIKE $3
            OR a.cpf ILIKE $3
            OR a.nome_responsavel ILIKE $3
            OR COALESCE(a.nome_responsavel_financeiro, '') ILIKE $3
            OR COALESCE(a.cidade, '') ILIKE $3
          )
          AND (
            $4::UUID IS NULL
            OR EXISTS (
              SELECT 1 FROM turma_alunos ta
              WHERE ta.aluno_id = a.id AND ta.turma_id = $4 AND ta.status = 'ativo'
            )
          )
          AND (
            NOT $5::BOOLEAN
            OR NOT EXISTS (
              SELECT 1 FROM turma_alunos ta
              WHERE ta.aluno_id = a.id AND ta.status = 'ativo'
            )
          )
          AND (
            $6::INT IS NULL
            OR EXISTS (
              SELECT 1
              FROM turma_alunos ta
              JOIN turmas t ON t.id = ta.turma_id
              WHERE ta.aluno_id = a.id AND ta.status = 'ativo' AND t.ano_letivo = $6
            )
          )
          AND (
            NOT $7::BOOLEAN
            OR EXISTS (
              SELECT 1
              FROM turma_alunos ta
              JOIN turma_professores tp ON tp.turma_id = ta.turma_id
              WHERE ta.aluno_id = a.id AND tp.professor_id = $8
            )
          )
        "#,
    )
    .bind(tenant_id)
    .bind(status_filter.as_deref())
    .bind(q_like.as_deref())
    .bind(query.turma_id)
    .bind(sem_turma)
    .bind(query.ano_letivo)
    .bind(is_professor)
    .bind(auth_user.id)
    .fetch_one(&mut *db)
    .await?;

    let alunos = sqlx::query_as::<_, Aluno>(
        r#"
        SELECT DISTINCT a.*
        FROM alunos a
        WHERE a.tenant_id = $1
          AND ($2::TEXT IS NULL OR a.status = $2)
          AND (
            $3::TEXT IS NULL
            OR a.nome ILIKE $3
            OR a.cpf ILIKE $3
            OR a.nome_responsavel ILIKE $3
            OR COALESCE(a.nome_responsavel_financeiro, '') ILIKE $3
            OR COALESCE(a.cidade, '') ILIKE $3
          )
          AND (
            $4::UUID IS NULL
            OR EXISTS (
              SELECT 1 FROM turma_alunos ta
              WHERE ta.aluno_id = a.id AND ta.turma_id = $4 AND ta.status = 'ativo'
            )
          )
          AND (
            NOT $5::BOOLEAN
            OR NOT EXISTS (
              SELECT 1 FROM turma_alunos ta
              WHERE ta.aluno_id = a.id AND ta.status = 'ativo'
            )
          )
          AND (
            $6::INT IS NULL
            OR EXISTS (
              SELECT 1
              FROM turma_alunos ta
              JOIN turmas t ON t.id = ta.turma_id
              WHERE ta.aluno_id = a.id AND ta.status = 'ativo' AND t.ano_letivo = $6
            )
          )
          AND (
            NOT $7::BOOLEAN
            OR EXISTS (
              SELECT 1
              FROM turma_alunos ta
              JOIN turma_professores tp ON tp.turma_id = ta.turma_id
              WHERE ta.aluno_id = a.id AND tp.professor_id = $8
            )
          )
        ORDER BY a.nome ASC
        LIMIT $9 OFFSET $10
        "#,
    )
    .bind(tenant_id)
    .bind(status_filter.as_deref())
    .bind(q_like.as_deref())
    .bind(query.turma_id)
    .bind(sem_turma)
    .bind(query.ano_letivo)
    .bind(is_professor)
    .bind(auth_user.id)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&mut *db)
    .await?;

    #[derive(sqlx::FromRow)]
    struct TurmaAtualRow {
        aluno_id: Uuid,
        turma_id: Uuid,
        turma_nome: String,
        turma_codigo: Option<String>,
        numero_chamada: Option<i32>,
    }

    let aluno_ids: Vec<Uuid> = alunos.iter().map(|a| a.id).collect();
    let mut turma_map = std::collections::HashMap::<Uuid, TurmaAtualRow>::new();
    if !aluno_ids.is_empty() {
        let rows = sqlx::query_as::<_, TurmaAtualRow>(
            r#"
            SELECT DISTINCT ON (ta.aluno_id)
                ta.aluno_id,
                t.id AS turma_id,
                t.nome AS turma_nome,
                t.codigo AS turma_codigo,
                ta.numero_chamada
            FROM turma_alunos ta
            JOIN turmas t ON t.id = ta.turma_id
            WHERE ta.aluno_id = ANY($1) AND ta.status = 'ativo'
            ORDER BY ta.aluno_id, ta.data_matricula DESC NULLS LAST
            "#,
        )
        .bind(&aluno_ids)
        .fetch_all(&mut *db)
        .await?;
        for row in rows {
            turma_map.insert(row.aluno_id, row);
        }
    }

    let items = alunos
        .into_iter()
        .map(|aluno| {
            let turma = turma_map.remove(&aluno.id);
            AlunoListItem {
                turma_atual_id: turma.as_ref().map(|t| t.turma_id),
                turma_atual_nome: turma.as_ref().map(|t| t.turma_nome.clone()),
                turma_atual_codigo: turma.as_ref().and_then(|t| t.turma_codigo.clone()),
                numero_chamada: turma.as_ref().and_then(|t| t.numero_chamada),
                aluno,
            }
        })
        .collect();

    Ok(Json(AlunosPage {
        items,
        total,
        page,
        page_size,
        contagem_status,
    }))
}

pub async fn obter_prontuario(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor", "nutricionista", "responsavel"])?;
    let tenant_id = active_tenant.0;

    check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let aluno = sqlx::query_as::<_, Aluno>(
        "SELECT * FROM alunos WHERE id = $1 AND tenant_id = $2",
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let prontuario = sqlx::query_as::<_, Prontuario>(
        "SELECT * FROM prontuarios WHERE aluno_id = $1 AND tenant_id = $2",
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let prontuario_record = match prontuario {
        Some(p) => p,
        None => {
            // Cria um prontuário padrão se ainda não existir
            sqlx::query_as::<_, Prontuario>(
                r#"
                INSERT INTO prontuarios (tenant_id, aluno_id, tipo_sanguineo, alergias, restricoes_alimentares, medicamentos_continuos, cuidados_especiais, historico_observacoes)
                VALUES ($1, $2, 'Não informado', 'Nenhuma alergia informada.', 'Sem restrições alimentares.', 'Nenhum medicamento contínuo.', 'Sem recomendações especiais.', 'Aluno sem ocorrências disciplinares ativas.')
                ON CONFLICT (tenant_id, aluno_id) DO UPDATE SET updated_at = NOW()
                RETURNING *
                "#,
            )
            .bind(tenant_id)
            .bind(aluno_id)
            .fetch_one(&mut *db)
            .await?
        }
    };

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CONSULTAR_PRONTUARIO",
        "prontuarios",
        Some(aluno_id.to_string()),
        Some(json!({ "aluno_nome": aluno.nome })),
    )
    .await;

    Ok(Json(json!({
        "aluno": aluno,
        "prontuario": prontuario_record
    })))
}

pub async fn salvar_prontuario(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
    Json(dto): Json<SalvarProntuarioDto>,
) -> Result<Json<Prontuario>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor", "nutricionista"])?;
    let tenant_id = active_tenant.0;

    // Verificar se aluno pertence ao tenant
    let existe_aluno = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM alunos WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if !existe_aluno {
        return Err(AppError::NotFound);
    }

    if let Some(ref ts) = dto.tipo_sanguineo {
        if !validar_tipo_sanguineo(ts) {
            return Err(AppError::BadRequest(
                "Tipo sanguíneo informado é inválido. Valores aceitos: A+, A-, B+, B-, AB+, AB-, O+, O- ou Não informado.".to_string(),
            ));
        }
    }

    let prontuario = sqlx::query_as::<_, Prontuario>(
        r#"
        INSERT INTO prontuarios (
            tenant_id, aluno_id, tipo_sanguineo, alergias, restricoes_alimentares,
            medicamentos_continuos, cuidados_especiais, historico_observacoes, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (tenant_id, aluno_id) DO UPDATE SET
            tipo_sanguineo = COALESCE(EXCLUDED.tipo_sanguineo, prontuarios.tipo_sanguineo),
            alergias = COALESCE(EXCLUDED.alergias, prontuarios.alergias),
            restricoes_alimentares = COALESCE(EXCLUDED.restricoes_alimentares, prontuarios.restricoes_alimentares),
            medicamentos_continuos = COALESCE(EXCLUDED.medicamentos_continuos, prontuarios.medicamentos_continuos),
            cuidados_especiais = COALESCE(EXCLUDED.cuidados_especiais, prontuarios.cuidados_especiais),
            historico_observacoes = COALESCE(EXCLUDED.historico_observacoes, prontuarios.historico_observacoes),
            updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .bind(&dto.tipo_sanguineo)
    .bind(&dto.alergias)
    .bind(&dto.restricoes_alimentares)
    .bind(&dto.medicamentos_continuos)
    .bind(&dto.cuidados_especiais)
    .bind(&dto.historico_observacoes)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_PRONTUARIO",
        "prontuarios",
        Some(aluno_id.to_string()),
        Some(json!({
            "tipo_sanguineo": prontuario.tipo_sanguineo,
            "alergias": prontuario.alergias,
            "restricoes_alimentares": prontuario.restricoes_alimentares
        })),
    )
    .await;

    Ok(Json(prontuario))
}

pub async fn atualizar_aluno(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
    Json(dto): Json<UpdateAlunoDto>,
) -> Result<Json<Aluno>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let status_normalizado = match dto.status.as_deref() {
        Some(s) => Some(normalizar_status_aluno(s)?),
        None => None,
    };

    let mut tx = (&mut *db).begin().await?;

    let aluno = sqlx::query_as::<_, Aluno>(
        r#"
        UPDATE alunos
        SET 
            nome = COALESCE($1, nome),
            cpf = COALESCE($2, cpf),
            data_nascimento = COALESCE($3, data_nascimento),
            nome_responsavel = COALESCE($4, nome_responsavel),
            cpf_responsavel_legal = COALESCE($5, cpf_responsavel_legal),
            email_responsavel = COALESCE($6, email_responsavel),
            telefone_responsavel = COALESCE($7, telefone_responsavel),
            parentesco_responsavel_legal = COALESCE($8, parentesco_responsavel_legal),
            responsavel_financeiro_igual_legal = COALESCE($9, responsavel_financeiro_igual_legal),
            nome_responsavel_financeiro = COALESCE($10, nome_responsavel_financeiro),
            cpf_responsavel_financeiro = COALESCE($11, cpf_responsavel_financeiro),
            email_responsavel_financeiro = COALESCE($12, email_responsavel_financeiro),
            telefone_responsavel_financeiro = COALESCE($13, telefone_responsavel_financeiro),
            parentesco_responsavel_financeiro = COALESCE($14, parentesco_responsavel_financeiro),
            cep = COALESCE($15, cep),
            logradouro = COALESCE($16, logradouro),
            numero = COALESCE($17, numero),
            complemento = COALESCE($18, complemento),
            bairro = COALESCE($19, bairro),
            cidade = COALESCE($20, cidade),
            estado = COALESCE($21, estado),
            telefone_secundario = COALESCE($22, telefone_secundario),
            contato_emergencia_nome = COALESCE($23, contato_emergencia_nome),
            contato_emergencia_telefone = COALESCE($24, contato_emergencia_telefone),
            contato_emergencia_parentesco = COALESCE($25, contato_emergencia_parentesco),
            status = COALESCE($26, status),
            responsavel_user_id = COALESCE($27, responsavel_user_id),
            updated_at = NOW()
        WHERE id = $28 AND tenant_id = $29
        RETURNING *
        "#,
    )
    .bind(dto.nome)
    .bind(dto.cpf)
    .bind(dto.data_nascimento)
    .bind(dto.nome_responsavel)
    .bind(dto.cpf_responsavel_legal)
    .bind(dto.email_responsavel)
    .bind(dto.telefone_responsavel)
    .bind(dto.parentesco_responsavel_legal)
    .bind(dto.responsavel_financeiro_igual_legal)
    .bind(dto.nome_responsavel_financeiro)
    .bind(dto.cpf_responsavel_financeiro)
    .bind(dto.email_responsavel_financeiro)
    .bind(dto.telefone_responsavel_financeiro)
    .bind(dto.parentesco_responsavel_financeiro)
    .bind(dto.cep)
    .bind(dto.logradouro)
    .bind(dto.numero)
    .bind(dto.complemento)
    .bind(dto.bairro)
    .bind(dto.cidade)
    .bind(dto.estado)
    .bind(dto.telefone_secundario)
    .bind(dto.contato_emergencia_nome)
    .bind(dto.contato_emergencia_telefone)
    .bind(dto.contato_emergencia_parentesco)
    .bind(status_normalizado.as_deref())
    .bind(dto.responsavel_user_id)
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(resp_id) = dto.responsavel_user_id {
        sqlx::query(
            r#"
            INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id, parentesco)
            VALUES ($1, $2, $3, 'Pai/Mãe/Responsável Legal')
            ON CONFLICT (tenant_id, responsavel_user_id, aluno_id) DO NOTHING
            "#,
        )
        .bind(tenant_id)
        .bind(resp_id)
        .bind(aluno.id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_ALUNO",
        "aluno",
        Some(aluno_id.to_string()),
        None,
    )
    .await;

    Ok(Json(aluno))
}

pub async fn deletar_aluno(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let result = sqlx::query(
        "UPDATE alunos SET status = 'inativo', updated_at = NOW() WHERE id = $1 AND tenant_id = $2"
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "INATIVAR_ALUNO",
        "aluno",
        Some(aluno_id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "status": "sucesso", "mensagem": "Aluno inativado com sucesso mantendo integridade histórica." })))
}

pub async fn listar_meus_alunos(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Aluno>>, AppError> {
    let tenant_id = active_tenant.0;

    let alunos = sqlx::query_as::<_, Aluno>(
        r#"
        SELECT DISTINCT a.* FROM alunos a
        LEFT JOIN responsaveis_alunos ra ON a.id = ra.aluno_id
        WHERE a.tenant_id = $1 AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)
        ORDER BY a.nome ASC
        "#,
    )
    .bind(tenant_id)
    .bind(auth_user.id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(alunos))
}

pub async fn vincular_responsavel_aluno(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<VincularResponsavelDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    sqlx::query(
        r#"
        INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id, parentesco)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tenant_id, responsavel_user_id, aluno_id) DO NOTHING
        "#,
    )
    .bind(tenant_id)
    .bind(dto.responsavel_user_id)
    .bind(dto.aluno_id)
    .bind(dto.parentesco.unwrap_or_else(|| "Pai/Mãe/Responsável Legal".to_string()))
    .execute(&mut *db)
    .await?;

    sqlx::query(
        "UPDATE alunos SET responsavel_user_id = $1 WHERE id = $2 AND tenant_id = $3 AND responsavel_user_id IS NULL",
    )
    .bind(dto.responsavel_user_id)
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "VINCULAR_RESPONSAVEL",
        "responsaveis_alunos",
        Some(dto.aluno_id.to_string()),
        Some(json!({ "responsavel_user_id": dto.responsavel_user_id })),
    )
    .await;

    Ok(Json(json!({ "status": "sucesso", "mensagem": "Vínculo responsável-aluno realizado com sucesso." })))
}

// --- GESTÃO DE TURMAS & SERIAÇÃO ---

// --- GESTÃO DE TURMAS, SALAS & ENSALAMENTO ---

pub async fn criar_turma(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateTurmaDto>,
) -> Result<Json<TurmaDetalhada>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;
    let cap = dto.capacidade_maxima.unwrap_or(35);
    let etapa = dto.etapa_ensino.unwrap_or_else(|| "fundamental_1".to_string());
    let turno = dto.turno.unwrap_or_else(|| "matutino".to_string());
    let status = dto.status.unwrap_or_else(|| "ativo".to_string());

    let turma = sqlx::query_as::<_, Turma>(
        r#"
        INSERT INTO turmas (tenant_id, sala_id, codigo, nome, etapa_ensino, serie, turno, ano_letivo, capacidade_maxima, professor_regente_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.sala_id)
    .bind(&dto.codigo)
    .bind(&dto.nome)
    .bind(&etapa)
    .bind(&dto.serie)
    .bind(&turno)
    .bind(dto.ano_letivo)
    .bind(cap)
    .bind(dto.professor_regente_id)
    .bind(&status)
    .fetch_one(&mut *db)
    .await?;

    let sala_nome = if let Some(sid) = turma.sala_id {
        sqlx::query_scalar::<_, String>("SELECT nome FROM salas WHERE id = $1")
            .bind(sid)
            .fetch_optional(&mut *db)
            .await?
    } else {
        None
    };

    let professor_regente_nome = if let Some(pid) = turma.professor_regente_id {
        sqlx::query_scalar::<_, String>("SELECT name FROM users WHERE id = $1")
            .bind(pid)
            .fetch_optional(&mut *db)
            .await?
    } else {
        None
    };

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_TURMA",
        "turma",
        Some(turma.id.to_string()),
        Some(json!({ "nome": turma.nome, "ano_letivo": turma.ano_letivo, "turno": turma.turno })),
    )
    .await;

    Ok(Json(TurmaDetalhada {
        id: turma.id,
        tenant_id: turma.tenant_id,
        sala_id: turma.sala_id,
        sala_nome,
        codigo: turma.codigo,
        nome: turma.nome,
        etapa_ensino: turma.etapa_ensino,
        serie: turma.serie,
        turno: turma.turno,
        ano_letivo: turma.ano_letivo,
        capacidade_maxima: turma.capacidade_maxima,
        professor_regente_id: turma.professor_regente_id,
        professor_regente_nome,
        status: turma.status,
        alunos_matriculados: 0,
        vagas_restantes: turma.capacidade_maxima as i64,
        created_at: turma.created_at,
    }))
}

pub async fn listar_turmas(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<TurmaDetalhada>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor", "responsavel"])?;
    let tenant_id = active_tenant.0;

    let rows = sqlx::query(
        r#"
        SELECT 
            t.id,
            t.tenant_id,
            t.sala_id,
            s.nome AS sala_nome,
            t.codigo,
            t.nome,
            t.etapa_ensino,
            t.serie,
            t.turno,
            t.ano_letivo,
            t.capacidade_maxima,
            t.professor_regente_id,
            u.name AS professor_regente_nome,
            t.status,
            COALESCE(COUNT(ta.id) FILTER (WHERE ta.status = 'ativo'), 0)::int8 AS alunos_matriculados,
            t.created_at
        FROM turmas t
        LEFT JOIN salas s ON t.sala_id = s.id
        LEFT JOIN users u ON t.professor_regente_id = u.id
        LEFT JOIN turma_alunos ta ON t.id = ta.turma_id
        WHERE t.tenant_id = $1
        GROUP BY t.id, s.nome, u.name
        ORDER BY t.ano_letivo DESC, t.nome ASC
        "#,
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let turmas = rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            let cap: i32 = row.get("capacidade_maxima");
            let matriculados: i64 = row.get("alunos_matriculados");
            let vagas = (cap as i64 - matriculados).max(0);
            TurmaDetalhada {
                id: row.get("id"),
                tenant_id: row.get("tenant_id"),
                sala_id: row.get("sala_id"),
                sala_nome: row.get("sala_nome"),
                codigo: row.get("codigo"),
                nome: row.get("nome"),
                etapa_ensino: row.get("etapa_ensino"),
                serie: row.get("serie"),
                turno: row.get("turno"),
                ano_letivo: row.get("ano_letivo"),
                capacidade_maxima: cap,
                professor_regente_id: row.get("professor_regente_id"),
                professor_regente_nome: row.get("professor_regente_nome"),
                status: row.get("status"),
                alunos_matriculados: matriculados,
                vagas_restantes: vagas,
                created_at: row.get("created_at"),
            }
        })
        .collect();

    Ok(Json(turmas))
}

pub async fn obter_turma(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<TurmaDetalhada>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor", "responsavel"])?;
    let tenant_id = active_tenant.0;

    let row = sqlx::query(
        r#"
        SELECT 
            t.id,
            t.tenant_id,
            t.sala_id,
            s.nome AS sala_nome,
            t.codigo,
            t.nome,
            t.etapa_ensino,
            t.serie,
            t.turno,
            t.ano_letivo,
            t.capacidade_maxima,
            t.professor_regente_id,
            u.name AS professor_regente_nome,
            t.status,
            COALESCE(COUNT(ta.id) FILTER (WHERE ta.status = 'ativo'), 0)::int8 AS alunos_matriculados,
            t.created_at
        FROM turmas t
        LEFT JOIN salas s ON t.sala_id = s.id
        LEFT JOIN users u ON t.professor_regente_id = u.id
        LEFT JOIN turma_alunos ta ON t.id = ta.turma_id
        WHERE t.id = $1 AND t.tenant_id = $2
        GROUP BY t.id, s.nome, u.name
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    use sqlx::Row;
    let cap: i32 = row.get("capacidade_maxima");
    let matriculados: i64 = row.get("alunos_matriculados");
    let vagas = (cap as i64 - matriculados).max(0);

    Ok(Json(TurmaDetalhada {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        sala_id: row.get("sala_id"),
        sala_nome: row.get("sala_nome"),
        codigo: row.get("codigo"),
        nome: row.get("nome"),
        etapa_ensino: row.get("etapa_ensino"),
        serie: row.get("serie"),
        turno: row.get("turno"),
        ano_letivo: row.get("ano_letivo"),
        capacidade_maxima: cap,
        professor_regente_id: row.get("professor_regente_id"),
        professor_regente_nome: row.get("professor_regente_nome"),
        status: row.get("status"),
        alunos_matriculados: matriculados,
        vagas_restantes: vagas,
        created_at: row.get("created_at"),
    }))
}

pub async fn atualizar_turma(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
    Json(dto): Json<UpdateTurmaDto>,
) -> Result<Json<Turma>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let turma = sqlx::query_as::<_, Turma>(
        r#"
        UPDATE turmas
        SET
            sala_id = COALESCE($1, sala_id),
            codigo = COALESCE($2, codigo),
            nome = COALESCE($3, nome),
            etapa_ensino = COALESCE($4, etapa_ensino),
            serie = COALESCE($5, serie),
            turno = COALESCE($6, turno),
            ano_letivo = COALESCE($7, ano_letivo),
            capacidade_maxima = COALESCE($8, capacidade_maxima),
            professor_regente_id = COALESCE($9, professor_regente_id),
            status = COALESCE($10, status)
        WHERE id = $11 AND tenant_id = $12
        RETURNING *
        "#,
    )
    .bind(dto.sala_id)
    .bind(dto.codigo)
    .bind(dto.nome)
    .bind(dto.etapa_ensino)
    .bind(dto.serie)
    .bind(dto.turno)
    .bind(dto.ano_letivo)
    .bind(dto.capacidade_maxima)
    .bind(dto.professor_regente_id)
    .bind(dto.status)
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ATUALIZAR_TURMA",
        "turma",
        Some(turma_id.to_string()),
        None,
    )
    .await;

    Ok(Json(turma))
}

pub async fn deletar_turma(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let result = sqlx::query("DELETE FROM turmas WHERE id = $1 AND tenant_id = $2")
        .bind(turma_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DELETAR_TURMA",
        "turma",
        Some(turma_id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "status": "sucesso", "mensagem": "Turma removida com sucesso." })))
}

pub fn validar_capacidade_turma(alunos_ativos: i64, capacidade_maxima: i32) -> Result<(), &'static str> {
    if alunos_ativos >= capacidade_maxima as i64 {
        Err("Capacidade máxima da turma atingida. Ensalamento bloqueado para evitar sobrelotação.")
    } else {
        Ok(())
    }
}

#[allow(dead_code)]
pub fn validar_choque_horario(
    dia_semana_a: u8,
    hora_inicio_a: &str,
    hora_fim_a: &str,
    dia_semana_b: u8,
    hora_inicio_b: &str,
    hora_fim_b: &str,
) -> bool {
    if dia_semana_a != dia_semana_b {
        return false;
    }
    let max_inicio = hora_inicio_a.max(hora_inicio_b);
    let min_fim = hora_fim_a.min(hora_fim_b);
    max_inicio < min_fim
}

// --- VÍNCULOS ALUNO-TURMA (ENSALAMENTO & CHAMADA) ---

pub async fn listar_alunos_turma(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Vec<AlunoTurmaDetalhado>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let rows = sqlx::query(
        r#"
        SELECT 
            ta.id,
            ta.aluno_id,
            a.nome,
            a.cpf,
            a.data_nascimento,
            ta.numero_chamada,
            a.nome_responsavel,
            a.telefone_responsavel,
            ta.status,
            ta.data_matricula
        FROM turma_alunos ta
        JOIN alunos a ON ta.aluno_id = a.id
        WHERE ta.turma_id = $1 AND ta.tenant_id = $2
        ORDER BY COALESCE(ta.numero_chamada, 9999) ASC, a.nome ASC
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let alunos = rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            AlunoTurmaDetalhado {
                id: row.get("id"),
                aluno_id: row.get("aluno_id"),
                nome: row.get("nome"),
                cpf: row.get("cpf"),
                data_nascimento: row.get("data_nascimento"),
                numero_chamada: row.get("numero_chamada"),
                nome_responsavel: row.get("nome_responsavel"),
                telefone_responsavel: row.get("telefone_responsavel"),
                status: row.get("status"),
                data_matricula: row.get("data_matricula"),
            }
        })
        .collect();

    Ok(Json(alunos))
}

pub async fn matricular_aluno_turma(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<MatricularTurmaDto>,
) -> Result<Json<TurmaAluno>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    // 1. Validar existência da turma no tenant
    let turma = sqlx::query_as::<_, Turma>(
        "SELECT * FROM turmas WHERE id = $1 AND tenant_id = $2",
    )
    .bind(dto.turma_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    // 2. Checar se o aluno já está matriculado e ativo para evitar falso bloqueio por capacidade
    let aluno_ja_matriculado = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM turma_alunos WHERE turma_id = $1 AND aluno_id = $2 AND tenant_id = $3 AND status = 'ativo')",
    )
    .bind(dto.turma_id)
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if !aluno_ja_matriculado {
        let count_alunos = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM turma_alunos WHERE turma_id = $1 AND tenant_id = $2 AND status = 'ativo'",
        )
        .bind(dto.turma_id)
        .bind(tenant_id)
        .fetch_one(&mut *db)
        .await?;

        if let Err(err_msg) = validar_capacidade_turma(count_alunos, turma.capacidade_maxima) {
            return Err(AppError::BadRequest(err_msg.to_string()));
        }
    }

    // Calcular número de chamada se não fornecido
    let num_chamada = if let Some(num) = dto.numero_chamada {
        num
    } else {
        let max_num = sqlx::query_scalar::<_, Option<i32>>(
            "SELECT MAX(numero_chamada) FROM turma_alunos WHERE turma_id = $1 AND tenant_id = $2",
        )
        .bind(dto.turma_id)
        .bind(tenant_id)
        .fetch_one(&mut *db)
        .await?
        .unwrap_or(0);
        max_num + 1
    };

    let turma_aluno = sqlx::query_as::<_, TurmaAluno>(
        r#"
        INSERT INTO turma_alunos (tenant_id, turma_id, aluno_id, numero_chamada, data_matricula, status)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, 'ativo')
        ON CONFLICT (turma_id, aluno_id) DO UPDATE SET 
            status = 'ativo',
            numero_chamada = COALESCE(EXCLUDED.numero_chamada, turma_alunos.numero_chamada)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(dto.aluno_id)
    .bind(num_chamada)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "MATRICULAR_ALUNO_TURMA",
        "turma_alunos",
        Some(turma_aluno.id.to_string()),
        Some(json!({ "turma_id": dto.turma_id, "aluno_id": dto.aluno_id, "numero_chamada": num_chamada })),
    )
    .await;

    Ok(Json(turma_aluno))
}

pub async fn desenturmar_aluno_turma(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path((turma_id, aluno_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let res = sqlx::query(
        "DELETE FROM turma_alunos WHERE turma_id = $1 AND aluno_id = $2 AND tenant_id = $3",
    )
    .bind(turma_id)
    .bind(aluno_id)
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
        "DESENTURMAR_ALUNO",
        "turma_alunos",
        Some(aluno_id.to_string()),
        Some(json!({ "turma_id": turma_id })),
    )
    .await;

    Ok(Json(json!({ "status": "sucesso", "mensagem": "Aluno removido da turma com sucesso." })))
}

pub async fn transferir_aluno_turma(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<TransferirAlunoTurmaDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let mut tx = (&mut *db).begin().await?;

    let turma_dest = sqlx::query_as::<_, Turma>(
        "SELECT * FROM turmas WHERE id = $1 AND tenant_id = $2",
    )
    .bind(dto.turma_destino_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let count_alunos_dest = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM turma_alunos WHERE turma_id = $1 AND tenant_id = $2 AND status = 'ativo'",
    )
    .bind(dto.turma_destino_id)
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if let Err(err) = validar_capacidade_turma(count_alunos_dest, turma_dest.capacidade_maxima) {
        return Err(AppError::BadRequest(err.to_string()));
    }

    sqlx::query(
        "UPDATE turma_alunos SET status = 'transferido' WHERE turma_id = $1 AND aluno_id = $2 AND tenant_id = $3",
    )
    .bind(dto.turma_origem_id)
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;

    let max_num = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(numero_chamada) FROM turma_alunos WHERE turma_id = $1 AND tenant_id = $2",
    )
    .bind(dto.turma_destino_id)
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?
    .unwrap_or(0);
    let prox_num = max_num + 1;

    sqlx::query(
        r#"
        INSERT INTO turma_alunos (tenant_id, turma_id, aluno_id, numero_chamada, data_matricula, status)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, 'ativo')
        ON CONFLICT (turma_id, aluno_id) DO UPDATE SET status = 'ativo', numero_chamada = EXCLUDED.numero_chamada
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_destino_id)
    .bind(dto.aluno_id)
    .bind(prox_num)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "TRANSFERIR_ALUNO_TURMA",
        "turma_alunos",
        Some(dto.aluno_id.to_string()),
        Some(json!({
            "turma_origem_id": dto.turma_origem_id,
            "turma_destino_id": dto.turma_destino_id,
            "novo_numero_chamada": prox_num
        })),
    )
    .await;

    Ok(Json(json!({
        "status": "sucesso",
        "mensagem": "Aluno transferido para a nova turma com sucesso.",
        "novo_numero_chamada": prox_num
    })))
}

pub async fn renumerar_chamada_turma(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let mut tx = (&mut *db).begin().await?;

    let rows = sqlx::query(
        r#"
        SELECT ta.id 
        FROM turma_alunos ta
        JOIN alunos a ON ta.aluno_id = a.id
        WHERE ta.turma_id = $1 AND ta.tenant_id = $2 AND ta.status = 'ativo'
        ORDER BY a.nome ASC
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let total = rows.len();
    for (idx, row) in rows.into_iter().enumerate() {
        use sqlx::Row;
        let ta_id: Uuid = row.get("id");
        let num = (idx + 1) as i32;
        sqlx::query("UPDATE turma_alunos SET numero_chamada = $1 WHERE id = $2")
            .bind(num)
            .bind(ta_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "RENUMERAR_CHAMADA_TURMA",
        "turma_alunos",
        Some(turma_id.to_string()),
        Some(json!({ "total_renumerados": total })),
    )
    .await;

    Ok(Json(json!({
        "status": "sucesso",
        "mensagem": "Chamada renumerada em ordem alfabética com sucesso.",
        "total_alunos": total
    })))
}

// --- GESTÃO DE SALAS FÍSICAS ---

pub async fn listar_salas(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Sala>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let salas = sqlx::query_as::<_, Sala>(
        "SELECT * FROM salas WHERE tenant_id = $1 ORDER BY nome ASC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(salas))
}

pub async fn criar_sala(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateSalaDto>,
) -> Result<Json<Sala>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;
    let cap = dto.capacidade.unwrap_or(30);

    let sala = sqlx::query_as::<_, Sala>(
        r#"
        INSERT INTO salas (tenant_id, nome, capacidade)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.nome)
    .bind(cap)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_SALA",
        "salas",
        Some(sala.id.to_string()),
        Some(json!({ "nome": sala.nome, "capacidade": sala.capacidade })),
    )
    .await;

    Ok(Json(sala))
}

pub async fn deletar_sala(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(sala_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let res = sqlx::query("DELETE FROM salas WHERE id = $1 AND tenant_id = $2")
        .bind(sala_id)
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
        "DELETAR_SALA",
        "salas",
        Some(sala_id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "status": "sucesso", "mensagem": "Sala removida com sucesso." })))
}

// --- CONTRATOS DE MATRÍCULA & ASSINATURA ELETRÔNICA ---

pub fn gerar_hash_contrato(
    tenant_id: &Uuid,
    contrato_id: &Uuid,
    aluno_id: &Uuid,
    ano_letivo: i32,
    valor_total: f64,
    assinado_em_iso: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!(
        "CONTRATO_EDUCACIONAL_MP2200:T:{}:C:{}:A:{}:ANO:{}:VALOR:{:.2}:TS:{}",
        tenant_id,
        contrato_id,
        aluno_id,
        ano_letivo,
        valor_total,
        assinado_em_iso
    ));
    format!("{:x}", hasher.finalize())
}

pub async fn criar_contrato(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateContratoDto>,
) -> Result<Json<Contrato>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let aluno_existe = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM alunos WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(dto.aluno_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if !aluno_existe {
        return Err(AppError::NotFound);
    }

    let contrato = sqlx::query_as::<_, Contrato>(
        r#"
        INSERT INTO contratos (tenant_id, aluno_id, ano_letivo, valor_total, status)
        VALUES ($1, $2, $3, $4, 'pendente_assinatura')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(dto.ano_letivo)
    .bind(dto.valor_total)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_CONTRATO",
        "contratos",
        Some(contrato.id.to_string()),
        Some(json!({
            "aluno_id": contrato.aluno_id,
            "ano_letivo": contrato.ano_letivo,
            "valor_total": contrato.valor_total
        })),
    )
    .await;

    Ok(Json(contrato))
}

pub async fn obter_contrato(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(contrato_id): Path<Uuid>,
) -> Result<Json<Contrato>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "responsavel"])?;
    let tenant_id = active_tenant.0;

    let contrato = sqlx::query_as::<_, Contrato>(
        "SELECT * FROM contratos WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contrato_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    if auth_user.role == "responsavel" {
        check_aluno_ownership(&mut *db, &auth_user, contrato.aluno_id).await?;
    }

    Ok(Json(contrato))
}

pub async fn assinar_contrato(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    headers: axum::http::HeaderMap,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(contrato_id): Path<Uuid>,
    Json(dto): Json<AssinarContratoDto>,
) -> Result<Json<Contrato>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "responsavel"])?;
    let tenant_id = active_tenant.0;

    if !dto.aceite_termos {
        return Err(AppError::BadRequest(
            "O aceite formal dos termos é obrigatório para validação jurídica do contrato.".to_string(),
        ));
    }

    let contrato = sqlx::query_as::<_, Contrato>(
        "SELECT * FROM contratos WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contrato_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    if contrato.status == "assinado" {
        return Err(AppError::BadRequest(
            "Contrato já se encontra assinado e homologado juridicamente.".to_string(),
        ));
    }
    if contrato.status == "cancelado" {
        return Err(AppError::BadRequest(
            "Não é permitido assinar um contrato cancelado.".to_string(),
        ));
    }

    if auth_user.role == "responsavel" {
        check_aluno_ownership(&mut *db, &auth_user, contrato.aluno_id).await?;
    }

    let ip_origem = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let now = chrono::Utc::now();
    let hash_doc = gerar_hash_contrato(
        &tenant_id,
        &contrato.id,
        &contrato.aluno_id,
        contrato.ano_letivo,
        contrato.valor_total,
        &now.to_rfc3339(),
    );

    let contrato_assinado = sqlx::query_as::<_, Contrato>(
        r#"
        UPDATE contratos
        SET
            status = 'assinado',
            hash_documento = $1,
            assinado_em = $2
        WHERE id = $3 AND tenant_id = $4
        RETURNING *
        "#,
    )
    .bind(&hash_doc)
    .bind(now)
    .bind(contrato_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    // Parcelamento automático da anuidade (12×), aplicando desconto de grupo familiar se houver.
    let desconto = sqlx::query_scalar::<_, f64>(
        r#"
        SELECT COALESCE(MAX(gf.desconto_percentual), 0)::FLOAT8
        FROM alunos a
        LEFT JOIN grupos_familiares gf ON gf.id = a.grupo_familiar_id
        WHERE a.id = $1 AND a.tenant_id = $2
        "#,
    )
    .bind(contrato.aluno_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await
    .unwrap_or(0.0);

    let parcelas_geradas = match crate::services::faturamento::gerar_parcelas_contrato(
        &mut *db,
        tenant_id,
        contrato.aluno_id,
        contrato.id,
        contrato.ano_letivo,
        contrato.valor_total,
        12,
        "pix",
        10,
        desconto,
        2.0,
        1.0,
    )
    .await
    {
        Ok(faturas) => faturas.len(),
        Err(AppError::BadRequest(_)) => 0, // já havia parcelas
        Err(e) => return Err(e),
    };

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ASSINAR_CONTRATO",
        "contratos",
        Some(contrato.id.to_string()),
        Some(json!({
            "hash_documento": hash_doc,
            "assinado_em": now.to_rfc3339(),
            "aluno_id": contrato.aluno_id,
            "ip_origem": ip_origem,
            "parcelas_geradas": parcelas_geradas,
            "desconto_percentual": desconto
        })),
    )
    .await;

    Ok(Json(contrato_assinado))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validar_capacidade_turma_permite_quando_ha_vagas() {
        let resultado = validar_capacidade_turma(25, 30);
        assert!(resultado.is_ok());
    }

    #[test]
    fn test_validar_capacidade_turma_bloqueia_quando_lotada() {
        let resultado = validar_capacidade_turma(30, 30);
        assert!(resultado.is_err());
        assert_eq!(
            resultado.unwrap_err(),
            "Capacidade máxima da turma atingida. Ensalamento bloqueado para evitar sobrelotação."
        );

        let resultado_excedente = validar_capacidade_turma(35, 30);
        assert!(resultado_excedente.is_err());
    }

    #[test]
    fn test_validar_choque_horario_detecta_sobreposicao() {
        // Segunda-feira (1), das 08:00 às 10:00 vs 09:30 às 11:30 -> Choque detectado
        let tem_choque = validar_choque_horario(1, "08:00", "10:00", 1, "09:30", "11:30");
        assert!(tem_choque, "Deveria detectar sobreposição de horários");
    }

    #[test]
    fn test_validar_choque_horario_permite_horarios_disjuntos() {
        // Segunda-feira (1), das 08:00 às 09:40 vs 10:00 às 11:40 -> Sem choque
        let tem_choque = validar_choque_horario(1, "08:00", "09:40", 1, "10:00", "11:40");
        assert!(!tem_choque, "Horários contíguos/disjuntos não devem acusar choque");

        // Dias da semana diferentes não geram choque mesmo com mesmo horário
        let choque_dias_diferentes = validar_choque_horario(1, "08:00", "10:00", 2, "08:00", "10:00");
        assert!(!choque_dias_diferentes);
    }

    #[test]
    fn test_gerar_hash_contrato_determinismo_e_integridade() {
        let tenant_id = Uuid::new_v4();
        let contrato_id = Uuid::new_v4();
        let aluno_id = Uuid::new_v4();
        let ts = "2026-09-25T12:00:00Z";

        let hash1 = gerar_hash_contrato(&tenant_id, &contrato_id, &aluno_id, 2026, 18000.0, ts);
        let hash2 = gerar_hash_contrato(&tenant_id, &contrato_id, &aluno_id, 2026, 18000.0, ts);
        assert_eq!(hash1, hash2, "Hashes de contrato com parâmetros idênticos devem ser estritamente iguais");
        assert_eq!(hash1.len(), 64, "Hash SHA-256 deve ter 64 caracteres hexadecimais");

        let hash_adulterado = gerar_hash_contrato(&tenant_id, &contrato_id, &aluno_id, 2026, 18000.01, ts);
        assert_ne!(hash1, hash_adulterado, "Qualquer alteração de valor monetário deve alterar o hash");
    }

    #[test]
    fn test_validar_cpf_brasileiro_valido() {
        assert!(validar_cpf_brasileiro("52998224725"));
        assert!(validar_cpf_brasileiro("12345678909"));
        assert!(validar_cpf_brasileiro(&limpar_cpf("529.982.247-25")));
        assert!(validar_cpf_brasileiro(&limpar_cpf("123.456.789-09")));
    }

    #[test]
    fn test_validar_cpf_brasileiro_invalido() {
        // Dígitos verificadores incorretos
        assert!(!validar_cpf_brasileiro("52998224724"));
        // Todos os dígitos repetidos
        assert!(!validar_cpf_brasileiro("11111111111"));
        assert!(!validar_cpf_brasileiro("00000000000"));
        // Comprimento inválido
        assert!(!validar_cpf_brasileiro("1234567890"));
    }

    #[test]
    fn test_validar_telefone_brasileiro() {
        assert!(validar_telefone_brasileiro("(11) 98765-4321"));
        assert!(validar_telefone_brasileiro("11987654321"));
        assert!(validar_telefone_brasileiro("(11) 3456-7890")); // Fixo (10 dígitos)
        assert!(!validar_telefone_brasileiro("1234567")); // Muito curto
    }

    #[test]
    fn test_espelhar_responsavel_financeiro_quando_flag_true() {
        let dto = CreateAlunoDto {
            nome: "Aluno Teste".to_string(),
            cpf: "123.456.789-09".to_string(),
            data_nascimento: chrono::NaiveDate::from_ymd_opt(2015, 6, 1).unwrap(),
            nome_responsavel: "Mariana Souza".to_string(),
            cpf_responsavel_legal: Some("529.982.247-25".to_string()),
            email_responsavel: "mariana@email.com".to_string(),
            telefone_responsavel: "(11) 98765-4321".to_string(),
            parentesco_responsavel_legal: Some("Mãe".to_string()),
            responsavel_financeiro_igual_legal: true,
            nome_responsavel_financeiro: None,
            cpf_responsavel_financeiro: None,
            email_responsavel_financeiro: None,
            telefone_responsavel_financeiro: None,
            parentesco_responsavel_financeiro: None,
            cep: Some("01310-100".to_string()),
            logradouro: Some("Avenida Paulista".to_string()),
            numero: Some("1000".to_string()),
            complemento: None,
            bairro: Some("Bela Vista".to_string()),
            cidade: Some("São Paulo".to_string()),
            estado: Some("SP".to_string()),
            telefone_secundario: Some("(11) 3333-4444".to_string()),
            contato_emergencia_nome: Some("Vovó Clara".to_string()),
            contato_emergencia_telefone: Some("(11) 91111-2222".to_string()),
            contato_emergencia_parentesco: Some("Avó".to_string()),
            responsavel_user_id: None,
            status: None,
            tipo_sanguineo: Some("O+".to_string()),
            alergias: Some("Amendoim".to_string()),
            restricoes_alimentares: None,
            medicamentos_continuos: None,
            cuidados_especiais: None,
            historico_observacoes: None,
        };

        let (nome, cpf, email, tel, parentesco) = espelhar_responsavel_financeiro(&dto);
        assert_eq!(nome, "Mariana Souza");
        assert_eq!(cpf, Some("529.982.247-25".to_string()));
        assert_eq!(email, "mariana@email.com");
        assert_eq!(tel, "(11) 98765-4321");
        assert_eq!(parentesco, "Mãe");
    }

    #[test]
    fn test_espelhar_responsavel_financeiro_quando_flag_false_com_dados_distintos() {
        let dto = CreateAlunoDto {
            nome: "Aluno Teste 2".to_string(),
            cpf: "123.456.789-09".to_string(),
            data_nascimento: chrono::NaiveDate::from_ymd_opt(2015, 6, 1).unwrap(),
            nome_responsavel: "Mariana Souza".to_string(),
            cpf_responsavel_legal: Some("529.982.247-25".to_string()),
            email_responsavel: "mariana@email.com".to_string(),
            telefone_responsavel: "(11) 98765-4321".to_string(),
            parentesco_responsavel_legal: Some("Mãe".to_string()),
            responsavel_financeiro_igual_legal: false,
            nome_responsavel_financeiro: Some("Roberto Silva (Pai)".to_string()),
            cpf_responsavel_financeiro: Some("111.444.777-35".to_string()),
            email_responsavel_financeiro: Some("roberto.financeiro@email.com".to_string()),
            telefone_responsavel_financeiro: Some("(11) 99999-8888".to_string()),
            parentesco_responsavel_financeiro: Some("Pai / Resp. Financeiro".to_string()),
            cep: None,
            logradouro: None,
            numero: None,
            complemento: None,
            bairro: None,
            cidade: None,
            estado: None,
            telefone_secundario: None,
            contato_emergencia_nome: None,
            contato_emergencia_telefone: None,
            contato_emergencia_parentesco: None,
            responsavel_user_id: None,
            status: None,
            tipo_sanguineo: None,
            alergias: None,
            restricoes_alimentares: None,
            medicamentos_continuos: None,
            cuidados_especiais: None,
            historico_observacoes: None,
        };

        let (nome, cpf, email, tel, parentesco) = espelhar_responsavel_financeiro(&dto);
        assert_eq!(nome, "Roberto Silva (Pai)");
        assert_eq!(cpf, Some("111.444.777-35".to_string()));
        assert_eq!(email, "roberto.financeiro@email.com");
        assert_eq!(tel, "(11) 99999-8888");
        assert_eq!(parentesco, "Pai / Resp. Financeiro");
    }

    #[test]
    fn test_validar_tipo_sanguineo_padroes_e_invalido() {
        assert!(validar_tipo_sanguineo("O+"));
        assert!(validar_tipo_sanguineo("a-"));
        assert!(validar_tipo_sanguineo("AB+"));
        assert!(validar_tipo_sanguineo("Não informado"));
        assert!(validar_tipo_sanguineo(""));
        assert!(!validar_tipo_sanguineo("C+"));
        assert!(!validar_tipo_sanguineo("XYZ"));
    }
}



pub async fn criar_autorizado_retirada(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::secretaria::CreateAutorizadoRetiradaDto>,
) -> Result<axum::Json<crate::models::secretaria::AutorizadoRetirada>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "responsavel"])?;
    let tenant_id = active_tenant.0;

    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, dto.aluno_id).await?;

    let autorizado = sqlx::query_as::<_, crate::models::secretaria::AutorizadoRetirada>(
        r#"
        INSERT INTO autorizados_retirada (tenant_id, aluno_id, nome, rg_cpf, grau_parentesco, foto_url, telefone, autorizado_por)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.nome)
    .bind(&dto.rg_cpf)
    .bind(&dto.grau_parentesco)
    .bind(&dto.foto_url)
    .bind(&dto.telefone)
    .bind(auth_user.id)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "CRIAR_AUTORIZADO_RETIRADA", "autorizados_retirada", Some(autorizado.id.to_string()), Some(serde_json::json!({"aluno_id": dto.aluno_id, "nome": dto.nome}))).await;

    Ok(axum::Json(autorizado))
}

pub async fn listar_autorizados_retirada(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(aluno_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::secretaria::AutorizadoRetirada>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor", "responsavel"])?;
    let tenant_id = active_tenant.0;

    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let autorizados = sqlx::query_as::<_, crate::models::secretaria::AutorizadoRetirada>(
        "SELECT * FROM autorizados_retirada WHERE tenant_id = $1 AND aluno_id = $2 AND ativo = true"
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(axum::Json(autorizados))
}

pub async fn atualizar_autorizado_retirada(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path((aluno_id, autorizado_id)): axum::extract::Path<(Uuid, Uuid)>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::secretaria::CreateAutorizadoRetiradaDto>,
) -> Result<axum::Json<crate::models::secretaria::AutorizadoRetirada>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "responsavel"])?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let autorizado = sqlx::query_as::<_, crate::models::secretaria::AutorizadoRetirada>(
        r#"
        UPDATE autorizados_retirada
        SET nome = $1, rg_cpf = $2, grau_parentesco = $3, foto_url = $4, telefone = $5
        WHERE id = $6 AND tenant_id = $7 AND aluno_id = $8
        RETURNING *
        "#,
    )
    .bind(&dto.nome)
    .bind(&dto.rg_cpf)
    .bind(&dto.grau_parentesco)
    .bind(&dto.foto_url)
    .bind(&dto.telefone)
    .bind(autorizado_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "ATUALIZAR_AUTORIZADO_RETIRADA", "autorizados_retirada", Some(autorizado.id.to_string()), Some(serde_json::json!({"aluno_id": aluno_id, "nome": dto.nome}))).await;

    Ok(axum::Json(autorizado))
}

pub async fn deletar_autorizado_retirada(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path((aluno_id, autorizado_id)): axum::extract::Path<(Uuid, Uuid)>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "responsavel"])?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    sqlx::query(
        "UPDATE autorizados_retirada SET ativo = false WHERE id = $1 AND tenant_id = $2 AND aluno_id = $3"
    )
    .bind(autorizado_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .execute(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "DELETAR_AUTORIZADO_RETIRADA", "autorizados_retirada", Some(autorizado_id.to_string()), Some(serde_json::json!({"aluno_id": aluno_id}))).await;

    Ok(axum::Json(serde_json::json!({"status": "sucesso"})))
}

pub async fn criar_grupo_familiar(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::secretaria::CreateGrupoFamiliarDto>,
) -> Result<axum::Json<crate::models::secretaria::GrupoFamiliar>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let grupo = sqlx::query_as::<_, crate::models::secretaria::GrupoFamiliar>(
        r#"
        INSERT INTO grupos_familiares (tenant_id, responsavel_financeiro_id, nome_familia, desconto_percentual)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.responsavel_financeiro_id)
    .bind(&dto.nome_familia)
    .bind(dto.desconto_percentual)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "CRIAR_GRUPO_FAMILIAR", "grupos_familiares", Some(grupo.id.to_string()), Some(serde_json::json!({"nome": dto.nome_familia}))).await;

    Ok(axum::Json(grupo))
}

pub async fn listar_grupos_familiares(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<axum::Json<Vec<crate::models::secretaria::GrupoFamiliar>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let grupos = sqlx::query_as::<_, crate::models::secretaria::GrupoFamiliar>(
        "SELECT * FROM grupos_familiares WHERE tenant_id = $1"
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(axum::Json(grupos))
}
