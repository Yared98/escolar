import os

with open('src/handlers/regulatorio_ia.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Add listar_alertas_evasao handler
new_handler = """
pub async fn listar_alertas_evasao(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<axum::Json<Vec<ResultadoEvasao>>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "professor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    // Simulate fetching all students and calculating risk
    // In a real app, this would query a materialized view or run a batch job.
    // For this ERP MVP, we'll fetch a few students and return their risk.
    
    // We'll mock some high-risk students to populate the dashboard.
    let mut alertas = Vec::new();
    
    alertas.push(ResultadoEvasao {
        aluno_id: Uuid::new_v4(),
        score_risco_evasao: 85.5,
        nivel_urgencia: "alta".to_string(),
        fator_principal: "faltas_reiteradas".to_string(),
        recomendacao: "Agendar reunião urgente com os pais. Risco iminente de abandono por infrequência.".to_string(),
        detalhes: DetalhesEvasao {
            faturas_atrasadas: 1,
            frequencia_ultimos_30_dias: 60.0,
            media_disciplinas: 6.5,
        }
    });

    alertas.push(ResultadoEvasao {
        aluno_id: Uuid::new_v4(),
        score_risco_evasao: 72.0,
        nivel_urgencia: "media".to_string(),
        fator_principal: "inadimplencia".to_string(),
        recomendacao: "Acionar setor financeiro para proposta de renegociação.".to_string(),
        detalhes: DetalhesEvasao {
            faturas_atrasadas: 3,
            frequencia_ultimos_30_dias: 85.0,
            media_disciplinas: 7.0,
        }
    });

    alertas.push(ResultadoEvasao {
        aluno_id: Uuid::new_v4(),
        score_risco_evasao: 65.0,
        nivel_urgencia: "media".to_string(),
        fator_principal: "queda_desempenho".to_string(),
        recomendacao: "Encaminhar para tutoria pedagógica no contraturno.".to_string(),
        detalhes: DetalhesEvasao {
            faturas_atrasadas: 0,
            frequencia_ultimos_30_dias: 90.0,
            media_disciplinas: 4.5,
        }
    });

    Ok(axum::Json(alertas))
}
"""

with open('src/handlers/regulatorio_ia.rs', 'w', encoding='utf-8') as f:
    f.write(content + new_handler)

with open('src/routes.rs', 'r', encoding='utf-8') as f:
    routes_content = f.read()

routes_content = routes_content.replace(
    "exportar_educacenso, predizer_risco_evasao,",
    "exportar_educacenso, predizer_risco_evasao, listar_alertas_evasao,"
)
routes_content = routes_content.replace(
    ".route(\"/ia/evasao/predizer/:aluno_id\", get(predizer_risco_evasao))",
    ".route(\"/ia/evasao/predizer/:aluno_id\", get(predizer_risco_evasao))\n        .route(\"/ia/evasao/alertas\", get(listar_alertas_evasao))"
)

with open('src/routes.rs', 'w', encoding='utf-8') as f:
    f.write(routes_content)
