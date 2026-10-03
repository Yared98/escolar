use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use serde_json::{json, Value};
use sqlx::Acquire;
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_aluno_ownership, check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::academico::{
        AdicionarDisciplinaTurmaDto, ApuracaoGabaritoDto, AtribuirProfessorDto, BoletimCompletoDto,
        BoletimDisciplinaDto, Cardapio, ConsultarDiarioQuery, CreateCardapioDto,
        CreateDisciplinaDto, CreateHorarioTurmaDto, CreateProjetoEducacionalDto, CreateSimuladoDto,
        DiarioClasse, DiarioDiaResponse, DiarioRecenteItem, DiariosRecentesQuery, Disciplina,
        HorarioTurma, HorarioTurmaDetalhado, Nota, PresencaDiaDto, ProjetoEducacional,
        ResultadoTriDto, SimuladoItem, SimuladoResposta, SimuladoTri, SyncDiarioDto,
        TurmaDisciplina, TurmaDisciplinaDetalhada, TurmaProfessor, TurmaProfessorDetalhado,
        UpdateDisciplinaDto,
    },
};

// ============================================================================
// MOTOR MATEMÁTICO TRI (Teoria de Resposta ao Item - Modelo Logístico 3PL)
// P_i(theta) = c_i + (1 - c_i) / (1 + exp(-1.7 * a_i * (theta - b_i)))
// ============================================================================

pub fn probabilidade_tri_3pl(theta: f64, a: f64, b: f64, c: f64) -> f64 {
    let d = 1.7; // Constante de métrica tradicional da ogiva normal
    let exponent = -d * a * (theta - b);
    let logit = 1.0 / (1.0 + exponent.exp());
    c + (1.0 - c) * logit
}

/// Estimação EAP (Expected A Posteriori) com prior Gaussiano N(0, 1)
/// Retorna: (theta_hat, escala_enem, coerencia_score, status_diagnostico)
pub fn estimar_proficiencia_eap(itens: &[(f64, f64, f64, bool)]) -> (f64, f64, f64, String) {
    if itens.is_empty() {
        return (0.0, 500.0, 1.0, "sem_itens".to_string());
    }

    // 41 nós de quadratura no intervalo [-4.0, 4.0]
    let n_quad = 41;
    let x_min = -4.0;
    let x_max = 4.0;
    let step = (x_max - x_min) / (n_quad - 1) as f64;

    let mut num = 0.0;
    let mut den = 0.0;

    for k in 0..n_quad {
        let x_k = x_min + (k as f64) * step;
        let prior = (-0.5 * x_k * x_k).exp();

        let mut likelihood = 1.0;
        for &(a, b, c, acerto) in itens {
            let p = probabilidade_tri_3pl(x_k, a, b, c).clamp(1e-6, 1.0 - 1e-6);
            if acerto {
                likelihood *= p;
            } else {
                likelihood *= 1.0 - p;
            }
        }

        let w = likelihood * prior;
        num += x_k * w;
        den += w;
    }

    let theta_hat = if den > 1e-12 {
        num / den
    } else {
        let acertos = itens.iter().filter(|&&(_, _, _, u)| u).count();
        ((acertos as f64 / itens.len() as f64) - 0.5) * 4.0
    };

    // Escala ENEM (Média 500, DP 100)
    let escala_enem = (500.0 + theta_hat * 100.0).clamp(200.0, 1000.0);

    // Análise de Coerência Pedagógica (Métrica Psicométrica de Inversão de Dificuldade):
    // Em um padrão consistente, a dificuldade média dos itens acertados deve ser menor ou igual à dos itens errados.
    // Se a dificuldade média dos acertos for significativamente superior à dos erros, há forte evidência de chute/acerto ao acaso.
    let (soma_b_acertos, count_acertos) = itens
        .iter()
        .filter(|&&(_, _, _, u)| u)
        .fold((0.0, 0), |(s, c), &(_, b, _, _)| (s + b, c + 1));

    let (soma_b_erros, count_erros) = itens
        .iter()
        .filter(|&&(_, _, _, u)| !u)
        .fold((0.0, 0), |(s, c), &(_, b, _, _)| (s + b, c + 1));

    let coerencia_score = if count_acertos > 0 && count_erros > 0 {
        let media_b_acertos = soma_b_acertos / count_acertos as f64;
        let media_b_erros = soma_b_erros / count_erros as f64;
        let inversao = media_b_acertos - media_b_erros;
        if inversao > 0.5 {
            (1.0 - (inversao * 0.3)).clamp(0.2, 0.75)
        } else {
            (1.0 - (inversao.max(0.0) * 0.2)).clamp(0.85, 1.0)
        }
    } else {
        1.0
    };

    let status_diagnostico = if coerencia_score >= 0.85 {
        "coerente".to_string()
    } else if coerencia_score >= 0.60 {
        "moderado".to_string()
    } else {
        "incoerente_chute_provavel".to_string()
    };

    (theta_hat, escala_enem, coerencia_score, status_diagnostico)
}

