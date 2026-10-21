use axum::{
    middleware,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::json;
use tower_http::{limit::RequestBodyLimitLayer, trace::TraceLayer};

use crate::middleware::log_redaction::RedactedMakeSpan;

use crate::{
    config::AppState,
    handlers::{
        academico::{
            adicionar_disciplina_turma, apurar_gabarito_tri, atribuir_professor_turma,
            atualizar_disciplina, consultar_boletim, consultar_diario_dia,
            consultar_resultado_simulado_tri, criar_cardapio_nutricao, criar_disciplina,
            criar_horario_turma, criar_projeto_educacional, criar_simulado_tri, deletar_disciplina,
            deletar_horario_turma, listar_cardapios_nutricao, listar_diarios_recentes,
            listar_disciplinas, listar_disciplinas_turma, listar_horarios_turma,
            listar_portfolio_infantil, listar_professores_disponiveis, listar_professores_turma,
            listar_projetos_educacionais, listar_simulados_tri, registrar_portfolio_infantil,
            remover_atribuicao_docente, remover_disciplina_turma, sincronizar_diario_pwa,
        },
        agenda_admin::{
            atualizar_evento_calendario, atualizar_fornecedor, atualizar_funcionario,
            atualizar_status_medicamento, consultar_diario_infantil, consultar_rotina_aluno,
            criar_autorizacao_medicamento, criar_evento_calendario, criar_fornecedor,
            criar_funcionario, deletar_evento_calendario, deletar_fornecedor, deletar_funcionario,
            enviar_mensagem_agenda, listar_autorizacoes_medicamento, listar_contatos_escola,
            listar_eventos_calendario, listar_fornecedores, listar_funcionarios,
            listar_mensagens_agenda, listar_ocorrencias_aluno, listar_ocorrencias_turma,
            listar_rsvps_evento, marcar_mensagem_lida, registrar_ocorrencia,
            registrar_rotina_diaria, relatorios_operacionais_auditoria, responder_rsvp,
            stream_mensagens_agenda,
        },
        auth::{
            alterar_senha, jwks, login, logout, me, oauth_authorize, oauth_token,
            openid_configuration, refresh_http, register_tenant, userinfo,
        },
        avaliacoes::{criar_avaliacao, deletar_avaliacao, listar_avaliacoes},
        crm_lms::{
            adicionar_interacao_lead, atualizar_lead, capturar_lead_publico, criar_lead,
            listar_leads, listar_protocolos_atendimento, lti_grade_sync, lti_launch, obter_lead,
            obter_lms_config, obter_scorm_track, relatorio_funil_crm,
            responder_protocolo_atendimento, salvar_lms_config, scorm_track, whatsapp_webhook,
            whatsapp_webhook_verify,
        },
        documentos::emitir_documento,
        fechamento::{
            fechar_periodo, listar_conselhos, listar_fechamentos, reabrir_periodo, salvar_parecer,
        },
        financeiro::{
            atualizar_despesa, atualizar_fatura, deletar_despesa, deletar_fatura,
            emitir_cora_fatura, emitir_itau_fatura, emitir_nfse, estornar_despesa,
            executar_regua_cobranca, gerar_despesa, gerar_fatura, gerar_parcelas_de_contrato,
            listar_conciliacao, listar_despesas, listar_faturas, listar_logs_regua, listar_nfse,
            obter_status_integracoes, processar_conciliacao_bancaria, relatorio_dre,
            simular_pagamento_cora_fatura,
        },
        frequencia::{alertas_frequencia, frequencia_hoje, relatorio_frequencia},
        notificacoes::{
            criar_notificacao, listar_logs_disparos, listar_notificacoes, marcar_notificacao_lida,
            marcar_todas_notificacoes_lidas, registrar_push_subscription, vapid_public_key,
        },
        nutricao::{
            atualizar_prato, confirmar_recorrencia_cardapio, criar_prato, editar_cardapio_escopo,
            encerrar_recorrencia_cardapio, excluir_cardapio_dia, excluir_prato, listar_pratos,
            listar_recorrencias_cardapio, prever_recorrencia_cardapio,
        },
        opensec::obter_status_opensec,
        planos_aula::{comentar_plano_aula, consultar_planos_aula, salvar_plano_aula},
        professor::{aulas_do_dia, lancar_notas_lote, listar_notas, minhas_turmas},
        recuperacao_senha::{esqueci_senha, listar_emails_saida_handler, redefinir_senha_publico},
        regulatorio_ia::{
            baixar_educacenso, cadastrar_credencial_perimetral, consultar_diploma_digital,
            emitir_diploma_digital, exportar_educacenso, listar_alertas_evasao,
            predizer_risco_evasao, registrar_consentimento_lgpd, validar_acesso_perimetral,
            validar_diploma_digital_publico,
        },
        secretaria::{
            assinar_contrato, atualizar_aluno, atualizar_autorizado_retirada, atualizar_turma,
            criar_autorizado_retirada, criar_contrato, criar_grupo_familiar, criar_matricula,
            criar_sala, criar_turma, deletar_aluno, deletar_autorizado_retirada, deletar_sala,
            deletar_turma, desenturmar_aluno_turma, listar_alunos, listar_alunos_turma,
            listar_autorizados_retirada, listar_contratos, listar_grupos_familiares,
            listar_meus_alunos, listar_salas, listar_turmas, matricular_aluno_turma,
            obter_contrato, obter_prontuario, obter_turma, renumerar_chamada_turma,
            salvar_prontuario, transferir_aluno_turma, vincular_responsavel_aluno,
        },
        usuarios::{atualizar_usuario, criar_usuario, listar_usuarios, redefinir_senha},
        virada_ano::{executar_virada_ano, obter_previa_virada_ano},
    },
    middleware::{
        auth::auth_middleware, security::opensec_security_headers_middleware,
        tenant::tenant_middleware,
    },
};

async fn health_check(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    match sqlx::query("SELECT 1").execute(&state.pool).await {
        Ok(_) => Ok(Json(json!({
            "status": "ok",
            "database": "connected",
            "system": "Escolar ERP Backend OpenSec Edition",
            "architecture": "Rust + Axum + Multi-Tenant PostgreSQL + OpenSec Protection",
            "opensec_status": "Enforced"
        }))),
        Err(e) => {
            tracing::error!(database_error = %e, "Health check não conseguiu consultar o PostgreSQL");
            Err((
                axum::http::StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "status": "degraded",
                    "database": "disconnected"
                })),
            ))
        }
    }
}

