use super::*;

pub fn calcular_score_evasao(aluno_id: Uuid, metricas: DetalhesEvasao) -> PredizerEvasaoResponse {
    let risk_faltas = if metricas.frequencia_ultimos_30_dias >= 90.0 {
        (100.0 - metricas.frequencia_ultimos_30_dias) * 1.5
    } else if metricas.frequencia_ultimos_30_dias >= 75.0 {
        15.0 + ((90.0 - metricas.frequencia_ultimos_30_dias) / 15.0) * 35.0
    } else {
        50.0 + ((75.0 - metricas.frequencia_ultimos_30_dias) / 75.0) * 50.0
    }
    .clamp(0.0, 100.0);

    let risk_inadimplencia = match metricas.faturas_atrasadas {
        0 => 0.0,
        1 => 50.0,
        2 => 90.0,
        _ => 100.0,
    };

    let risk_notas = if metricas.media_disciplinas >= 7.0 {
        0.0
    } else if metricas.media_disciplinas >= 5.0 {
        ((7.0 - metricas.media_disciplinas) / 2.0) * 55.0
    } else {
        55.0 + ((5.0 - metricas.media_disciplinas) / 5.0) * 45.0
    }
    .clamp(0.0, 100.0);

    let contrib_faltas = risk_faltas * 0.40;
    let contrib_inadimplencia = risk_inadimplencia * 0.35;
    let contrib_notas = risk_notas * 0.25;

    let score_base = contrib_faltas + contrib_inadimplencia + contrib_notas;

    let compound_multiplier = if risk_inadimplencia >= 50.0 && risk_faltas >= 40.0 {
        1.30
    } else if risk_inadimplencia >= 50.0 || risk_faltas >= 50.0 {
        1.10
    } else {
        1.0
    };

    let score_final = ((score_base * compound_multiplier).clamp(0.0, 100.0) * 10.0).round() / 10.0;

    let fator_principal = if score_final < 15.0 {
        "nenhum".to_string()
    } else if contrib_inadimplencia >= contrib_faltas && contrib_inadimplencia >= contrib_notas {
        "inadimplencia".to_string()
    } else if contrib_faltas >= contrib_inadimplencia && contrib_faltas >= contrib_notas {
        "faltas_reiteradas".to_string()
    } else {
        "queda_desempenho".to_string()
    };

    let nivel_urgencia = if score_final >= 75.0 {
        "alta".to_string()
    } else if score_final >= 40.0 {
        "moderada".to_string()
    } else {
        "baixa".to_string()
    };

    let recomendacao = match fator_principal.as_str() {
        "inadimplencia" => {
            "Agendar reunião de acolhimento pedagógico e oferecer plano de parcelamento financeiro."
                .to_string()
        }
        "faltas_reiteradas" => {
            "Acionar busca ativa escolar e convocar os responsáveis para alinhamento sobre frequência."
                .to_string()
        }
        "queda_desempenho" => {
            "Encaminhar para tutoria pedagógica e plano de nivelamento de aprendizagem."
                .to_string()
        }
        _ => "Estudante com indicadores regulares. Manter acompanhamento pedagógico preventivo."
            .to_string(),
    };

    PredizerEvasaoResponse {
        aluno_id,
        aluno_nome: String::new(),
        turma_nome: None,
        score_risco_evasao: score_final,
        nivel_urgencia,
        fator_principal,
        detalhes: metricas,
        recomendacao,
    }
}