// ============================================================================
// HANDLERS ACADÊMICOS & BOLETIM
// ============================================================================

pub async fn sincronizar_diario_pwa(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<SyncDiarioDto>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;
    let professor_id = auth_user.id;
    let observacao = dto.observacao.clone().unwrap_or_default();
    if observacao.chars().count() > 4000 {
        return Err(AppError::BadRequest(
            "A observação livre aceita no máximo 4000 caracteres.".to_string(),
        ));
    }

    let mut tx = (&mut *db).begin().await?;

    let diario_existente: Option<DiarioClasse> = sqlx::query_as(
        "SELECT * FROM diarios_classe WHERE tenant_id = $1 AND turma_id = $2 AND data_aula = $3",
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(dto.data_aula)
    .fetch_optional(&mut *tx)
    .await?;

    let diario = match diario_existente {
        Some(d) => {
            sqlx::query(
                "UPDATE diarios_classe SET conteudo_ministrado = $1, observacao = $2 WHERE id = $3 AND tenant_id = $4",
            )
            .bind(&dto.conteudo_ministrado)
            .bind(&observacao)
            .bind(d.id)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
            d
        }
        None => {
            sqlx::query_as::<_, DiarioClasse>(
                r#"
                INSERT INTO diarios_classe (tenant_id, turma_id, professor_id, data_aula, conteudo_ministrado, observacao)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                "#,
            )
            .bind(tenant_id)
            .bind(dto.turma_id)
            .bind(professor_id)
            .bind(dto.data_aula)
            .bind(&dto.conteudo_ministrado)
            .bind(&observacao)
            .fetch_one(&mut *tx)
            .await?
        }
    };

    let mut total_presencas_salvas = 0;
    for item in dto.presencas {
        let presenca_existente: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM presencas WHERE tenant_id = $1 AND diario_id = $2 AND aluno_id = $3",
        )
        .bind(tenant_id)
        .bind(diario.id)
        .bind(item.aluno_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some((pid,)) = presenca_existente {
            sqlx::query(
                "UPDATE presencas SET presente = $1, justificativa = $2 WHERE id = $3 AND tenant_id = $4",
            )
            .bind(item.presente)
            .bind(&item.justificativa)
            .bind(pid)
            .bind(tenant_id)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                r#"
                INSERT INTO presencas (tenant_id, diario_id, aluno_id, presente, justificativa)
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(tenant_id)
            .bind(diario.id)
            .bind(item.aluno_id)
            .bind(item.presente)
            .bind(&item.justificativa)
            .execute(&mut *tx)
            .await?;
        }
        total_presencas_salvas += 1;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "SINCRONIZAR_DIARIO_PWA",
        "diarios_classe",
        Some(diario.id.to_string()),
        Some(json!({
            "turma_id": dto.turma_id,
            "data_aula": dto.data_aula,
            "total_presencas": total_presencas_salvas
        })),
    )
    .await;

    Ok(Json(json!({
        "diario_id": diario.id,
        "total_presencas_salvas": total_presencas_salvas,
        "status": "sincronizado_com_sucesso"
    })))
}

pub async fn consultar_diario_dia(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<ConsultarDiarioQuery>,
) -> Result<Json<DiarioDiaResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    let diario = sqlx::query_as::<_, DiarioClasse>(
        "SELECT * FROM diarios_classe WHERE tenant_id = $1 AND turma_id = $2 AND data_aula = $3",
    )
    .bind(tenant_id)
    .bind(query.turma_id)
    .bind(query.data_aula)
    .fetch_optional(&mut *db)
    .await?;

    match diario {
        Some(d) => {
            let presencas = sqlx::query_as::<_, PresencaDiaDto>(
                r#"
                SELECT aluno_id, presente, justificativa
                FROM presencas
                WHERE tenant_id = $1 AND diario_id = $2
                ORDER BY aluno_id
                "#,
            )
            .bind(tenant_id)
            .bind(d.id)
            .fetch_all(&mut *db)
            .await?;

            Ok(Json(DiarioDiaResponse {
                encontrado: true,
                diario_id: Some(d.id),
                turma_id: d.turma_id,
                data_aula: d.data_aula,
                conteudo_ministrado: d.conteudo_ministrado,
                observacao: d.observacao,
                presencas,
            }))
        }
        None => Ok(Json(DiarioDiaResponse {
            encontrado: false,
            diario_id: None,
            turma_id: query.turma_id,
            data_aula: query.data_aula,
            conteudo_ministrado: String::new(),
            observacao: String::new(),
            presencas: Vec::new(),
        })),
    }
}