pub fn create_router(state: AppState) -> Router {
    let state_clone = state.clone();
    let protected_routes = Router::new()
        // Autenticação & Secretaria (CRUD Alunos/Prontuários, Turmas & Contratos Digitais)
        .route("/auth/me", get(me))
        .route("/auth/logout", post(logout))
        .route("/auth/alterar-senha", post(alterar_senha))
        .route("/auth/oauth/authorize", post(oauth_authorize))
        .route("/auth/oauth/userinfo", get(userinfo))
        .route("/secretaria/matriculas", post(criar_matricula))
        .route("/secretaria/alunos", get(listar_alunos))
        .route("/secretaria/alunos/meus", get(listar_meus_alunos))
        .route(
            "/secretaria/alunos/vincular-responsavel",
            post(vincular_responsavel_aluno),
        )
        .route(
            "/secretaria/alunos/:aluno_id",
            put(atualizar_aluno).delete(deletar_aluno),
        )
        .route(
            "/secretaria/alunos/:aluno_id/documento",
            get(emitir_documento),
        )
        .route(
            "/secretaria/prontuarios/:aluno_id",
            get(obter_prontuario).put(salvar_prontuario),
        )
        // Turmas, Salas & Ensalamento / Vínculo de Alunos
        .route("/secretaria/turmas", post(criar_turma).get(listar_turmas))
        .route(
            "/secretaria/turmas/:turma_id",
            get(obter_turma).put(atualizar_turma).delete(deletar_turma),
        )
        .route(
            "/secretaria/turmas/:turma_id/alunos",
            get(listar_alunos_turma),
        )
        .route(
            "/secretaria/turmas/matricular",
            post(matricular_aluno_turma),
        )
        .route(
            "/secretaria/turmas/:turma_id/alunos/:aluno_id",
            delete(desenturmar_aluno_turma),
        )
        .route(
            "/secretaria/turmas/transferir",
            post(transferir_aluno_turma),
        )
        // Settings
        .route(
            "/tenant/integrations/banking",
            get(crate::handlers::tenant_settings::get_bank_integrations)
                .put(crate::handlers::tenant_settings::save_bank_integration),
        )
        // Assistente de conexão Itaú
        .route(
            "/tenant/integrations/itau",
            get(crate::handlers::itau_config::obter_estado_itau),
        )
        .route(
            "/tenant/integrations/itau/dados",
            put(crate::handlers::itau_config::salvar_dados_cobranca_itau),
        )
        .route(
            "/tenant/integrations/itau/chave-transporte",
            post(crate::handlers::itau_config::gerar_chave_transporte_itau),
        )
        .route(
            "/tenant/integrations/itau/credenciais",
            post(crate::handlers::itau_config::configurar_credenciais_producao_itau),
        )
        .route(
            "/tenant/integrations/itau/credenciais-sandbox",
            post(crate::handlers::itau_config::configurar_credenciais_sandbox_itau),
        )
        .route(
            "/tenant/integrations/itau/testar",
            post(crate::handlers::itau_config::testar_conexao_itau),
        )
        .route(
            "/tenant/integrations/itau/ativar",
            post(crate::handlers::itau_config::ativar_integracao_itau),
        )
        .route(
            "/tenant/integrations/itau/renovar",
            post(crate::handlers::itau_config::renovar_certificado_itau),
        )
        .route(
            "/tenant/integrations/itau/webhooks/boleto",
            post(crate::handlers::itau_config::cadastrar_webhook_boleto_itau),
        )
        .route(
            "/tenant/integrations/itau/webhooks/pix",
            post(crate::handlers::itau_config::cadastrar_webhook_pix_itau),
        )
        .route(
            "/secretaria/turmas/:turma_id/renumerar-chamada",
            post(renumerar_chamada_turma),
        )
        .route("/secretaria/salas", post(criar_sala).get(listar_salas))
        .route("/secretaria/salas/:sala_id", delete(deletar_sala))
        .route(
            "/secretaria/contratos",
            post(criar_contrato).get(listar_contratos),
        )
        .route("/secretaria/contratos/:contrato_id", get(obter_contrato))
        .route(
            "/secretaria/contratos/:contrato_id/assinar",
            post(assinar_contrato),
        )
        // Virada de ano letivo e rematrícula (C15)
        .route(
            "/secretaria/virada-ano/previa",
            get(obter_previa_virada_ano),
        )
        .route("/secretaria/virada-ano/executar", post(executar_virada_ano))
        // 1. Financeiro (Faturamento, Tesouraria, AP/AR, NFS-e, BI DRE/DFC) - Full CRUD Faturas & Despesas
        .route(
            "/financeiro/faturas",
            post(gerar_fatura).get(listar_faturas),
        )
        .route(
            "/financeiro/faturas/gerar-parcelas",
            post(gerar_parcelas_de_contrato),
        )
        .route(
            "/financeiro/faturas/:fatura_id",
            put(atualizar_fatura).delete(deletar_fatura),
        )
        .route(
            "/financeiro/faturas/:fatura_id/cora",
            post(emitir_cora_fatura),
        )
        .route(
            "/financeiro/faturas/:fatura_id/cora/simular-pagamento",
            post(simular_pagamento_cora_fatura),
        )
        .route(
            "/financeiro/faturas/:fatura_id/itau",
            post(emitir_itau_fatura),
        )
        .route(
            "/financeiro/integracoes/status",
            get(obter_status_integracoes),
        )
        .route(
            "/financeiro/despesas",
            post(gerar_despesa).get(listar_despesas),
        )
        .route(
            "/financeiro/despesas/:despesa_id",
            put(atualizar_despesa).delete(deletar_despesa),
        )
        .route(
            "/financeiro/despesas/:despesa_id/estornar",
            post(estornar_despesa),
        )
        .route("/financeiro/nfse/emitir", post(emitir_nfse))
        .route("/financeiro/nfse", get(listar_nfse))
        .route("/financeiro/conciliacao", get(listar_conciliacao))
        .route(
            "/financeiro/conciliacao/processar",
            post(processar_conciliacao_bancaria),
        )
        .route("/financeiro/cobranca/regua", post(executar_regua_cobranca))
        .route("/financeiro/cobranca/logs", get(listar_logs_regua))
        .route("/financeiro/relatorios/dre", get(relatorio_dre))
        // 2. Pedagógico & Nutrição (Diário PWA, Boletim Consolidado, TRI & Gabaritos, Projetos Educacionais, Cardápios Nutrição)
        .route("/academico/diario/sync", post(sincronizar_diario_pwa))
        .route("/academico/diario", get(consultar_diario_dia))
        .route("/academico/diario/recentes", get(listar_diarios_recentes))
        .route("/academico/frequencia", get(relatorio_frequencia))
        .route("/academico/frequencia/alertas", get(alertas_frequencia))
        .route("/academico/frequencia/hoje", get(frequencia_hoje))
        .route("/academico/boletim/:aluno_id", get(consultar_boletim))
        .route("/academico/notas", get(listar_notas))
        .route("/academico/notas/lote", post(lancar_notas_lote))
        .route(
            "/academico/fechamentos",
            get(listar_fechamentos).post(fechar_periodo),
        )
        .route("/academico/fechamentos/:id", delete(reabrir_periodo))
        .route(
            "/academico/conselho",
            get(listar_conselhos).put(salvar_parecer),
        )
        .route("/professor/minhas-turmas", get(minhas_turmas))
        .route("/professor/aulas", get(aulas_do_dia))
        .route(
            "/planos-aula",
            get(consultar_planos_aula).put(salvar_plano_aula),
        )
        .route("/planos-aula/:id/comentario", put(comentar_plano_aula))
        .route("/avaliacoes", get(listar_avaliacoes).post(criar_avaliacao))
        .route("/avaliacoes/:id", delete(deletar_avaliacao))
        .route(
            "/academico/simulados",
            post(criar_simulado_tri).get(listar_simulados_tri),
        )
        .route("/academico/apuracao-gabarito", post(apurar_gabarito_tri))
        .route(
            "/academico/simulados/:simulado_id/resultados/:aluno_id",
            get(consultar_resultado_simulado_tri),
        )
        .route(
            "/pedagogico/projetos",
            post(criar_projeto_educacional).get(listar_projetos_educacionais),
        )
        .route(
            "/pedagogico/disciplinas",
            post(criar_disciplina).get(listar_disciplinas),
        )
        .route(
            "/pedagogico/disciplinas/:disciplina_id",
            put(atualizar_disciplina).delete(deletar_disciplina),
        )
        .route(
            "/pedagogico/professores",
            get(listar_professores_disponiveis),
        )
        .route(
            "/pedagogico/turmas/:turma_id/disciplinas",
            get(listar_disciplinas_turma).post(adicionar_disciplina_turma),
        )
        .route(
            "/pedagogico/turmas/:turma_id/disciplinas/:disciplina_id",
            delete(remover_disciplina_turma),
        )
        .route(
            "/pedagogico/turmas/:turma_id/professores",
            get(listar_professores_turma),
        )
        .route(
            "/pedagogico/turmas/atribuir-professor",
            post(atribuir_professor_turma),
        )
        .route(
            "/pedagogico/turmas/atribuicoes/:id",
            delete(remover_atribuicao_docente),
        )
        .route(
            "/pedagogico/turmas/:turma_id/horarios",
            get(listar_horarios_turma).post(criar_horario_turma),
        )
        .route(
            "/pedagogico/turmas/horarios/:id",
            delete(deletar_horario_turma),
        )
        // Aliases /academico/...
        .route(
            "/academico/disciplinas",
            post(criar_disciplina).get(listar_disciplinas),
        )
        .route(
            "/academico/professores/disponiveis",
            get(listar_professores_disponiveis),
        )
        .route(
            "/academico/turmas/:turma_id/disciplinas",
            get(listar_disciplinas_turma).post(adicionar_disciplina_turma),
        )
        .route(
            "/academico/turmas/:turma_id/professores",
            get(listar_professores_turma),
        )
        .route(
            "/academico/turmas/:turma_id/horarios",
            get(listar_horarios_turma).post(criar_horario_turma),
        )
        .route(
            "/nutricao/cardapios",
            post(criar_cardapio_nutricao).get(listar_cardapios_nutricao),
        )
        .route("/nutricao/pratos", post(criar_prato).get(listar_pratos))
        .route(
            "/nutricao/pratos/:id",
            put(atualizar_prato).delete(excluir_prato),
        )
        .route(
            "/nutricao/cardapios/recorrencias/previa",
            post(prever_recorrencia_cardapio),
        )
        .route(
            "/nutricao/cardapios/recorrencias",
            get(listar_recorrencias_cardapio).post(confirmar_recorrencia_cardapio),
        )
        .route(
            "/nutricao/cardapios/recorrencias/:id/encerrar",
            post(encerrar_recorrencia_cardapio),
        )
        .route(
            "/nutricao/cardapios/:id",
            put(editar_cardapio_escopo).delete(excluir_cardapio_dia),
        )
        // 3. Administrativo (RH Funcionários, Fornecedores, Auditoria & Relatórios Operacionais) - Full CRUD
        .route(
            "/administrativo/funcionarios",
            post(criar_funcionario).get(listar_funcionarios),
        )
        .route(
            "/administrativo/funcionarios/:funcionario_id",
            put(atualizar_funcionario).delete(deletar_funcionario),
        )
        .route(
            "/administrativo/fornecedores",
            post(criar_fornecedor).get(listar_fornecedores),
        )
        .route(
            "/administrativo/fornecedores/:fornecedor_id",
            put(atualizar_fornecedor).delete(deletar_fornecedor),
        )
        .route(
            "/administrativo/auditoria",
            get(relatorios_operacionais_auditoria),
        )
        .route(
            "/administrativo/usuarios",
            get(listar_usuarios).post(criar_usuario),
        )
        .route("/administrativo/usuarios/:id", put(atualizar_usuario))
        .route(
            "/administrativo/usuarios/:id/redefinir-senha",
            post(redefinir_senha),
        )
        .route(
            "/administrativo/emails-saida",
            get(listar_emails_saida_handler),
        )
        // 4. Agenda Digital App & Ocorrências (Comunicação Centralizada Auditável, Ocorrências & Tracking)
        .route(
            "/agenda/mensagens",
            post(enviar_mensagem_agenda).get(listar_mensagens_agenda),
        )
        .route("/agenda/mensagens/stream", get(stream_mensagens_agenda))
        .route(
            "/agenda/mensagens/:mensagem_id/lida",
            post(marcar_mensagem_lida),
        )
        .route("/agenda/contatos-escola", get(listar_contatos_escola))
        .route("/agenda/rotina", post(registrar_rotina_diaria))
        .route("/agenda/rotina/:aluno_id", get(consultar_rotina_aluno))
        .route(
            "/agenda/diario-infantil/:aluno_id",
            get(consultar_diario_infantil),
        )
        .route(
            "/agenda/ocorrencias",
            post(registrar_ocorrencia).get(listar_ocorrencias_turma),
        )
        .route(
            "/agenda/ocorrencias/:aluno_id",
            get(listar_ocorrencias_aluno),
        )
        // Notificações e disparos (WhatsApp, push, e-mail)
        .route(
            "/notificacoes",
            post(criar_notificacao).get(listar_notificacoes),
        )
        .route(
            "/notificacoes/marcar-lida/:id",
            post(marcar_notificacao_lida),
        )
        .route(
            "/notificacoes/marcar-todas-lidas",
            post(marcar_todas_notificacoes_lidas),
        )
        .route("/notificacoes/logs", get(listar_logs_disparos))
        .route("/notificacoes/push/vapid-public-key", get(vapid_public_key))
        .route(
            "/notificacoes/push/subscribe",
            post(registrar_push_subscription),
        )
        // OpenSec Security Audit Status
        .route("/opensec/status", get(obter_status_opensec))
        // CRM, LMS, Regulatório & LGPD / Perímetro
        .route("/crm/leads", post(criar_lead).get(listar_leads))
        .route("/crm/leads/:lead_id", get(obter_lead).put(atualizar_lead))
        .route(
            "/crm/leads/:lead_id/interacoes",
            post(adicionar_interacao_lead),
        )
        .route("/crm/relatorios/funil", get(relatorio_funil_crm))
        .route("/lms/config", post(salvar_lms_config).get(obter_lms_config))
        .route("/lms/lti/launch", get(lti_launch))
        .route("/lms/grades/sync", post(lti_grade_sync))
        .route("/lms/scorm/track", post(scorm_track))
        .route(
            "/lms/scorm/track/:package_id/:aluno_id",
            get(obter_scorm_track),
        )
        .route("/regulatorio/educacenso/exportar", get(exportar_educacenso))
        .route("/regulatorio/educacenso/download", get(baixar_educacenso))
        .route(
            "/regulatorio/diploma-digital/emitir/:aluno_id",
            post(emitir_diploma_digital),
        )
        .route(
            "/regulatorio/diploma-digital/:aluno_id",
            get(consultar_diploma_digital),
        )
        .route(
            "/regulatorio/lgpd/consentimento",
            post(registrar_consentimento_lgpd),
        )
        .route(
            "/regulatorio/perimetro/validar-acesso",
            post(validar_acesso_perimetral),
        )
        .route(
            "/regulatorio/perimetro/credenciais",
            post(cadastrar_credencial_perimetral),
        )
        .route("/ia/evasao/predizer/:aluno_id", get(predizer_risco_evasao))
        .route("/ia/evasao/alertas", get(listar_alertas_evasao))
        .route(
            "/atendimento/protocolos",
            get(listar_protocolos_atendimento),
        )
        .route(
            "/atendimento/protocolos/:id/responder",
            post(responder_protocolo_atendimento),
        )
        // Novas Rotas Escola Infantil (Goal)
        .route(
            "/secretaria/alunos/:aluno_id/autorizados",
            post(criar_autorizado_retirada).get(listar_autorizados_retirada),
        )
        .route("/agenda/medicamentos", post(criar_autorizacao_medicamento))
        .route("/pedagogico/portfolio", post(registrar_portfolio_infantil))
        .route(
            "/secretaria/grupos-familiares",
            post(criar_grupo_familiar).get(listar_grupos_familiares),
        )
        .route(
            "/secretaria/alunos/:aluno_id/autorizados/:autorizado_id",
            put(atualizar_autorizado_retirada).delete(deletar_autorizado_retirada),
        )
        .route(
            "/agenda/medicamentos/:aluno_id",
            get(listar_autorizacoes_medicamento),
        )
        .route(
            "/agenda/medicamentos/:aluno_id/:auth_id",
            put(atualizar_status_medicamento),
        )
        .route(
            "/pedagogico/portfolio/:aluno_id",
            get(listar_portfolio_infantil),
        )
        .route(
            "/agenda/calendario",
            post(criar_evento_calendario).get(listar_eventos_calendario),
        )
        .route(
            "/agenda/calendario/:evento_id",
            put(atualizar_evento_calendario).delete(deletar_evento_calendario),
        )
        .route(
            "/agenda/calendario/:evento_id/rsvp",
            post(responder_rsvp).get(listar_rsvps_evento),
        )
        .layer(middleware::from_fn_with_state(
            state_clone.clone(),
            crate::middleware::feature_flag::check_feature_flag,
        ))
        .layer(middleware::from_fn(tenant_middleware))
        .layer(middleware::from_fn_with_state(state_clone, auth_middleware));

    let public_routes = Router::new()
        .route(
            "/webhooks/cora/:tenant_id",
            post(crate::handlers::webhooks_cora::cora_webhook_handler),
        )
        .route(
            "/api/webhooks/cora/:tenant_id",
            post(crate::handlers::webhooks_cora::cora_webhook_handler),
        )
        .route(
            "/webhooks/itau/:tenant_id/oauth/token",
            post(crate::handlers::webhooks_itau::itau_oauth_token_handler),
        )
        .route(
            "/api/webhooks/itau/:tenant_id/oauth/token",
            post(crate::handlers::webhooks_itau::itau_oauth_token_handler),
        )
        .route(
            "/webhooks/itau/:tenant_id/boletos",
            post(crate::handlers::webhooks_itau::itau_boletos_webhook_handler),
        )
        .route(
            "/api/webhooks/itau/:tenant_id/boletos",
            post(crate::handlers::webhooks_itau::itau_boletos_webhook_handler),
        )
        .route(
            "/webhooks/itau/:tenant_id/pix",
            post(crate::handlers::webhooks_itau::itau_pix_webhook_handler),
        )
        .route(
            "/api/webhooks/itau/:tenant_id/pix",
            post(crate::handlers::webhooks_itau::itau_pix_webhook_handler),
        )
        .route("/health", get(health_check))
        .route("/auth/register-tenant", post(register_tenant))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh_http))
        .route("/auth/esqueci-senha", post(esqueci_senha))
        .route("/auth/redefinir-senha", post(redefinir_senha_publico))
        .route("/auth/oauth/token", post(oauth_token))
        .route(
            "/.well-known/openid-configuration",
            get(openid_configuration),
        )
        .route("/.well-known/jwks.json", get(jwks))
        .route(
            "/atendimento/whatsapp/webhook",
            post(whatsapp_webhook).get(whatsapp_webhook_verify),
        )
        .route("/crm/leads/public", post(capturar_lead_publico))
        .route(
            "/downloads/censo_escolar_2026_inep.txt",
            get(baixar_educacenso),
        )
        .route(
            "/regulatorio/diploma-digital/validar/:codigo",
            get(validar_diploma_digital_publico),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::middleware::security::ip_rate_limit_middleware,
        ));

    let allowed_origins: Vec<_> = state
        .config
        .allowed_origins
        .split(',')
        .filter_map(|s| s.trim().parse::<axum::http::HeaderValue>().ok())
        .collect();

    let cors = tower_http::cors::CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
            axum::http::Method::PATCH,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
            axum::http::header::HeaderName::from_static("x-tenant-id"),
            axum::http::header::HeaderName::from_static("x-auth-mode"),
        ])
        .allow_credentials(true);

    let root_webhooks = Router::new()
        .route(
            "/webhooks/cora/:tenant_id",
            post(crate::handlers::webhooks_cora::cora_webhook_handler),
        )
        .route(
            "/api/webhooks/cora/:tenant_id",
            post(crate::handlers::webhooks_cora::cora_webhook_handler),
        )
        .route(
            "/webhooks/itau/:tenant_id/oauth/token",
            post(crate::handlers::webhooks_itau::itau_oauth_token_handler),
        )
        .route(
            "/api/webhooks/itau/:tenant_id/oauth/token",
            post(crate::handlers::webhooks_itau::itau_oauth_token_handler),
        )
        .route(
            "/webhooks/itau/:tenant_id/boletos",
            post(crate::handlers::webhooks_itau::itau_boletos_webhook_handler),
        )
        .route(
            "/api/webhooks/itau/:tenant_id/boletos",
            post(crate::handlers::webhooks_itau::itau_boletos_webhook_handler),
        )
        .route(
            "/webhooks/itau/:tenant_id/pix",
            post(crate::handlers::webhooks_itau::itau_pix_webhook_handler),
        )
        .route(
            "/api/webhooks/itau/:tenant_id/pix",
            post(crate::handlers::webhooks_itau::itau_pix_webhook_handler),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::middleware::security::ip_rate_limit_middleware,
        ));

    Router::new()
        .merge(root_webhooks)
        .nest("/api/v1", public_routes.merge(protected_routes))
        .route(
            "/downloads/censo_escolar_2026_inep.txt",
            get(baixar_educacenso),
        )
        .layer(TraceLayer::new_for_http().make_span_with(RedactedMakeSpan))
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024))
        .layer(middleware::from_fn(opensec_security_headers_middleware))
        .layer(cors)
        .layer(axum::Extension(state.config.clone()))
        .with_state(state)
}