pub async fn predizer_risco_evasao(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<PredizerEvasaoResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let aluno = sqlx::query_as::<_, (Uuid, String, String)>(
        "SELECT id, nome, status FROM alunos WHERE id = $1 AND tenant_id = $2",
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let freq_row = sqlx::query_as::<_, (i64, i64)>(
        r#"
        SELECT 
            COUNT(p.id) as total_aulas,
            COUNT(p.id) FILTER (WHERE p.presente = true) as total_presentes
        FROM presencas p
        JOIN diarios_classe d ON p.diario_id = d.id
        WHERE p.tenant_id = $1 
          AND p.aluno_id = $2 
          AND d.data_aula >= CURRENT_DATE - INTERVAL '30 days'
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_one(&mut *db)
    .await?;

    let (frequencia_ultimos_30_dias, sem_chamadas) = if freq_row.0 > 0 {
        let pct = (freq_row.1 as f64 / freq_row.0 as f64) * 100.0;
        ((pct * 10.0).round() / 10.0, false)
    } else {
        let freq_geral = sqlx::query_as::<_, (i64, i64)>(
            r#"
            SELECT
                COUNT(id) as total_aulas,
                COUNT(id) FILTER (WHERE presente = true) as total_presentes
            FROM presencas
            WHERE tenant_id = $1 AND aluno_id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(aluno_id)
        .fetch_one(&mut *db)
        .await?;

        if freq_geral.0 > 0 {
            let pct = (freq_geral.1 as f64 / freq_geral.0 as f64) * 100.0;
            ((pct * 10.0).round() / 10.0, false)
        } else {
            (100.0, true)
        }
    };

    let faturas_atrasadas = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) 
        FROM faturas
        WHERE tenant_id = $1 
          AND aluno_id = $2 
          AND (status = 'atrasado' OR (status = 'pendente' AND data_vencimento < CURRENT_DATE))
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_one(&mut *db)
    .await?;

    let notas_row = sqlx::query_as::<_, (Option<f64>, i64)>(
        r#"
        SELECT 
            AVG(nota) as media,
            COUNT(id) as total_notas
        FROM notas
        WHERE tenant_id = $1 AND aluno_id = $2
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_one(&mut *db)
    .await?;

    let media_disciplinas = if let Some(media) = notas_row.0 {
        (media * 10.0).round() / 10.0
    } else {
        7.0
    };

    let metricas = DetalhesEvasao {
        faturas_atrasadas,
        frequencia_ultimos_30_dias,
        media_disciplinas,
        sem_chamadas,
    };
    let resultado = calcular_score_evasao(aluno_id, metricas);
    let resultado = PredizerEvasaoResponse {
        aluno_nome: aluno.1.clone(),
        ..resultado
    };

    if resultado.score_risco_evasao > 75.0 {
        // Throttling de 24h para evitar saturação de notificações idênticas
        let alerta_recente = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM notificacoes_sistema 
                WHERE tenant_id = $1 AND aluno_id = $2 AND modulo = 'ia_evasao'
                  AND created_at >= NOW() - INTERVAL '24 hours'
            )
            "#,
        )
        .bind(tenant_id)
        .bind(aluno_id)
        .fetch_one(&mut *db)
        .await?;

        if !alerta_recente {
            let titulo = format!(
                "Alerta de Risco de Evasão: {} ({:.1}%)",
                aluno.1, resultado.score_risco_evasao
            );
            let mensagem = format!(
                "O aluno {} apresenta score de risco de evasão de {:.1}% (Urgência: {}). Fator principal: {}. Recomendação: {}",
                aluno.1, resultado.score_risco_evasao, resultado.nivel_urgencia, resultado.fator_principal, resultado.recomendacao
            );

            let gestores = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM users WHERE tenant_id = $1 AND role IN ('admin', 'gestor') LIMIT 5",
            )
            .bind(tenant_id)
            .fetch_all(&mut *db)
            .await?;

            if gestores.is_empty() {
                sqlx::query(
                    r#"
                    INSERT INTO notificacoes_sistema (
                        tenant_id, aluno_id, modulo, titulo, mensagem, prioridade, lida, canal_disparo
                    )
                    VALUES ($1, $2, 'ia_evasao', $3, $4, 'urgente', false, 'push_pwa')
                    "#,
                )
                .bind(tenant_id)
                .bind(aluno_id)
                .bind(&titulo)
                .bind(&mensagem)
                .execute(&mut *db)
                .await?;
            } else {
                for gestor_id in gestores {
                    sqlx::query(
                        r#"
                        INSERT INTO notificacoes_sistema (
                            tenant_id, destinatario_id, aluno_id, modulo, titulo, mensagem, prioridade, lida, canal_disparo
                        )
                        VALUES ($1, $2, $3, 'ia_evasao', $4, $5, 'urgente', false, 'push_pwa')
                        "#,
                    )
                    .bind(tenant_id)
                    .bind(gestor_id)
                    .bind(aluno_id)
                    .bind(&titulo)
                    .bind(&mensagem)
                    .execute(&mut *db)
                    .await?;
                }
            }
        }
    }

    sqlx::query(
        r#"
        INSERT INTO analise_evasao_logs (
            tenant_id, aluno_id, score_risco_evasao, fator_principal
        )
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .bind(resultado.score_risco_evasao)
    .bind(&resultado.fator_principal)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "PREDIZER_RISCO_EVASAO",
        "analise_evasao_logs",
        Some(aluno_id.to_string()),
        Some(json!({
            "score_risco_evasao": resultado.score_risco_evasao,
            "nivel_urgencia": resultado.nivel_urgencia,
            "fator_principal": resultado.fator_principal,
            "detalhes": resultado.detalhes
        })),
    )
    .await;

    Ok(Json(resultado))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gerar_hash_consentimento_lgpd_determinismo() {
        let tenant_id = Uuid::new_v4();
        let aluno_id = Uuid::new_v4();
        let responsavel_id = Uuid::new_v4();
        let versao = "2026.1";
        let ts = "2026-09-25T14:00:00Z";

        let hash1 = gerar_hash_consentimento_lgpd(tenant_id, aluno_id, responsavel_id, versao, ts);
        let hash2 = gerar_hash_consentimento_lgpd(tenant_id, aluno_id, responsavel_id, versao, ts);
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA-256 hex string tem 64 caracteres
    }

    #[test]
    fn test_validar_acesso_perimetral_response_contract() {
        let resp = ValidarAcessoPerimetralResponse {
            acesso_permitido: true,
            nome_aluno: Some("Ana Clara Souza".to_string()),
            turma: Some("1º Ano A".to_string()),
            motivo_bloqueio: None,
        };

        assert!(resp.acesso_permitido);
        assert_eq!(resp.nome_aluno.as_deref(), Some("Ana Clara Souza"));
        assert_eq!(resp.turma.as_deref(), Some("1º Ano A"));
    }

    #[test]
    fn test_calcular_score_baixo_risco_aluno_regular() {
        let aluno_id = Uuid::new_v4();
        let metricas = DetalhesEvasao {
            frequencia_ultimos_30_dias: 98.0,
            media_disciplinas: 8.5,
            ..Default::default()
        };

        let resultado = calcular_score_evasao(aluno_id, metricas);
        assert_eq!(resultado.aluno_id, aluno_id);
        assert!(resultado.score_risco_evasao < 15.0);
        assert_eq!(resultado.nivel_urgencia, "baixa");
        assert_eq!(resultado.fator_principal, "nenhum");
    }

    #[test]
    fn test_calcular_score_inadimplencia_dominante() {
        let aluno_id = Uuid::new_v4();
        let metricas = DetalhesEvasao {
            faturas_atrasadas: 2,
            frequencia_ultimos_30_dias: 95.0,
            media_disciplinas: 7.5,
            ..Default::default()
        };

        let resultado = calcular_score_evasao(aluno_id, metricas);
        assert_eq!(resultado.fator_principal, "inadimplencia");
        assert!(resultado.recomendacao.contains("parcelamento financeiro"));
    }

    #[test]
    fn test_calcular_score_faltas_reiteradas_dominante() {
        let aluno_id = Uuid::new_v4();
        let metricas = DetalhesEvasao {
            frequencia_ultimos_30_dias: 60.0,
            media_disciplinas: 8.0,
            ..Default::default()
        };

        let resultado = calcular_score_evasao(aluno_id, metricas);
        assert_eq!(resultado.fator_principal, "faltas_reiteradas");
        assert!(resultado.recomendacao.contains("busca ativa"));
    }

    #[test]
    fn test_calcular_score_queda_desempenho_dominante() {
        let aluno_id = Uuid::new_v4();
        let metricas = DetalhesEvasao {
            frequencia_ultimos_30_dias: 95.0,
            media_disciplinas: 4.0,
            ..Default::default()
        };

        let resultado = calcular_score_evasao(aluno_id, metricas);
        assert_eq!(resultado.fator_principal, "queda_desempenho");
        assert!(resultado.recomendacao.contains("tutoria pedagógica"));
    }

    #[test]
    fn test_calcular_score_critico_com_alerta_acima_75() {
        let aluno_id = Uuid::new_v4();
        let metricas = DetalhesEvasao {
            faturas_atrasadas: 2,
            frequencia_ultimos_30_dias: 72.0,
            media_disciplinas: 6.1,
            ..Default::default()
        };

        let resultado = calcular_score_evasao(aluno_id, metricas);
        assert!(
            resultado.score_risco_evasao >= 75.0,
            "Score esperado >= 75.0, obtido: {}",
            resultado.score_risco_evasao
        );
        assert_eq!(resultado.nivel_urgencia, "alta");
        assert_eq!(resultado.fator_principal, "inadimplencia");
    }

    #[test]
    fn test_calcular_digest_historico_determinismo() {
        let notas1 = vec![
            ("Matemática".to_string(), "1_bimestre".to_string(), 8.5),
            ("História".to_string(), "1_bimestre".to_string(), 9.0),
        ];
        let notas2 = vec![
            ("História".to_string(), "1_bimestre".to_string(), 9.0),
            ("Matemática".to_string(), "1_bimestre".to_string(), 8.5),
        ];

        let digest1 = calcular_digest_historico(&notas1);
        let digest2 = calcular_digest_historico(&notas2);
        assert_eq!(digest1, digest2);
        assert_eq!(digest1.len(), 64);
    }

    #[test]
    fn test_verificar_inviolabilidade_diploma_sucesso() {
        let tenant_id = Uuid::new_v4();
        let aluno_id = Uuid::new_v4();
        let curso = "Ensino Médio Regular";
        let cpf = "123.456.789-00";
        let ts = "2026-09-25T14:30:00Z";
        let notas = vec![
            ("Física".to_string(), "1_bimestre".to_string(), 8.0),
            ("Química".to_string(), "1_bimestre".to_string(), 7.5),
        ];

        let digest = calcular_digest_historico(&notas);
        let hash_original =
            calcular_hash_xades_diploma(tenant_id, aluno_id, curso, cpf, &digest, ts);

        assert!(verificar_inviolabilidade_diploma(
            tenant_id,
            aluno_id,
            curso,
            cpf,
            &notas,
            ts,
            &hash_original
        ));
    }

    #[test]
    fn test_inviolabilidade_falha_se_nota_adulterada() {
        let tenant_id = Uuid::new_v4();
        let aluno_id = Uuid::new_v4();
        let curso = "Ensino Médio Regular";
        let cpf = "123.456.789-00";
        let ts = "2026-09-25T14:30:00Z";
        let notas = vec![("Matemática".to_string(), "1_bimestre".to_string(), 6.0)];

        let digest = calcular_digest_historico(&notas);
        let hash_original =
            calcular_hash_xades_diploma(tenant_id, aluno_id, curso, cpf, &digest, ts);

        // Simulando adulteração fraudulenta de nota de 6.0 para 9.5
        let notas_adulteradas = vec![("Matemática".to_string(), "1_bimestre".to_string(), 9.5)];

        assert!(!verificar_inviolabilidade_diploma(
            tenant_id,
            aluno_id,
            curso,
            cpf,
            &notas_adulteradas,
            ts,
            &hash_original
        ));
    }

    #[test]
    fn test_inviolabilidade_falha_se_disciplina_ou_curso_alterado() {
        let tenant_id = Uuid::new_v4();
        let aluno_id = Uuid::new_v4();
        let curso = "Ensino Médio Regular";
        let cpf = "123.456.789-00";
        let ts = "2026-09-25T14:30:00Z";
        let notas = vec![("Português".to_string(), "1_bimestre".to_string(), 8.0)];

        let digest = calcular_digest_historico(&notas);
        let hash_original =
            calcular_hash_xades_diploma(tenant_id, aluno_id, curso, cpf, &digest, ts);

        // Tentativa de alterar curso
        assert!(!verificar_inviolabilidade_diploma(
            tenant_id,
            aluno_id,
            "Ensino Médio Técnico em Informática",
            cpf,
            &notas,
            ts,
            &hash_original
        ));
    }

    #[test]
    fn test_gerar_xml_diplomado_contem_padroes_mec_e_xades() {
        let aluno_id = Uuid::new_v4();
        let xml = gerar_xml_diplomado(
            "Colégio Integrado de Testes",
            "12.345.678/0001-90",
            "19842",
            aluno_id,
            "Carlos Eduardo Silva",
            "111.222.333-44",
            "2008-05-12",
            "Ensino Médio Regular",
            "2026-12-15",
            "REG-TEST-001",
            "Livro-D-2026",
            "Folha-010",
            "2026-09-25T14:30:00Z",
            "hash_sha256_mock_sample",
        );

        assert!(xml.contains("http://portal.mec.gov.br/diplomadigital/arquivos-em-xsd"));
        assert!(xml.contains("Portaria MEC nº 70/2025"));
        assert!(xml.contains("AssinaturaDiploma_"));
        assert!(xml.contains("http://uri.etsi.org/01903/v1.3.2#")); // XAdES
        assert!(xml.contains("http://www.w3.org/2000/09/xmldsig#")); // XMLDSig
        assert!(xml.contains("Carlos Eduardo Silva"));
        assert!(xml.contains("111.222.333-44"));
    }

    #[test]
    fn test_gerar_xml_historico_contem_disciplinas_e_integralizacao() {
        let aluno_id = Uuid::new_v4();
        let notas = vec![
            ("Matemática".to_string(), "1_bimestre".to_string(), 8.0),
            ("Física".to_string(), "1_bimestre".to_string(), 5.0),
        ];

        let xml = gerar_xml_historico(
            "Colégio Integrado de Testes",
            "19842",
            aluno_id,
            "Carlos Eduardo Silva",
            "111.222.333-44",
            "Ensino Médio Regular",
            &notas,
            "2026-09-25T14:30:00Z",
            "hash_sha256_mock_sample",
        );

        assert!(xml.contains("<HistoricoEscolar"));
        assert!(xml.contains("<Nome>Matemática</Nome>"));
        assert!(xml.contains("<Situacao>Aprovado</Situacao>"));
        assert!(xml.contains("<Nome>Física</Nome>"));
        assert!(xml.contains("<Situacao>Em Recuperacao</Situacao>"));
        assert!(xml.contains("<CargaHorariaTotal>160h</CargaHorariaTotal>"));
        assert!(xml.contains("<MediaFinal>6.50</MediaFinal>"));
    }

    #[test]
    fn test_validar_consistencia_educacenso_aprovado_sem_erros() {
        let alunos = vec![CensoAlunoRow {
            id: Uuid::new_v4(),
            nome: "Mariana Silva".to_string(),
            cpf: "123.456.789-00".to_string(),
            data_nascimento: chrono::NaiveDate::from_ymd_opt(2008, 4, 10).unwrap(),
            turma_nome: Some("1º Ano A".to_string()),
        }];
        let turmas = vec![CensoTurmaRow {
            id: Uuid::new_v4(),
            nome: "1º Ano A".to_string(),
            ano_letivo: 2026,
            sala_id: Some(Uuid::new_v4()),
        }];
        let profs = vec![CensoProfissionalRow {
            id: Uuid::new_v4(),
            nome: "Prof. Roberto".to_string(),
            cpf: "987.654.321-00".to_string(),
            cargo: "Professor de Matemática".to_string(),
        }];

        let erros = validar_consistencia_educacenso(&alunos, &turmas, &profs);
        assert!(
            erros.is_empty(),
            "Não deve haver inconsistências para registros regulares: {:?}",
            erros
        );
    }

    #[test]
    fn test_validar_consistencia_educacenso_detecta_aluno_sem_cpf_ou_sem_turma() {
        let alunos = vec![CensoAlunoRow {
            id: Uuid::new_v4(),
            nome: "Aluno Incompleto".to_string(),
            cpf: "000.000.000-00".to_string(),
            data_nascimento: chrono::NaiveDate::from_ymd_opt(2009, 1, 1).unwrap(),
            turma_nome: None,
        }];
        let turmas = vec![];
        let profs = vec![];

        let erros = validar_consistencia_educacenso(&alunos, &turmas, &profs);
        assert!(erros.iter().any(|e| e.contains("CPF ausente ou inválido")));
        assert!(erros.iter().any(|e| e.contains("sem vinculação ativa")));
    }

    #[test]
    fn test_validar_consistencia_educacenso_detecta_turma_sem_sala() {
        let turmas = vec![CensoTurmaRow {
            id: Uuid::new_v4(),
            nome: "3º Ano B".to_string(),
            ano_letivo: 2026,
            sala_id: None,
        }];

        let erros = validar_consistencia_educacenso(&[], &turmas, &[]);
        assert!(erros
            .iter()
            .any(|e| e.contains("sem sala de aula física cadastrada")));
    }

    #[test]
    fn test_gerar_arquivo_posicional_educacenso_estrutura_registros() {
        let aluno_id = Uuid::new_v4();
        let turma_id = Uuid::new_v4();
        let prof_id = Uuid::new_v4();

        let alunos = vec![CensoAlunoRow {
            id: aluno_id,
            nome: "Fernanda Costa".to_string(),
            cpf: "111.222.333-44".to_string(),
            data_nascimento: chrono::NaiveDate::from_ymd_opt(2008, 6, 20).unwrap(),
            turma_nome: Some("Turma Alpha".to_string()),
        }];
        let turmas = vec![CensoTurmaRow {
            id: turma_id,
            nome: "Turma Alpha".to_string(),
            ano_letivo: 2026,
            sala_id: Some(Uuid::new_v4()),
        }];
        let profs = vec![CensoProfissionalRow {
            id: prof_id,
            nome: "Prof. Juliana".to_string(),
            cpf: "555.666.777-88".to_string(),
            cargo: "Docente".to_string(),
        }];

        let arquivo = gerar_arquivo_posicional_educacenso(
            "Colégio Positivo Teste",
            "19842",
            "Gestor Escolar",
            "gestor@escola.com",
            &alunos,
            &turmas,
            &profs,
            "2026-09-25T15:00:00Z",
        );

        assert!(arquivo.contains("00|2026.1|19842|Colégio Positivo Teste"));
        assert!(arquivo.contains("10|19842|Colégio Positivo Teste"));
        assert!(arquivo.contains("20|Gestor Escolar|gestor@escola.com"));
        assert!(arquivo.contains("30|"));
        assert!(arquivo.contains("40|"));
        assert!(arquivo.contains("50|"));
        assert!(arquivo.contains("99|TOTAL_REGISTROS|"));
    }
}