pub async fn listar_diarios_recentes(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<DiariosRecentesQuery>,
) -> Result<Json<Vec<DiarioRecenteItem>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;
    let limit = query.limit.unwrap_or(10).clamp(1, 50);

    let itens = sqlx::query_as::<_, DiarioRecenteItem>(
        r#"
        SELECT
            d.id AS diario_id,
            d.data_aula,
            d.conteudo_ministrado,
            d.observacao,
            COUNT(p.id)::BIGINT AS total_presencas,
            COUNT(p.id) FILTER (WHERE p.presente = true)::BIGINT AS total_presentes
        FROM diarios_classe d
        LEFT JOIN presencas p ON p.diario_id = d.id AND p.tenant_id = d.tenant_id
        WHERE d.tenant_id = $1 AND d.turma_id = $2
        GROUP BY d.id, d.data_aula, d.conteudo_ministrado, d.observacao
        ORDER BY d.data_aula DESC
        LIMIT $3
        "#,
    )
    .bind(tenant_id)
    .bind(query.turma_id)
    .bind(limit)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(itens))
}

pub async fn consultar_boletim(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<BoletimCompletoDto>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "responsavel",
            "aluno",
        ],
    )?;
    let tenant_id = active_tenant.0;

    check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let aluno_nome: (String,) =
        sqlx::query_as("SELECT nome FROM alunos WHERE id = $1 AND tenant_id = $2")
            .bind(aluno_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .unwrap_or_else(|| ("Aluno Não Encontrado".to_string(),));

    let notas = sqlx::query_as::<_, Nota>(
        "SELECT * FROM notas WHERE tenant_id = $1 AND aluno_id = $2 ORDER BY disciplina_nome, periodo ASC",
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    let presenca_row: Option<(i64, i64)> = sqlx::query_as(
        "SELECT COUNT(*) FILTER (WHERE presente = true), COUNT(*) FROM presencas WHERE tenant_id = $1 AND aluno_id = $2",
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_optional(&mut *db)
    .await?;

    let freq_geral = match presenca_row {
        Some((presentes, total)) if total > 0 => (presentes as f64 / total as f64) * 100.0,
        _ => 100.0,
    };

    type BimestresNotas = (Option<f64>, Option<f64>, Option<f64>, Option<f64>);
    let mut disciplinas_map: std::collections::BTreeMap<String, BimestresNotas> =
        std::collections::BTreeMap::new();
    for n in notas {
        let entry = disciplinas_map
            .entry(n.disciplina_nome)
            .or_insert((None, None, None, None));
        match n.periodo.as_str() {
            "1_bimestre" => entry.0 = Some(n.nota),
            "2_bimestre" => entry.1 = Some(n.nota),
            "3_bimestre" => entry.2 = Some(n.nota),
            "4_bimestre" => entry.3 = Some(n.nota),
            _ => {
                if entry.0.is_none() {
                    entry.0 = Some(n.nota);
                } else if entry.1.is_none() {
                    entry.1 = Some(n.nota);
                } else if entry.2.is_none() {
                    entry.2 = Some(n.nota);
                } else {
                    entry.3 = Some(n.nota);
                }
            }
        }
    }

    let mut disciplinas = Vec::new();
    let mut soma_medias = 0.0;
    for (nome, (n1, n2, n3, n4)) in disciplinas_map {
        let mut count = 0;
        let mut sum = 0.0;
        if let Some(v) = n1 {
            sum += v;
            count += 1;
        }
        if let Some(v) = n2 {
            sum += v;
            count += 1;
        }
        if let Some(v) = n3 {
            sum += v;
            count += 1;
        }
        if let Some(v) = n4 {
            sum += v;
            count += 1;
        }
        let media = if count > 0 {
            (sum / count as f64 * 100.0).round() / 100.0
        } else {
            0.0
        };
        soma_medias += media;
        disciplinas.push(BoletimDisciplinaDto {
            nome,
            nota_1_bim: n1,
            nota_2_bim: n2,
            nota_3_bim: n3,
            nota_4_bim: n4,
            media,
            frequencia_pct: (freq_geral * 10.0).round() / 10.0,
        });
    }

    let media_geral = if !disciplinas.is_empty() {
        (soma_medias / disciplinas.len() as f64 * 100.0).round() / 100.0
    } else {
        0.0
    };

    let status_aprovacao = if media_geral >= 7.0 && freq_geral >= 75.0 {
        "Aprovado".to_string()
    } else if media_geral >= 5.0 && freq_geral >= 75.0 {
        "Em Recuperação".to_string()
    } else {
        "Reprovado".to_string()
    };

    Ok(Json(BoletimCompletoDto {
        aluno_id,
        nome_aluno: aluno_nome.0,
        disciplinas,
        media_geral,
        status_aprovacao,
    }))
}

// ============================================================================
// SIMULADOS TRI & APURAÇÃO DE GABARITOS ÓTICOS
// ============================================================================

pub async fn criar_simulado_tri(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateSimuladoDto>,
) -> Result<Json<SimuladoTri>, AppError> {
    if !crate::utils::is_feature_enabled(&mut *db, active_tenant.0, "module_tri")
        .await
        .unwrap_or(false)
    {
        return Err(AppError::BadRequest(
            "O Módulo TRI está desabilitado para esta escola.".to_string(),
        ));
    }
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    let total_itens = dto.itens.len() as i32;

    let mut tx = (&mut *db).begin().await?;

    let simulado = sqlx::query_as::<_, SimuladoTri>(
        r#"
        INSERT INTO simulados_tri (tenant_id, titulo, descricao, disciplina, data_aplicacao, total_itens)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.titulo)
    .bind(&dto.descricao)
    .bind(&dto.disciplina)
    .bind(dto.data_aplicacao)
    .bind(total_itens)
    .fetch_one(&mut *tx)
    .await?;

    for item in dto.itens {
        sqlx::query(
            r#"
            INSERT INTO simulados_itens (tenant_id, simulado_id, numero_item, gabarito_correto, parametro_a, parametro_b, parametro_c)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(tenant_id)
        .bind(simulado.id)
        .bind(item.numero_item)
        .bind(&item.gabarito_correto)
        .bind(item.parametro_a)
        .bind(item.parametro_b)
        .bind(item.parametro_c)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_SIMULADO_TRI",
        "simulados_tri",
        Some(simulado.id.to_string()),
        Some(json!({ "titulo": simulado.titulo, "total_itens": total_itens })),
    )
    .await;

    Ok(Json(simulado))
}

pub async fn listar_simulados_tri(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<SimuladoTri>>, AppError> {
    if !crate::utils::is_feature_enabled(&mut *db, active_tenant.0, "module_tri")
        .await
        .unwrap_or(false)
    {
        return Err(AppError::BadRequest(
            "O Módulo TRI está desabilitado para esta escola.".to_string(),
        ));
    }
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "professor",
            "secretaria",
            "responsavel",
            "aluno",
        ],
    )?;
    let tenant_id = active_tenant.0;

    let simulados = sqlx::query_as::<_, SimuladoTri>(
        "SELECT * FROM simulados_tri WHERE tenant_id = $1 ORDER BY data_aplicacao DESC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(simulados))
}

pub async fn apurar_gabarito_tri(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<ApuracaoGabaritoDto>,
) -> Result<Json<ResultadoTriDto>, AppError> {
    if !crate::utils::is_feature_enabled(&mut *db, active_tenant.0, "module_tri")
        .await
        .unwrap_or(false)
    {
        return Err(AppError::BadRequest(
            "O Módulo TRI está desabilitado para esta escola.".to_string(),
        ));
    }
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    // Buscar itens cadastrados do simulado com seus parâmetros TRI
    let itens_banco = sqlx::query_as::<_, SimuladoItem>(
        "SELECT * FROM simulados_itens WHERE tenant_id = $1 AND simulado_id = $2 ORDER BY numero_item ASC",
    )
    .bind(tenant_id)
    .bind(dto.simulado_id)
    .fetch_all(&mut *db)
    .await?;

    if itens_banco.is_empty() {
        return Err(AppError::BadRequest(
            "Simulado não possui itens cadastrados".to_string(),
        ));
    }

    // Mapear respostas do aluno e conferir com o gabarito
    let mut itens_para_calculo: Vec<(f64, f64, f64, bool)> = Vec::new();
    let mut total_acertos = 0;

    for item in &itens_banco {
        let resp_marcada = dto
            .respostas
            .iter()
            .find(|r| r.numero_item == item.numero_item);
        let acertou = match resp_marcada {
            Some(r) => r
                .resposta
                .trim()
                .eq_ignore_ascii_case(item.gabarito_correto.trim()),
            None => false,
        };
        if acertou {
            total_acertos += 1;
        }
        itens_para_calculo.push((
            item.parametro_a,
            item.parametro_b,
            item.parametro_c,
            acertou,
        ));
    }

    // Executar algoritmo matemático TRI (EAP)
    let (theta_hat, escala_enem, coerencia_score, status_diagnostico) =
        estimar_proficiencia_eap(&itens_para_calculo);

    let recomendacao_pedagogica = match status_diagnostico.as_str() {
        "coerente" => "Padrão consistente com as competências esperadas. Excelente domínio nas habilidades fundamentais.".to_string(),
        "moderado" => "Desempenho satisfatório, com pequenos desvios em itens intermediários. Recomendada revisão de conceitos-chave.".to_string(),
        _ => "Detectada incoerência pedagógica: acerto em questões avançadas acompanhado de erros em itens elementares (provável chute). Recomenda-se reforço diagnóstico de base.".to_string(),
    };

    // Upsert no banco de dados de respostas
    let respostas_json = serde_json::to_value(&dto.respostas).unwrap_or(json!([]));

    sqlx::query(
        r#"
        INSERT INTO simulados_respostas (tenant_id, simulado_id, aluno_id, respostas_marcadas, total_acertos, proficiencia_theta, escala_enem, coerencia_pedagogica_score, status_diagnostico)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (simulado_id, aluno_id) DO UPDATE SET
            respostas_marcadas = EXCLUDED.respostas_marcadas,
            total_acertos = EXCLUDED.total_acertos,
            proficiencia_theta = EXCLUDED.proficiencia_theta,
            escala_enem = EXCLUDED.escala_enem,
            coerencia_pedagogica_score = EXCLUDED.coerencia_pedagogica_score,
            status_diagnostico = EXCLUDED.status_diagnostico
        "#,
    )
    .bind(tenant_id)
    .bind(dto.simulado_id)
    .bind(dto.aluno_id)
    .bind(respostas_json)
    .bind(total_acertos as i32)
    .bind(theta_hat)
    .bind(escala_enem)
    .bind(coerencia_score)
    .bind(&status_diagnostico)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "APURAR_GABARITO_TRI",
        "simulados_respostas",
        Some(dto.simulado_id.to_string()),
        Some(json!({ "aluno_id": dto.aluno_id, "escala_enem": escala_enem, "acertos": total_acertos })),
    )
    .await;

    Ok(Json(ResultadoTriDto {
        simulado_id: dto.simulado_id,
        aluno_id: dto.aluno_id,
        total_itens: itens_banco.len(),
        total_acertos,
        proficiencia_theta: (theta_hat * 100.0).round() / 100.0,
        escala_enem: (escala_enem * 10.0).round() / 10.0,
        coerencia_pedagogica_score: (coerencia_score * 100.0).round() / 100.0,
        status_diagnostico,
        recomendacao_pedagogica,
    }))
}

pub async fn consultar_resultado_simulado_tri(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path((simulado_id, aluno_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ResultadoTriDto>, AppError> {
    if !crate::utils::is_feature_enabled(&mut *db, active_tenant.0, "module_tri")
        .await
        .unwrap_or(false)
    {
        return Err(AppError::BadRequest(
            "O Módulo TRI está desabilitado para esta escola.".to_string(),
        ));
    }
    check_roles(
        &auth_user,
        &["admin", "gestor", "professor", "responsavel", "aluno"],
    )?;
    let tenant_id = active_tenant.0;

    check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let resultado = sqlx::query_as::<_, SimuladoResposta>(
        "SELECT * FROM simulados_respostas WHERE tenant_id = $1 AND simulado_id = $2 AND aluno_id = $3",
    )
    .bind(tenant_id)
    .bind(simulado_id)
    .bind(aluno_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let simulado: SimuladoTri =
        sqlx::query_as("SELECT * FROM simulados_tri WHERE id = $1 AND tenant_id = $2")
            .bind(simulado_id)
            .bind(tenant_id)
            .fetch_one(&mut *db)
            .await?;

    let recomendacao_pedagogica = match resultado.status_diagnostico.as_str() {
        "coerente" => "Padrão consistente com as competências esperadas. Excelente domínio nas habilidades fundamentais.".to_string(),
        "moderado" => "Desempenho satisfatório, com pequenos desvios em itens intermediários. Recomendada revisão de conceitos-chave.".to_string(),
        _ => "Detectada incoerência pedagógica: acerto em questões avançadas acompanhado de erros em itens elementares (provável chute). Recomenda-se reforço diagnóstico de base.".to_string(),
    };

    Ok(Json(ResultadoTriDto {
        simulado_id,
        aluno_id,
        total_itens: simulado.total_itens as usize,
        total_acertos: resultado.total_acertos as usize,
        proficiencia_theta: (resultado.proficiencia_theta * 100.0).round() / 100.0,
        escala_enem: (resultado.escala_enem * 10.0).round() / 10.0,
        coerencia_pedagogica_score: (resultado.coerencia_pedagogica_score * 100.0).round() / 100.0,
        status_diagnostico: resultado.status_diagnostico,
        recomendacao_pedagogica,
    }))
}

// ============================================================================
// PROJETOS EDUCACIONAIS & CARDÁPIOS
// ============================================================================

pub async fn criar_projeto_educacional(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateProjetoEducacionalDto>,
) -> Result<Json<ProjetoEducacional>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "professor"])?;
    let tenant_id = active_tenant.0;

    let projeto = sqlx::query_as::<_, ProjetoEducacional>(
        r#"
        INSERT INTO projetos_educacionais (tenant_id, turma_id, professor_id, titulo, objetivo, habilidades_bncc, data_inicio, data_fim, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'em_andamento')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(auth_user.id)
    .bind(&dto.titulo)
    .bind(&dto.objetivo)
    .bind(&dto.habilidades_bncc)
    .bind(dto.data_inicio)
    .bind(dto.data_fim)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_PROJETO_EDUCACIONAL",
        "projetos_educacionais",
        Some(projeto.id.to_string()),
        Some(json!({ "titulo": projeto.titulo })),
    )
    .await;

    Ok(Json(projeto))
}

pub async fn listar_projetos_educacionais(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<ProjetoEducacional>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "professor", "secretaria", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let projetos = sqlx::query_as::<_, ProjetoEducacional>(
        "SELECT * FROM projetos_educacionais WHERE tenant_id = $1 ORDER BY data_inicio DESC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(projetos))
}

pub async fn criar_cardapio_nutricao(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateCardapioDto>,
) -> Result<Json<Cardapio>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "nutricionista"])?;
    let tenant_id = active_tenant.0;
    let nutricionista_nome = sqlx::query_scalar::<_, String>(
        "SELECT nome FROM funcionarios WHERE id = $1 AND tenant_id = $2 AND status = 'ativo'",
    )
    .bind(dto.nutricionista_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Nutricionista inativo ou não cadastrado no RH deste tenant.".into())
    })?;

    let cardapio = sqlx::query_as::<_, Cardapio>(
        r#"
        INSERT INTO cardapios (tenant_id, turma_id, semana_ano, data_dia, tipo_refeicao, titulo_menu, descricao_ingredientes, alergicos_atencao, nutricionista_id, nutricionista_responsavel)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(&dto.semana_ano)
    .bind(dto.data_dia)
    .bind(&dto.tipo_refeicao)
    .bind(&dto.titulo_menu)
    .bind(&dto.descricao_ingredientes)
    .bind(&dto.alergicos_atencao)
    .bind(dto.nutricionista_id)
    .bind(&nutricionista_nome)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_CARDAPIO_NUTRICAO",
        "cardapios",
        Some(cardapio.id.to_string()),
        Some(json!({ "titulo_menu": cardapio.titulo_menu, "data_dia": cardapio.data_dia })),
    )
    .await;

    Ok(Json(cardapio))
}

