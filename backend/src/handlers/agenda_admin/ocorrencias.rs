use super::{
    check_aluno_ownership, check_roles, json, log_audit, ActiveTenant, AppError, AppState,
    AuthUser, CreateOcorrenciaDto, Extension, Json, NaiveDate, OcorrenciaAluno, Path, Query, State,
    TenantDb, Uuid,
};

/// Tipos de ocorrência aceitos pelo registro. Mantém os tipos históricos da
/// Educação Infantil e acrescenta os usados no Fundamental.
pub const TIPOS_OCORRENCIA: &[&str] = &[
    // Educação Infantil (histórico)
    "febre",
    "indisposicao",
    "queda_arranhao",
    "atrito_colega",
    "outros",
    "outro", // grafia antiga ainda enviada pelo painel da rotina infantil
    // Fundamental
    "comportamento",
    "atraso",
    "falta_material",
    "saude",
    "elogio",
];

/// Tamanho máximo da descrição de uma ocorrência.
pub const OCORRENCIA_DESCRICAO_MAX: usize = 1000;

/// Tipo de ocorrência reconhecido (aceita maiúsculas/minúsculas e espaços).
pub fn tipo_ocorrencia_valido(tipo: &str) -> bool {
    let normalizado = tipo.trim().to_lowercase();
    TIPOS_OCORRENCIA.contains(&normalizado.as_str())
}

/// `elogio` e `saude` sempre avisam a família; nos demais tipos vale a opção
/// enviada por quem registrou (padrão: avisar).
pub fn ocorrencia_avisa_familia(tipo: &str, notificado: Option<bool>) -> bool {
    if matches!(tipo, "elogio" | "saude") {
        return true;
    }
    notificado.unwrap_or(true)
}

/// Professor só registra/consulta ocorrência de aluno de turma em que tem
/// atribuição (`turma_professores`) ou da qual é regente.
async fn professor_vinculado_ao_aluno(
    db: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    professor_id: Uuid,
    aluno_id: Uuid,
) -> Result<bool, AppError> {
    let vinculado: (bool,) = sqlx::query_as(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM turma_alunos ta
            JOIN turmas t ON t.id = ta.turma_id AND t.tenant_id = ta.tenant_id
            WHERE ta.tenant_id = $1
              AND ta.aluno_id = $2
              AND ta.status = 'ativo'
              AND (
                  EXISTS (
                      SELECT 1 FROM turma_professores tp
                      WHERE tp.tenant_id = ta.tenant_id
                        AND tp.turma_id = ta.turma_id
                        AND tp.professor_id = $3
                  )
                  OR t.professor_regente_id = $3
              )
        )
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .bind(professor_id)
    .fetch_one(db)
    .await?;
    Ok(vinculado.0)
}

/// Professor só consulta ocorrências de turma em que tem atribuição ou é regente.
async fn professor_vinculado_a_turma(
    db: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    professor_id: Uuid,
    turma_id: Uuid,
) -> Result<bool, AppError> {
    let vinculado: (bool,) = sqlx::query_as(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM turmas t
            WHERE t.id = $1
              AND t.tenant_id = $2
              AND (
                  t.professor_regente_id = $3
                  OR EXISTS (
                      SELECT 1 FROM turma_professores tp
                      WHERE tp.tenant_id = t.tenant_id
                        AND tp.turma_id = t.id
                        AND tp.professor_id = $3
                  )
              )
        )
        "#,
    )
    .bind(turma_id)
    .bind(tenant_id)
    .bind(professor_id)
    .fetch_one(db)
    .await?;
    Ok(vinculado.0)
}