pub async fn listar_alertas_evasao(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<axum::Json<Vec<crate::models::regulatorio_ia::PredizerEvasaoResponse>>, AppError> {
    crate::middleware::rbac::check_roles(
        &auth_user,
        &["admin", "gestor", "professor", "secretaria"],
    )?;
    let tenant_id = active_tenant.0;

    let alunos = sqlx::query_as::<_, (Uuid, String)>(
        r#"
        SELECT a.id, a.nome
        FROM alunos a
        WHERE a.tenant_id = $1
        ORDER BY a.nome
        LIMIT 200
        "#,
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    let mut alertas = Vec::new();
    for (aluno_id, aluno_nome) in alunos {
        let freq_row = sqlx::query_as::<_, (i64, i64)>(
            r#"
            SELECT COUNT(id), COUNT(id) FILTER (WHERE presente = true)
            FROM presencas
            WHERE tenant_id = $1 AND aluno_id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(aluno_id)
        .fetch_one(&mut *db)
        .await?;

        let (frequencia_ultimos_30_dias, sem_chamadas) = if freq_row.0 > 0 {
            (
                ((freq_row.1 as f64 / freq_row.0 as f64) * 1000.0).round() / 10.0,
                false,
            )
        } else {
            (100.0, true)
        };

        let faturas_atrasadas = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)
            FROM faturas
            WHERE tenant_id = $1
              AND aluno_id = $2
              AND (status = 'atrasado' OR (status = 'pendente' AND data_vencimento < CURRENT_DATE))
            "#,
        )
        .bind(tenant_id)
        .bind(aluno_id)
        .fetch_one(&mut *db)
        .await?;

        let media = sqlx::query_scalar::<_, Option<f64>>(
            "SELECT AVG(nota) FROM notas WHERE tenant_id = $1 AND aluno_id = $2",
        )
        .bind(tenant_id)
        .bind(aluno_id)
        .fetch_one(&mut *db)
        .await?
        .unwrap_or(7.0);

        let turma_nome = sqlx::query_scalar::<_, String>(
            r#"
            SELECT t.nome
            FROM turmas t
            JOIN turma_alunos ta ON t.id = ta.turma_id AND t.tenant_id = ta.tenant_id
            WHERE ta.tenant_id = $1 AND ta.aluno_id = $2 AND ta.status = 'ativo'
            ORDER BY t.ano_letivo DESC
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(aluno_id)
        .fetch_optional(&mut *db)
        .await?;

        let resultado = calcular_score_evasao(
            aluno_id,
            DetalhesEvasao {
                faturas_atrasadas,
                frequencia_ultimos_30_dias,
                media_disciplinas: (media * 10.0).round() / 10.0,
                sem_chamadas,
            },
        );
        if resultado.score_risco_evasao >= 40.0 {
            alertas.push(PredizerEvasaoResponse {
                aluno_nome,
                turma_nome,
                ..resultado
            });
        }
    }

    alertas.sort_by(|a, b| {
        b.score_risco_evasao
            .partial_cmp(&a.score_risco_evasao)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(axum::Json(alertas))
}