pub async fn listar_cardapios_nutricao(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Cardapio>>, AppError> {
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
    let tenant_id = active_tenant.0;

    let cardapios = sqlx::query_as::<_, Cardapio>(
        "SELECT * FROM cardapios WHERE tenant_id = $1 ORDER BY data_dia DESC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(cardapios))
}

// ============================================================================
// CADASTRO PEDAGÓGICO: DISCIPLINAS & COMPONENTES CURRICULARES (BNCC)
// ============================================================================

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

// ============================================================================
// VÍNCULOS: MATRIZ CURRICULAR DA TURMA (TURMA <-> DISCIPLINAS)
// ============================================================================

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

// ============================================================================
// VÍNCULOS: ATRIBUIÇÃO DOCENTE (PROFESSOR <-> TURMA <-> DISCIPLINA)
// ============================================================================

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

// ============================================================================
// VÍNCULOS: GRADE HORÁRIA & QUADRO SEMANAL COM DETECÇÃO DE CHOQUES
// ============================================================================

pub async fn listar_horarios_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
) -> Result<Json<Vec<HorarioTurmaDetalhado>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;

    let rows = sqlx::query(
        r#"
        SELECT 
            h.id,
            h.turma_id,
            h.disciplina_id,
            d.nome AS disciplina_nome,
            h.professor_id,
            u.name AS professor_nome,
            h.sala_id,
            s.nome AS sala_nome,
            h.dia_semana,
            h.hora_inicio,
            h.hora_fim,
            h.created_at
        FROM horarios_turma h
        JOIN disciplinas d ON h.disciplina_id = d.id
        LEFT JOIN users u ON h.professor_id = u.id
        LEFT JOIN salas s ON h.sala_id = s.id
        WHERE h.turma_id = $1 AND h.tenant_id = $2
        ORDER BY h.dia_semana ASC, h.hora_inicio ASC
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
            HorarioTurmaDetalhado {
                id: row.get("id"),
                turma_id: row.get("turma_id"),
                disciplina_id: row.get("disciplina_id"),
                disciplina_nome: row.get("disciplina_nome"),
                professor_id: row.get("professor_id"),
                professor_nome: row.get("professor_nome"),
                sala_id: row.get("sala_id"),
                sala_nome: row.get("sala_nome"),
                dia_semana: row.get("dia_semana"),
                hora_inicio: row.get("hora_inicio"),
                hora_fim: row.get("hora_fim"),
                created_at: row.get("created_at"),
            }
        })
        .collect();

    Ok(Json(lista))
}