pub async fn registrar_ocorrencia(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateOcorrenciaDto>,
) -> Result<Json<OcorrenciaAluno>, AppError> {
    check_roles(&auth_user, &["admin", "professor", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let tipo = dto.tipo_ocorrencia.trim().to_lowercase();
    if !tipo_ocorrencia_valido(&tipo) {
        return Err(AppError::BadRequest(format!(
            "Tipo de ocorrência não reconhecido. Valores aceitos: {}.",
            TIPOS_OCORRENCIA.join(", ")
        )));
    }

    let descricao = dto.descricao.trim().to_string();
    if descricao.is_empty() {
        return Err(AppError::BadRequest(
            "A descrição da ocorrência é obrigatória.".to_string(),
        ));
    }
    if descricao.chars().count() > OCORRENCIA_DESCRICAO_MAX {
        return Err(AppError::BadRequest(format!(
            "A descrição da ocorrência pode ter no máximo {OCORRENCIA_DESCRICAO_MAX} caracteres."
        )));
    }

    let aluno_existe: (bool,) =
        sqlx::query_as("SELECT EXISTS(SELECT 1 FROM alunos WHERE id = $1 AND tenant_id = $2)")
            .bind(dto.aluno_id)
            .bind(tenant_id)
            .fetch_one(&mut *db)
            .await?;
    if !aluno_existe.0 {
        return Err(AppError::NotFound);
    }

    // Professor precisa de vínculo com a turma do aluno (atribuição ou regente).
    let role_norm = crate::middleware::rbac::role_key(&auth_user.role);
    if role_norm == "professor"
        && !professor_vinculado_ao_aluno(&mut db, tenant_id, auth_user.id, dto.aluno_id).await?
    {
        return Err(AppError::Forbidden(
            "Você não está atribuído a uma turma deste aluno.".to_string(),
        ));
    }

    let notificado = ocorrencia_avisa_familia(&tipo, dto.notificado_responsavel);

    let ocorrencia = sqlx::query_as::<_, OcorrenciaAluno>(
        r#"
        INSERT INTO ocorrencias_aluno (tenant_id, aluno_id, professor_id, turma_id, tipo_ocorrencia, descricao, prioridade, notificado_responsavel)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(auth_user.id)
    .bind(dto.turma_id)
    .bind(&tipo)
    .bind(&descricao)
    .bind(dto.prioridade.unwrap_or_else(|| "urgente".to_string()))
    .bind(notificado)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "REGISTRAR_OCORRENCIA",
        "ocorrencias_aluno",
        Some(ocorrencia.id.to_string()),
        Some(json!({
            "aluno_id": dto.aluno_id,
            "turma_id": dto.turma_id,
            "tipo_ocorrencia": tipo,
            "notificado_responsavel": notificado
        })),
    )
    .await;

    Ok(Json(ocorrencia))
}

pub async fn listar_ocorrencias_aluno(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<Vec<OcorrenciaAluno>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "professor", "gestor", "secretaria", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    // Perfis de secretaria/gestão, aluno e responsável seguem a guarda de
    // vínculo comum. Professor também passa quando é regente da turma.
    match check_aluno_ownership(&mut *db, &auth_user, aluno_id).await {
        Ok(()) => {}
        Err(erro) => {
            let regente = crate::middleware::rbac::role_key(&auth_user.role) == "professor"
                && professor_vinculado_ao_aluno(&mut db, tenant_id, auth_user.id, aluno_id).await?;
            if !regente {
                return Err(erro);
            }
        }
    }

    let ocorrencias = sqlx::query_as::<_, OcorrenciaAluno>(
        "SELECT * FROM ocorrencias_aluno WHERE tenant_id = $1 AND aluno_id = $2 ORDER BY created_at DESC",
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(ocorrencias))
}

#[derive(Debug, serde::Deserialize)]
pub struct OcorrenciasTurmaQuery {
    pub turma_id: Uuid,
    /// Dia de referência no formato YYYY-MM-DD (fuso de Brasília).
    pub data: Option<NaiveDate>,
}

/// Ocorrências de uma turma, opcionalmente de um único dia. Usada pelo Diário
/// do Fundamental para sinalizar os alunos com observação registrada no dia.
pub async fn listar_ocorrencias_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<OcorrenciasTurmaQuery>,
) -> Result<Json<Vec<OcorrenciaAluno>>, AppError> {
    check_roles(&auth_user, &["admin", "professor", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let role_norm = crate::middleware::rbac::role_key(&auth_user.role);
    if role_norm == "professor"
        && !professor_vinculado_a_turma(&mut db, tenant_id, auth_user.id, query.turma_id).await?
    {
        return Err(AppError::Forbidden(
            "Você não está atribuído a esta turma.".to_string(),
        ));
    }

    // "Registrada no dia" usa o fuso de Brasília (UTC-3), a mesma aproximação
    // documentada para o restante do módulo.
    let intervalo = query.data.map(|data| {
        let inicio = data.and_time(chrono::NaiveTime::MIN) - chrono::Duration::hours(3);
        let fim = (data + chrono::Duration::days(1)).and_time(chrono::NaiveTime::MIN)
            - chrono::Duration::hours(3);
        (inicio.and_utc(), fim.and_utc())
    });
    let (inicio, fim) = match intervalo {
        Some((i, f)) => (Some(i), Some(f)),
        None => (None, None),
    };

    let ocorrencias = sqlx::query_as::<_, OcorrenciaAluno>(
        r#"
        SELECT * FROM ocorrencias_aluno
        WHERE tenant_id = $1
          AND turma_id = $2
          AND ($3::timestamptz IS NULL OR created_at >= $3)
          AND ($4::timestamptz IS NULL OR created_at < $4)
        ORDER BY created_at DESC
        "#,
    )
    .bind(tenant_id)
    .bind(query.turma_id)
    .bind(inicio)
    .bind(fim)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(ocorrencias))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tipo_ocorrencia_valido() {
        // Tipos do Fundamental
        for tipo in [
            "comportamento",
            "atraso",
            "falta_material",
            "saude",
            "elogio",
            "outros",
        ] {
            assert!(tipo_ocorrencia_valido(tipo), "{tipo} deveria ser aceito");
        }
        // Tipos históricos da Educação Infantil continuam aceitos
        for tipo in [
            "febre",
            "indisposicao",
            "queda_arranhao",
            "atrito_colega",
            "outro",
        ] {
            assert!(
                tipo_ocorrencia_valido(tipo),
                "{tipo} deveria continuar aceito"
            );
        }
        // Normalização de caixa e espaços
        assert!(tipo_ocorrencia_valido("  Comportamento "));
        // Desconhecidos são rejeitados
        assert!(!tipo_ocorrencia_valido("grita"));
        assert!(!tipo_ocorrencia_valido(""));
    }

    #[test]
    fn test_ocorrencia_avisa_familia() {
        // Elogio e saúde sempre avisam, mesmo com a opção desmarcada.
        assert!(ocorrencia_avisa_familia("elogio", Some(false)));
        assert!(ocorrencia_avisa_familia("saude", Some(false)));
        // Padrão é avisar quando o campo não vem no corpo.
        assert!(ocorrencia_avisa_familia("atraso", None));
        // Demais tipos respeitam a escolha de quem registrou.
        assert!(!ocorrencia_avisa_familia("comportamento", Some(false)));
        assert!(ocorrencia_avisa_familia("comportamento", Some(true)));
    }
}
