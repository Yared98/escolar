use axum::{
    extract::{Path, State},
    Extension, Json,
};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_aluno_ownership, check_roles},
        tenant::ActiveTenant,
    },
    models::academico::{BoletimCompletoDto, BoletimDisciplinaDto, Nota, ParecerBoletimDto},
};

/// Situação do boletim. O resultado final (aprovado, recuperação, reprovado) só existe com os
/// quatro bimestres lançados em todas as disciplinas; antes disso o ano está "Em andamento".
pub fn status_boletim(
    sem_notas: bool,
    ano_completo: bool,
    media_geral: f64,
    freq_geral: f64,
) -> String {
    if sem_notas {
        return "Sem notas lançadas".to_string();
    }
    if !ano_completo {
        return if media_geral >= 7.0 && freq_geral >= 75.0 {
            "Em andamento".to_string()
        } else {
            "Em andamento (precisa de atenção)".to_string()
        };
    }
    if media_geral >= 7.0 && freq_geral >= 75.0 {
        "Aprovado".to_string()
    } else if media_geral >= 5.0 && freq_geral >= 75.0 {
        "Em Recuperação".to_string()
    } else {
        "Reprovado".to_string()
    }
}

/// Calcula a frequência de uma disciplina a partir do mapa de presenças por disciplina.
/// Se a disciplina não possuir diários próprios, retorna a frequência geral.
pub fn calcular_frequencia_por_disciplina(
    freq_geral: f64,
    disciplina_nome: &str,
    frequencias_por_disciplina: &std::collections::HashMap<String, (i64, i64)>,
) -> f64 {
    match frequencias_por_disciplina.get(disciplina_nome) {
        Some((presentes, total)) if *total > 0 => {
            ((*presentes as f64 / *total as f64) * 1000.0).round() / 10.0
        }
        _ => freq_geral,
    }
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

    // Frequência por disciplina: considera apenas diários vinculados a uma disciplina.
    let frequencias_por_disciplina: std::collections::HashMap<String, (i64, i64)> =
        sqlx::query_as::<_, (Option<String>, i64, i64)>(
            r#"
        SELECT disc.nome AS disciplina_nome, COUNT(*) FILTER (WHERE p.presente = true), COUNT(*)
        FROM presencas p
        JOIN diarios_classe d ON d.id = p.diario_id AND d.tenant_id = p.tenant_id
        LEFT JOIN disciplinas disc ON disc.id = d.disciplina_id AND disc.tenant_id = d.tenant_id
        WHERE p.tenant_id = $1 AND p.aluno_id = $2 AND d.disciplina_id IS NOT NULL
        GROUP BY disc.nome
        "#,
        )
        .bind(tenant_id)
        .bind(aluno_id)
        .fetch_all(&mut *db)
        .await?
        .into_iter()
        .filter_map(|(nome, presentes, total)| nome.map(|n| (n, (presentes, total))))
        .collect();

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
        let frequencia_pct =
            calcular_frequencia_por_disciplina(freq_geral, &nome, &frequencias_por_disciplina);
        disciplinas.push(BoletimDisciplinaDto {
            nome,
            nota_1_bim: n1,
            nota_2_bim: n2,
            nota_3_bim: n3,
            nota_4_bim: n4,
            media,
            frequencia_pct,
        });
    }

    let media_geral = if !disciplinas.is_empty() {
        (soma_medias / disciplinas.len() as f64 * 100.0).round() / 100.0
    } else {
        0.0
    };

    let ano_completo = !disciplinas.is_empty()
        && disciplinas.iter().all(|d| {
            d.nota_1_bim.is_some()
                && d.nota_2_bim.is_some()
                && d.nota_3_bim.is_some()
                && d.nota_4_bim.is_some()
        });
    let status_aprovacao = status_boletim(
        disciplinas.is_empty(),
        ano_completo,
        media_geral,
        freq_geral,
    );

    // Períodos fechados das turmas do aluno.
    let periodos_fechados: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT DISTINCT fp.periodo
        FROM fechamentos_periodo fp
        JOIN turma_alunos ta ON ta.turma_id = fp.turma_id AND ta.tenant_id = fp.tenant_id
        WHERE fp.tenant_id = $1 AND ta.aluno_id = $2
        ORDER BY fp.periodo
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    // Pareceres do conselho para o aluno.
    let pareceres: Vec<ParecerBoletimDto> = sqlx::query_as(
        r#"
        SELECT periodo, parecer, encaminhamento
        FROM pareceres_conselho
        WHERE tenant_id = $1 AND aluno_id = $2
        ORDER BY periodo
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(BoletimCompletoDto {
        aluno_id,
        nome_aluno: aluno_nome.0,
        disciplinas,
        media_geral,
        status_aprovacao,
        periodos_fechados,
        pareceres,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_boletim_so_fecha_com_ano_completo() {
        assert_eq!(
            status_boletim(true, false, 0.0, 100.0),
            "Sem notas lançadas"
        );
        // Meio do ano com média baixa: não pode aparecer "Reprovado" para a família.
        assert_eq!(
            status_boletim(false, false, 4.25, 60.0),
            "Em andamento (precisa de atenção)"
        );
        assert_eq!(status_boletim(false, false, 8.0, 90.0), "Em andamento");
        assert_eq!(status_boletim(false, true, 8.0, 90.0), "Aprovado");
        assert_eq!(status_boletim(false, true, 6.0, 90.0), "Em Recuperação");
        assert_eq!(status_boletim(false, true, 4.0, 90.0), "Reprovado");
        assert_eq!(status_boletim(false, true, 9.0, 60.0), "Reprovado");
    }

    #[test]
    fn test_calcular_frequencia_por_disciplina() {
        let mut map = std::collections::HashMap::new();
        map.insert("Matemática".to_string(), (18, 20));
        map.insert("História".to_string(), (5, 10));

        // Disciplina com diários próprios usa sua frequência.
        assert_eq!(
            calcular_frequencia_por_disciplina(95.0, "Matemática", &map),
            90.0
        );
        assert_eq!(
            calcular_frequencia_por_disciplina(95.0, "História", &map),
            50.0
        );

        // Disciplina sem diários próprios herda a frequência geral.
        assert_eq!(
            calcular_frequencia_por_disciplina(95.0, "Geografia", &map),
            95.0
        );
    }
}