pub async fn criar_horario_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(turma_id): Path<Uuid>,
    Json(dto): Json<CreateHorarioTurmaDto>,
) -> Result<Json<HorarioTurmaDetalhado>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    // 1. Validar que início < fim
    if dto.hora_inicio >= dto.hora_fim {
        return Err(AppError::BadRequest(
            "O horário de início deve ser anterior ao horário de término.".to_string(),
        ));
    }

    // 2. Choque na mesma turma
    let choque_turma = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM horarios_turma
            WHERE tenant_id = $1 AND turma_id = $2 AND dia_semana = $3
            AND GREATEST(hora_inicio, $4) < LEAST(hora_fim, $5)
        )
        "#,
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(dto.dia_semana)
    .bind(&dto.hora_inicio)
    .bind(&dto.hora_fim)
    .fetch_one(&mut *db)
    .await?;

    if choque_turma {
        return Err(AppError::BadRequest(format!(
            "Choque de horário na turma: A turma já possui uma aula alocada neste dia da semana entre {} e {}.",
            dto.hora_inicio, dto.hora_fim
        )));
    }

    // 3. Choque de professor (se informado)
    if let Some(prof_id) = dto.professor_id {
        let conflito_prof = sqlx::query(
            r#"
            SELECT t.nome AS turma_nome, h.hora_inicio, h.hora_fim, u.name AS prof_nome
            FROM horarios_turma h
            JOIN turmas t ON h.turma_id = t.id
            JOIN users u ON h.professor_id = u.id
            WHERE h.tenant_id = $1 AND h.professor_id = $2 AND h.dia_semana = $3
            AND GREATEST(h.hora_inicio, $4) < LEAST(h.hora_fim, $5)
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(prof_id)
        .bind(dto.dia_semana)
        .bind(&dto.hora_inicio)
        .bind(&dto.hora_fim)
        .fetch_optional(&mut *db)
        .await?;

        if let Some(row) = conflito_prof {
            use sqlx::Row;
            let t_nome: String = row.get("turma_nome");
            let p_nome: String = row.get("prof_nome");
            let h_ini: String = row.get("hora_inicio");
            let h_fim: String = row.get("hora_fim");
            return Err(AppError::BadRequest(format!(
                "Choque de horário docente: O docente {} já está alocado na turma '{}' das {} às {}.",
                p_nome, t_nome, h_ini, h_fim
            )));
        }
    }

    // 4. Choque de sala (se informada)
    if let Some(s_id) = dto.sala_id {
        let conflito_sala = sqlx::query(
            r#"
            SELECT t.nome AS turma_nome, s.nome AS sala_nome, h.hora_inicio, h.hora_fim
            FROM horarios_turma h
            JOIN turmas t ON h.turma_id = t.id
            JOIN salas s ON h.sala_id = s.id
            WHERE h.tenant_id = $1 AND h.sala_id = $2 AND h.dia_semana = $3
            AND GREATEST(h.hora_inicio, $4) < LEAST(h.hora_fim, $5)
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(s_id)
        .bind(dto.dia_semana)
        .bind(&dto.hora_inicio)
        .bind(&dto.hora_fim)
        .fetch_optional(&mut *db)
        .await?;

        if let Some(row) = conflito_sala {
            use sqlx::Row;
            let t_nome: String = row.get("turma_nome");
            let s_nome: String = row.get("sala_nome");
            let h_ini: String = row.get("hora_inicio");
            let h_fim: String = row.get("hora_fim");
            return Err(AppError::BadRequest(format!(
                "Choque de espaço físico: A sala '{}' já está ocupada pela turma '{}' das {} às {}.",
                s_nome, t_nome, h_ini, h_fim
            )));
        }
    }

    let h = sqlx::query_as::<_, HorarioTurma>(
        r#"
        INSERT INTO horarios_turma (tenant_id, turma_id, disciplina_id, professor_id, sala_id, dia_semana, hora_inicio, hora_fim)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(turma_id)
    .bind(dto.disciplina_id)
    .bind(dto.professor_id)
    .bind(dto.sala_id)
    .bind(dto.dia_semana)
    .bind(&dto.hora_inicio)
    .bind(&dto.hora_fim)
    .fetch_one(&mut *db)
    .await?;

    let disciplina_nome =
        sqlx::query_scalar::<_, String>("SELECT nome FROM disciplinas WHERE id = $1")
            .bind(h.disciplina_id)
            .fetch_optional(&mut *db)
            .await?
            .unwrap_or_default();

    let professor_nome = if let Some(pid) = h.professor_id {
        sqlx::query_scalar::<_, String>("SELECT name FROM users WHERE id = $1")
            .bind(pid)
            .fetch_optional(&mut *db)
            .await?
    } else {
        None
    };

    let sala_nome = if let Some(sid) = h.sala_id {
        sqlx::query_scalar::<_, String>("SELECT nome FROM salas WHERE id = $1")
            .bind(sid)
            .fetch_optional(&mut *db)
            .await?
    } else {
        None
    };

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_HORARIO_TURMA",
        "horarios_turma",
        Some(h.id.to_string()),
        Some(json!({ "turma_id": turma_id, "dia_semana": h.dia_semana, "inicio": h.hora_inicio, "fim": h.hora_fim })),
    )
    .await;

    Ok(Json(HorarioTurmaDetalhado {
        id: h.id,
        turma_id: h.turma_id,
        disciplina_id: h.disciplina_id,
        disciplina_nome,
        professor_id: h.professor_id,
        professor_nome,
        sala_id: h.sala_id,
        sala_nome,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fim: h.hora_fim,
        created_at: h.created_at,
    }))
}

pub async fn deletar_horario_turma(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(horario_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let res = sqlx::query("DELETE FROM horarios_turma WHERE id = $1 AND tenant_id = $2")
        .bind(horario_id)
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
        "DELETAR_HORARIO_TURMA",
        "horarios_turma",
        Some(horario_id.to_string()),
        None,
    )
    .await;

    Ok(Json(
        json!({ "status": "sucesso", "mensagem": "Horário removido com sucesso." }),
    ))
}

// ============================================================================
// AUXILIAR: PROFESSORES DISPONÍVEIS PARA ATRIBUIÇÃO
// ============================================================================

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

// ============================================================================
// TESTES UNITÁRIOS TRI & VALIDAÇÕES PEDAGÓGICAS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_probabilidade_tri_3pl() {
        let p = probabilidade_tri_3pl(0.0, 1.0, 0.0, 0.2);
        assert!((p - 0.6).abs() < 1e-4);

        let p_alto = probabilidade_tri_3pl(3.0, 1.5, 0.0, 0.2);
        assert!(p_alto > 0.95);

        let p_baixo = probabilidade_tri_3pl(-3.0, 1.5, 0.0, 0.2);
        assert!((p_baixo - 0.2).abs() < 0.05);
    }

    #[test]
    fn test_estimacao_tri_eap_coerente_vs_incoerente() {
        let aluno_coerente = vec![
            (1.2, -1.0, 0.2, true),
            (1.1, -0.5, 0.2, true),
            (1.3, 0.0, 0.2, true),
            (1.0, 1.0, 0.2, false),
            (1.4, 1.5, 0.2, false),
        ];
        let (_theta_a, enem_a, coerencia_a, status_a) = estimar_proficiencia_eap(&aluno_coerente);
        assert!(enem_a > 450.0 && enem_a < 600.0);
        assert_eq!(status_a, "coerente");
        assert!(coerencia_a >= 0.85);

        let aluno_incoerente = vec![
            (1.2, -1.5, 0.2, false),
            (1.1, -1.0, 0.2, false),
            (1.3, 0.0, 0.2, false),
            (1.0, 1.5, 0.2, true),
            (1.4, 2.0, 0.2, true),
        ];
        let (_theta_b, _enem_b, coerencia_b, status_b) =
            estimar_proficiencia_eap(&aluno_incoerente);
        assert_eq!(status_b, "incoerente_chute_provavel");
        assert!(coerencia_b < 0.85);
    }

    #[test]
    fn test_validacao_sobreposicao_horarios() {
        // Choque: 07:30 - 08:20 vs 08:00 - 08:50
        let h1_ini = "07:30";
        let h1_fim = "08:20";
        let h2_ini = "08:00";
        let h2_fim = "08:50";
        assert!(h1_ini.max(h2_ini) < h1_fim.min(h2_fim));

        // Sem choque: 07:30 - 08:20 vs 08:20 - 09:10
        let h3_ini = "08:20";
        let h3_fim = "09:10";
        assert!(!(h1_ini.max(h3_ini) < h1_fim.min(h3_fim)));

        // Sem choque: 09:10 - 10:00 vs 07:30 - 08:20
        assert!(!(h1_ini.max("09:10") < h1_fim.min("10:00")));
    }
}

