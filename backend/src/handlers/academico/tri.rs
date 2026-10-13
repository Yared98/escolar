use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde_json::json;
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
        ApuracaoGabaritoDto, CreateSimuladoDto, ResultadoTriDto, SimuladoItem, SimuladoResposta,
        SimuladoTri,
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
}