pub async fn registrar_portfolio_infantil(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<
        crate::models::academico::CreatePortfolioInfantilDto,
    >,
) -> Result<axum::Json<crate::models::academico::PortfolioInfantil>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "professor", "gestor"])?;
    let tenant_id = active_tenant.0;
    let data_registro = dto
        .data_registro
        .unwrap_or_else(|| chrono::Utc::now().date_naive());

    let portfolio = sqlx::query_as::<_, crate::models::academico::PortfolioInfantil>(
        r#"
        INSERT INTO portfolio_infantil (tenant_id, aluno_id, professor_id, turma_id, data_registro, titulo, descricao, midia_url, campos_experiencia_bncc)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(auth_user.id)
    .bind(dto.turma_id)
    .bind(data_registro)
    .bind(&dto.titulo)
    .bind(&dto.descricao)
    .bind(&dto.midia_url)
    .bind(&dto.campos_experiencia_bncc)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "REGISTRAR_PORTFOLIO",
        "portfolio_infantil",
        Some(portfolio.id.to_string()),
        Some(serde_json::json!({"aluno_id": dto.aluno_id, "titulo": dto.titulo})),
    )
    .await;

    Ok(axum::Json(portfolio))
}

pub async fn listar_portfolio_infantil(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(aluno_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::academico::PortfolioInfantil>>, AppError> {
    crate::middleware::rbac::check_roles(
        &auth_user,
        &["admin", "professor", "gestor", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    crate::middleware::rbac::check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let port = sqlx::query_as::<_, crate::models::academico::PortfolioInfantil>(
        "SELECT * FROM portfolio_infantil WHERE tenant_id = $1 AND aluno_id = $2 ORDER BY data_registro DESC"
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(axum::Json(port))
}
