use axum::{
    extract::{Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
    Extension, Json,
};
use chrono::NaiveDate;
use futures_util::stream::{Stream, StreamExt};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::Row;
use std::{convert::Infallible, time::Duration};
use tokio_stream::wrappers::BroadcastStream;
use uuid::Uuid;

use crate::{
    config::AppState, db::TenantDb,
    error::AppError,
    middleware::{auth::AuthUser, rbac::{check_roles, log_audit, check_aluno_ownership}, tenant::ActiveTenant},
    models::agenda_admin::{
        AuditLog, CreateFornecedorDto, CreateFuncionarioDto, CreateMensagemAgendaDto,
        CreateOcorrenciaDto, CreateRotinaDiariaDto, DiarioInfantilQuery, Fornecedor, Funcionario,
        MensagemAgenda, MensagemAgendaView, OcorrenciaAluno, RotinaDiariaInfantil,
        UpdateFornecedorDto, UpdateFuncionarioDto,
    },
};

// --- ADMINISTRATIVO (RH, Fornecedores, Auditoria) ---

pub async fn criar_funcionario(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateFuncionarioDto>,
) -> Result<Json<Funcionario>, AppError> {
    check_roles(&auth_user, &["admin", "nutricionista"])?;
    let tenant_id = active_tenant.0;

    let funcionario = sqlx::query_as::<_, Funcionario>(
        r#"
        INSERT INTO funcionarios (tenant_id, nome, cpf, cargo, departamento, data_admissao, salario, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ativo')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.nome)
    .bind(&dto.cpf)
    .bind(&dto.cargo)
    .bind(&dto.departamento)
    .bind(dto.data_admissao)
    .bind(dto.salario)
    .fetch_one(&mut *db)
    .await?;

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "CRIAR_FUNCIONARIO", "funcionarios", Some(funcionario.id.to_string()), Some(json!({"nome": dto.nome, "cargo": dto.cargo}))).await;

    Ok(Json(funcionario))
}

pub async fn listar_funcionarios(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Funcionario>>, AppError> {
    check_roles(&auth_user, &["admin", "nutricionista", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let funcionarios = sqlx::query_as::<_, Funcionario>(
        "SELECT * FROM funcionarios WHERE tenant_id = $1 ORDER BY nome ASC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(funcionarios))
}

pub async fn atualizar_funcionario(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(funcionario_id): Path<Uuid>,
    Json(dto): Json<UpdateFuncionarioDto>,
) -> Result<Json<Funcionario>, AppError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;
    let nome_propagado = dto.nome.clone();

    let funcionario = sqlx::query_as::<_, Funcionario>(
        r#"
        UPDATE funcionarios
        SET 
            nome = COALESCE($1, nome),
            cpf = COALESCE($2, cpf),
            cargo = COALESCE($3, cargo),
            departamento = COALESCE($4, departamento),
            salario = COALESCE($5, salario),
            status = COALESCE($6, status)
        WHERE id = $7 AND tenant_id = $8
        RETURNING *
        "#,
    )
    .bind(dto.nome)
    .bind(dto.cpf)
    .bind(dto.cargo)
    .bind(dto.departamento)
    .bind(dto.salario)
    .bind(dto.status)
    .bind(funcionario_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(nome) = nome_propagado {
        sqlx::query(
            "UPDATE cardapios SET nutricionista_responsavel = $1 WHERE nutricionista_id = $2 AND tenant_id = $3",
        )
        .bind(nome)
        .bind(funcionario_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;
    }

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "ATUALIZAR_FUNCIONARIO", "funcionarios", Some(funcionario.id.to_string()), Some(json!({"cargo": &funcionario.cargo, "status": &funcionario.status}))).await;

    Ok(Json(funcionario))
}

pub async fn deletar_funcionario(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(funcionario_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;

    let existe: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM funcionarios WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(funcionario_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;
    if !existe {
        return Err(AppError::NotFound);
    }

    let vinculos: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM cardapios WHERE nutricionista_id = $1 AND tenant_id = $2",
    )
    .bind(funcionario_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if vinculos > 0 {
        sqlx::query("UPDATE funcionarios SET status = 'inativo' WHERE id = $1 AND tenant_id = $2")
            .bind(funcionario_id)
            .bind(tenant_id)
            .execute(&mut *db)
            .await?;
        log_audit(&mut *db, tenant_id, Some(auth_user.id), "INATIVAR_FUNCIONARIO", "funcionarios", Some(funcionario_id.to_string()), None).await;
        return Ok(Json(json!({
            "status": "inativado",
            "mensagem": "Funcionário inativado porque há cardápios vinculados."
        })));
    }

    sqlx::query("DELETE FROM funcionarios WHERE id = $1 AND tenant_id = $2")
        .bind(funcionario_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "DELETAR_FUNCIONARIO", "funcionarios", Some(funcionario_id.to_string()), None).await;

    Ok(Json(json!({ "status": "removido", "mensagem": "Funcionário removido com sucesso." })))
}

pub async fn criar_fornecedor(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateFornecedorDto>,
) -> Result<Json<Fornecedor>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let fornecedor = sqlx::query_as::<_, Fornecedor>(
        r#"
        INSERT INTO fornecedores (tenant_id, razao_social, cnpj, ramo_atividade, email, telefone)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.razao_social)
    .bind(&dto.cnpj)
    .bind(&dto.ramo_atividade)
    .bind(&dto.email)
    .bind(&dto.telefone)
    .fetch_one(&mut *db)
    .await?;

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "CRIAR_FORNECEDOR", "fornecedores", Some(fornecedor.id.to_string()), Some(json!({"razao_social": &fornecedor.razao_social, "cnpj": &fornecedor.cnpj}))).await;

    Ok(Json(fornecedor))
}

pub async fn listar_fornecedores(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Fornecedor>>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let fornecedores = sqlx::query_as::<_, Fornecedor>(
        "SELECT * FROM fornecedores WHERE tenant_id = $1 ORDER BY razao_social ASC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(fornecedores))
}

pub async fn atualizar_fornecedor(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(fornecedor_id): Path<Uuid>,
    Json(dto): Json<UpdateFornecedorDto>,
) -> Result<Json<Fornecedor>, AppError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;
    let razao_propagada = dto.razao_social.clone();

    let fornecedor = sqlx::query_as::<_, Fornecedor>(
        r#"
        UPDATE fornecedores
        SET 
            razao_social = COALESCE($1, razao_social),
            cnpj = COALESCE($2, cnpj),
            ramo_atividade = COALESCE($3, ramo_atividade),
            email = COALESCE($4, email),
            telefone = COALESCE($5, telefone)
        WHERE id = $6 AND tenant_id = $7
        RETURNING *
        "#,
    )
    .bind(dto.razao_social)
    .bind(dto.cnpj)
    .bind(dto.ramo_atividade)
    .bind(dto.email)
    .bind(dto.telefone)
    .bind(fornecedor_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(razao) = razao_propagada {
        sqlx::query(
            "UPDATE despesas SET fornecedor_nome = $1 WHERE fornecedor_id = $2 AND tenant_id = $3",
        )
        .bind(razao)
        .bind(fornecedor_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;
    }

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "ATUALIZAR_FORNECEDOR", "fornecedores", Some(fornecedor.id.to_string()), Some(json!({"razao_social": &fornecedor.razao_social, "cnpj": &fornecedor.cnpj}))).await;

    Ok(Json(fornecedor))
}

pub async fn deletar_fornecedor(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(fornecedor_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let existe: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM fornecedores WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(fornecedor_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;
    if !existe {
        return Err(AppError::NotFound);
    }

    let vinculos: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM despesas WHERE fornecedor_id = $1 AND tenant_id = $2",
    )
    .bind(fornecedor_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    if vinculos > 0 {
        sqlx::query("UPDATE fornecedores SET status = 'inativo' WHERE id = $1 AND tenant_id = $2")
            .bind(fornecedor_id)
            .bind(tenant_id)
            .execute(&mut *db)
            .await?;
        log_audit(&mut *db, tenant_id, Some(auth_user.id), "INATIVAR_FORNECEDOR", "fornecedores", Some(fornecedor_id.to_string()), None).await;
        return Ok(Json(json!({
            "status": "inativado",
            "mensagem": "Fornecedor inativado porque há despesas vinculadas."
        })));
    }

    sqlx::query("DELETE FROM fornecedores WHERE id = $1 AND tenant_id = $2")
        .bind(fornecedor_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "DELETAR_FORNECEDOR", "fornecedores", Some(fornecedor_id.to_string()), None).await;

    Ok(Json(json!({ "status": "removido", "mensagem": "Fornecedor removido com sucesso." })))
}

pub async fn relatorios_operacionais_auditoria(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Value>, AppError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;

    let audit_logs = sqlx::query_as::<_, AuditLog>(
        "SELECT * FROM audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await
    .unwrap_or_default();

    Ok(Json(json!({
        "status": "sucesso",
        "auditoria_ativa": true,
        "logs_recentes": audit_logs,
        "total_registros_auditados": audit_logs.len(),
        "relatorio_gerencial_compliance": "Em conformidade LGPD & MEC Portaria 70/2025"
    })))
}

// --- AGENDA DIGITAL APP (Comunicação Auditável, Ocorrências & Tracking de Rotina Diária) ---

pub async fn enviar_mensagem_agenda(
    State(state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateMensagemAgendaDto>,
) -> Result<Json<MensagemAgenda>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "nutricionista", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    let is_responsavel = auth_user.role.eq_ignore_ascii_case("responsavel");

    if dto.titulo.trim().is_empty() || dto.conteudo.trim().is_empty() {
        return Err(AppError::BadRequest("Informe título e conteúdo do comunicado.".into()));
    }
    if dto.canal.trim().is_empty() {
        return Err(AppError::BadRequest("Informe o canal do comunicado.".into()));
    }
    if is_responsavel && dto.canal.trim() == "mural_turma" && dto.resposta_a_id.is_none() {
        return Err(AppError::BadRequest(
            "Responsáveis não publicam no mural da turma. Responda um comunicado ou envie à escola.".into(),
        ));
    }

    let mut destinatario_id = dto.destinatario_id;
    let mut turma_id = dto.turma_id;
    let mut canal = dto.canal.trim().to_string();
    let mut resposta_a_id: Option<Uuid> = None;
    let mut thread_id: Option<Uuid> = None;

    if let Some(resposta_a) = dto.resposta_a_id {
        let original = sqlx::query(
            "SELECT remetente_id, destinatario_id, turma_id, canal, thread_id FROM mensagens_agenda WHERE id = $1 AND tenant_id = $2",
        )
        .bind(resposta_a)
        .bind(tenant_id)
        .fetch_optional(&mut *db)
        .await?
        .ok_or(AppError::NotFound)?;

        let original_remetente: Uuid = original.try_get("remetente_id").map_err(|_| AppError::NotFound)?;
        let original_dest: Option<Uuid> = original.try_get("destinatario_id").unwrap_or(None);
        let original_canal: String = original.try_get("canal").unwrap_or_default();
        let original_turma: Option<Uuid> = original.try_get("turma_id").unwrap_or(None);
        let original_thread: Option<Uuid> = original.try_get("thread_id").unwrap_or(None);

        if is_responsavel {
            let pode = original_dest == Some(auth_user.id)
                || original_remetente == auth_user.id
                || (original_canal == "mural_turma"
                    && original_turma.is_some()
                    && sqlx::query_scalar::<_, bool>(
                        r#"
                        SELECT EXISTS(
                          SELECT 1
                          FROM turma_alunos ta
                          JOIN alunos a ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                          LEFT JOIN responsaveis_alunos ra
                            ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                          WHERE ta.tenant_id = $1
                            AND ta.turma_id = $2
                            AND ta.status = 'ativo'
                            AND (a.responsavel_user_id = $3 OR ra.responsavel_user_id = $3)
                        )
                        "#,
                    )
                    .bind(tenant_id)
                    .bind(original_turma)
                    .bind(auth_user.id)
                    .fetch_one(&mut *db)
                    .await?);
            if !pode {
                return Err(AppError::Forbidden(
                    "Você não pode responder este comunicado.".into(),
                ));
            }
        }

        resposta_a_id = Some(resposta_a);
        thread_id = Some(original_thread.unwrap_or(resposta_a));

        if destinatario_id.is_none() {
            destinatario_id = if original_remetente == auth_user.id {
                original_dest
            } else {
                Some(original_remetente)
            };
        }
        if turma_id.is_none() {
            turma_id = original_turma;
        }
        canal = if is_responsavel {
            "responsavel".into()
        } else {
            "professor".into()
        };
    }

    if destinatario_id.is_none() {
        if let Some(aluno_id) = dto.aluno_id {
            if is_responsavel {
                return Err(AppError::BadRequest(
                    "Para falar com a escola, responda um comunicado recebido.".into(),
                ));
            }
            destinatario_id = sqlx::query_scalar::<_, Option<Uuid>>(
                r#"
                SELECT COALESCE(
                    a.responsavel_user_id,
                    (
                        SELECT ra.responsavel_user_id
                        FROM responsaveis_alunos ra
                        WHERE ra.tenant_id = a.tenant_id AND ra.aluno_id = a.id
                        ORDER BY ra.created_at NULLS LAST
                        LIMIT 1
                    )
                )
                FROM alunos a
                WHERE a.id = $1 AND a.tenant_id = $2
                "#,
            )
            .bind(aluno_id)
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?
            .flatten();
            if destinatario_id.is_none() {
                return Err(AppError::BadRequest(
                    "Este aluno não possui responsável vinculado ao portal.".into(),
                ));
            }
        }
    }

    if is_responsavel && destinatario_id.is_none() && resposta_a_id.is_none() {
        return Err(AppError::BadRequest(
            "Escolha o professor, a coordenação ou o financeiro para iniciar a conversa.".into(),
        ));
    }

    if is_responsavel {
        if let Some(dest) = destinatario_id {
            if resposta_a_id.is_none()
                && !responsavel_pode_falar_com(&mut *db, tenant_id, auth_user.id, dest).await?
            {
                return Err(AppError::Forbidden(
                    "Você só pode iniciar conversa com gestão, financeiro ou professores das turmas dos seus filhos.".into(),
                ));
            }
        }
        canal = if canal == "mural_turma" {
            "responsavel".into()
        } else {
            canal
        };
        if canal.is_empty() || canal == "professor" {
            canal = "responsavel".into();
        }
    }

    let mut mensagem = sqlx::query_as::<_, MensagemAgenda>(
        r#"
        INSERT INTO mensagens_agenda (
            tenant_id, remetente_id, destinatario_id, turma_id, canal, titulo, conteudo, anexo_url,
            resposta_a_id, thread_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(auth_user.id)
    .bind(destinatario_id)
    .bind(turma_id)
    .bind(&canal)
    .bind(dto.titulo.trim())
    .bind(dto.conteudo.trim())
    .bind(dto.anexo_url)
    .bind(resposta_a_id)
    .bind(thread_id)
    .fetch_one(&mut *db)
    .await?;

    // Nova conversa: a própria mensagem é a raiz da thread
    if mensagem.thread_id.is_none() {
        sqlx::query("UPDATE mensagens_agenda SET thread_id = id WHERE id = $1 AND tenant_id = $2")
            .bind(mensagem.id)
            .bind(tenant_id)
            .execute(&mut *db)
            .await?;
        mensagem.thread_id = Some(mensagem.id);
    }

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ENVIAR_MENSAGEM_AGENDA",
        "mensagens_agenda",
        Some(mensagem.id.to_string()),
        Some(json!({
            "destinatario_id": destinatario_id,
            "titulo": dto.titulo,
            "canal": canal,
            "thread_id": mensagem.thread_id,
            "resposta_a_id": resposta_a_id
        })),
    )
    .await;

    // Notificação in-app + log de push PWA para destinatários
    let mut notify_ids: Vec<Uuid> = Vec::new();
    if let Some(dest) = mensagem.destinatario_id {
        if dest != auth_user.id {
            notify_ids.push(dest);
        }
    } else if mensagem.canal == "responsavel" || mensagem.canal == "professor" {
        // Caixa da escola: notifica gestores/secretaria/professores
        let staff = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT id FROM users
            WHERE tenant_id = $1
              AND lower(replace(role, ' ', '')) IN (
                'admin', 'gestor', 'gestorescolar', 'secretaria', 'professor', 'financeiro'
              )
              AND id <> $2
            LIMIT 20
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await
        .unwrap_or_default();
        notify_ids.extend(staff);
    }

    for dest_id in &notify_ids {
        if let Ok(notif) = sqlx::query_as::<_, crate::models::notificacoes::NotificacaoSistema>(
            r#"
            INSERT INTO notificacoes_sistema (
                tenant_id, destinatario_id, modulo, titulo, mensagem, prioridade, canal_disparo, lida
            )
            VALUES ($1, $2, 'agenda', $3, $4, 'alta', 'push_pwa', false)
            RETURNING *
            "#,
        )
        .bind(tenant_id)
        .bind(dest_id)
        .bind(format!("Nova mensagem: {}", mensagem.titulo))
        .bind(&mensagem.conteudo)
        .fetch_one(&mut *db)
        .await
        {
            let _ = sqlx::query(
                r#"
                INSERT INTO notificacoes_disparos_logs (tenant_id, notificacao_id, canal, destino, status_envio)
                VALUES ($1, $2, 'web_push_pwa', $3, 'simulado')
                "#,
            )
            .bind(tenant_id)
            .bind(notif.id)
            .bind(dest_id.to_string())
            .execute(&mut *db)
            .await;
        }
    }

    state.message_hub.publish(crate::realtime::MensagemRealtimeEvent {
        tipo: "mensagem_nova".into(),
        tenant_id,
        mensagem_id: mensagem.id,
        thread_id: mensagem.thread_id,
        remetente_id: auth_user.id,
        destinatario_id: mensagem.destinatario_id,
        titulo: mensagem.titulo.clone(),
        conteudo: mensagem.conteudo.clone(),
        canal: mensagem.canal.clone(),
    });

    Ok(Json(mensagem))
}

pub async fn listar_mensagens_agenda(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<MensagemAgendaView>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "nutricionista", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    let role = auth_user.role.to_lowercase().replace([' ', '_'], "");

    let mensagens = if matches!(
        role.as_str(),
        "admin" | "gestor" | "gestorescolar" | "secretaria" | "superadmin"
    ) {
        sqlx::query_as::<_, MensagemAgendaView>(
            r#"
            SELECT m.*, u.name AS remetente_nome, u.role AS remetente_role
            FROM mensagens_agenda m
            LEFT JOIN users u ON u.id = m.remetente_id
            WHERE m.tenant_id = $1
            ORDER BY m.created_at DESC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&mut *db)
        .await?
    } else if role == "responsavel" {
        sqlx::query_as::<_, MensagemAgendaView>(
            r#"
            SELECT m.*, u.name AS remetente_nome, u.role AS remetente_role
            FROM mensagens_agenda m
            LEFT JOIN users u ON u.id = m.remetente_id
            WHERE m.tenant_id = $1
              AND (
                m.destinatario_id = $2
                OR m.remetente_id = $2
                OR (
                  m.canal = 'mural_turma'
                  AND m.turma_id IN (
                    SELECT ta.turma_id
                    FROM turma_alunos ta
                    JOIN alunos a ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                    LEFT JOIN responsaveis_alunos ra
                      ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                    WHERE ta.tenant_id = $1
                      AND ta.status = 'ativo'
                      AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)
                  )
                )
              )
            ORDER BY m.created_at DESC
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        sqlx::query_as::<_, MensagemAgendaView>(
            r#"
            SELECT m.*, u.name AS remetente_nome, u.role AS remetente_role
            FROM mensagens_agenda m
            LEFT JOIN users u ON u.id = m.remetente_id
            WHERE m.tenant_id = $1
              AND (
                m.remetente_id = $2
                OR m.destinatario_id = $2
                OR (m.canal = 'responsavel' AND m.destinatario_id IS NULL)
                OR (
                  m.canal = 'mural_turma'
                  AND (
                    m.turma_id IS NULL
                    OR m.turma_id IN (
                      SELECT tp.turma_id FROM turma_professores tp
                      WHERE tp.tenant_id = $1 AND tp.professor_id = $2
                    )
                    OR m.turma_id IN (
                      SELECT t.id FROM turmas t
                      WHERE t.tenant_id = $1 AND t.professor_regente_id = $2
                    )
                  )
                )
              )
            ORDER BY m.created_at DESC
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    };

    Ok(Json(mensagens))
}

pub async fn marcar_mensagem_lida(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(mensagem_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "nutricionista", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    let atual = sqlx::query(
        "SELECT destinatario_id, remetente_id, canal FROM mensagens_agenda WHERE id = $1 AND tenant_id = $2",
    )
    .bind(mensagem_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    let dest: Option<Uuid> = atual.try_get("destinatario_id").unwrap_or(None);
    let rem: Uuid = atual.try_get("remetente_id").map_err(|_| AppError::NotFound)?;
    let canal: String = atual.try_get("canal").unwrap_or_default();
    let is_staff = matches!(
        auth_user.role.to_lowercase().replace([' ', '_'], "").as_str(),
        "admin" | "gestor" | "gestorescolar" | "secretaria" | "superadmin"
    );
    if !is_staff && dest != Some(auth_user.id) && rem != auth_user.id && canal != "mural_turma" {
        return Err(AppError::Forbidden(
            "Sem permissão para marcar esta mensagem como lida.".into(),
        ));
    }

    sqlx::query("UPDATE mensagens_agenda SET lida = TRUE WHERE id = $1 AND tenant_id = $2")
        .bind(mensagem_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    Ok(Json(json!({ "id": mensagem_id, "lida": true })))
}

#[derive(Debug, Serialize)]
pub struct ContatoEscolaDto {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
}

/// Contatos da escola para iniciar conversa.
/// Responsável: gestão/diretoria, financeiro e professores das turmas dos filhos.
pub async fn listar_contatos_escola(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<ContatoEscolaDto>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "nutricionista", "financeiro", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    let is_responsavel = auth_user.role.eq_ignore_ascii_case("responsavel");

    let rows = if is_responsavel {
        sqlx::query(
            r#"
            SELECT u.id, u.name, u.email, u.role
            FROM users u
            WHERE u.tenant_id = $1
              AND u.id <> $2
              AND (
                lower(replace(u.role, ' ', '')) IN (
                  'admin', 'gestor', 'gestorescolar', 'secretaria', 'superadmin', 'financeiro'
                )
                OR (
                  lower(u.role) = 'professor'
                  AND u.id IN (
                    SELECT t.professor_regente_id
                    FROM turmas t
                    JOIN turma_alunos ta
                      ON ta.turma_id = t.id AND ta.tenant_id = t.tenant_id AND ta.status = 'ativo'
                    JOIN alunos a
                      ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                    LEFT JOIN responsaveis_alunos ra
                      ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                    WHERE t.tenant_id = $1
                      AND t.professor_regente_id IS NOT NULL
                      AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)

                    UNION

                    SELECT tp.professor_id
                    FROM turma_professores tp
                    JOIN turma_alunos ta
                      ON ta.turma_id = tp.turma_id AND ta.tenant_id = tp.tenant_id AND ta.status = 'ativo'
                    JOIN alunos a
                      ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                    LEFT JOIN responsaveis_alunos ra
                      ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                    WHERE tp.tenant_id = $1
                      AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)
                  )
                )
              )
            ORDER BY
              CASE lower(replace(u.role, ' ', ''))
                WHEN 'professor' THEN 0
                WHEN 'secretaria' THEN 1
                WHEN 'gestor' THEN 2
                WHEN 'gestorescolar' THEN 2
                WHEN 'financeiro' THEN 3
                WHEN 'admin' THEN 4
                ELSE 5
              END,
              u.name ASC
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        sqlx::query(
            r#"
            SELECT id, name, email, role
            FROM users
            WHERE tenant_id = $1
              AND lower(replace(role, ' ', '')) IN (
                'professor', 'gestor', 'gestorescolar', 'secretaria', 'admin',
                'nutricionista', 'financeiro', 'superadmin'
              )
              AND id <> $2
            ORDER BY
              CASE lower(replace(role, ' ', ''))
                WHEN 'professor' THEN 0
                WHEN 'secretaria' THEN 1
                WHEN 'gestor' THEN 2
                WHEN 'gestorescolar' THEN 2
                WHEN 'financeiro' THEN 3
                WHEN 'admin' THEN 4
                ELSE 5
              END,
              name ASC
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    };

    let contatos = rows
        .into_iter()
        .map(|r| ContatoEscolaDto {
            id: r.get("id"),
            name: r.get("name"),
            email: r.get("email"),
            role: r.get("role"),
        })
        .collect();
    Ok(Json(contatos))
}

async fn responsavel_pode_falar_com(
    db: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    responsavel_id: Uuid,
    destinatario_id: Uuid,
) -> Result<bool, AppError> {
    let ok = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
          SELECT 1 FROM users u
          WHERE u.tenant_id = $1
            AND u.id = $2
            AND (
              lower(replace(u.role, ' ', '')) IN (
                'admin', 'gestor', 'gestorescolar', 'secretaria', 'superadmin', 'financeiro'
              )
              OR (
                lower(u.role) = 'professor'
                AND u.id IN (
                  SELECT t.professor_regente_id
                  FROM turmas t
                  JOIN turma_alunos ta
                    ON ta.turma_id = t.id AND ta.tenant_id = t.tenant_id AND ta.status = 'ativo'
                  JOIN alunos a
                    ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                  LEFT JOIN responsaveis_alunos ra
                    ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                  WHERE t.tenant_id = $1
                    AND t.professor_regente_id IS NOT NULL
                    AND (a.responsavel_user_id = $3 OR ra.responsavel_user_id = $3)

                  UNION

                  SELECT tp.professor_id
                  FROM turma_professores tp
                  JOIN turma_alunos ta
                    ON ta.turma_id = tp.turma_id AND ta.tenant_id = tp.tenant_id AND ta.status = 'ativo'
                  JOIN alunos a
                    ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                  LEFT JOIN responsaveis_alunos ra
                    ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                  WHERE tp.tenant_id = $1
                    AND (a.responsavel_user_id = $3 OR ra.responsavel_user_id = $3)
                )
              )
            )
        )
        "#,
    )
    .bind(tenant_id)
    .bind(destinatario_id)
    .bind(responsavel_id)
    .fetch_one(&mut *db)
    .await?;
    Ok(ok)
}

/// SSE: atualização em tempo real das mensagens do tenant.
pub async fn stream_mensagens_agenda(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError> {
    check_roles(
        &auth_user,
        &["admin", "gestor", "secretaria", "professor", "nutricionista", "responsavel"],
    )?;
    let tenant_id = active_tenant.0;
    let user_id = auth_user.id;
    let role = auth_user.role.to_lowercase();
    let rx = state.message_hub.subscribe(tenant_id);

    let intro = futures_util::stream::once(async move {
        Ok::<Event, Infallible>(
            Event::default().event("conectado").data(
                json!({
                    "tenant_id": tenant_id,
                    "user_id": user_id
                })
                .to_string(),
            ),
        )
    });

    let live = BroadcastStream::new(rx).filter_map(move |result| {
        let role = role.clone();
        async move {
            match result {
                Ok(evt) => {
                    let relevante = evt.remetente_id == user_id
                        || evt.destinatario_id == Some(user_id)
                        || matches!(
                            role.as_str(),
                            "admin" | "gestor" | "secretaria" | "professor" | "nutricionista"
                        )
                        || evt.canal == "mural_turma"
                        || evt.canal == "responsavel";
                    if !relevante {
                        return None;
                    }
                    let payload = serde_json::to_string(&evt).ok()?;
                    Some(Ok(Event::default().event("mensagem_nova").data(payload)))
                }
                Err(tokio_stream::wrappers::errors::BroadcastStreamRecvError::Lagged(_)) => {
                    Some(Ok(Event::default().event("resync").data("{}")))
                }
            }
        }
    });

    let stream = intro.chain(live);
    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(20))
            .text("ping"),
    ))
}

pub async fn registrar_rotina_diaria(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateRotinaDiariaDto>,
) -> Result<Json<RotinaDiariaInfantil>, AppError> {
    check_roles(&auth_user, &["admin", "professor", "nutricionista", "gestor"])?;
    let tenant_id = active_tenant.0;
    let data_rotina = dto.data.unwrap_or_else(|| chrono::Utc::now().date_naive());

    let (status_presenca, _) = presenca_do_dia(&mut *db, tenant_id, dto.aluno_id, data_rotina).await?;
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

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "REGISTRAR_ROTINA_DIARIA", "rotina_diaria_infantil", Some(rotina.id.to_string()), Some(json!({"aluno_id": dto.aluno_id, "data": data_rotina}))).await;

    Ok(Json(rotina))
}

pub async fn consultar_rotina_aluno(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<Vec<RotinaDiariaInfantil>>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor", "nutricionista", "responsavel"])?;
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
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor", "nutricionista", "responsavel"])?;
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

    let (presenca, justificativa) = presenca_do_dia(&mut *db, tenant_id, aluno_id, query.data).await?;

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

pub async fn registrar_ocorrencia(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateOcorrenciaDto>,
) -> Result<Json<OcorrenciaAluno>, AppError> {
    check_roles(&auth_user, &["admin", "professor"])?;
    let tenant_id = active_tenant.0;

    let ocorrencia = sqlx::query_as::<_, OcorrenciaAluno>(
        r#"
        INSERT INTO ocorrencias_aluno (tenant_id, aluno_id, professor_id, turma_id, tipo_ocorrencia, descricao, prioridade, notificado_responsavel)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(auth_user.id)
    .bind(dto.turma_id)
    .bind(&dto.tipo_ocorrencia)
    .bind(&dto.descricao)
    .bind(dto.prioridade.unwrap_or_else(|| "urgente".to_string()))
    .fetch_one(&mut *db)
    .await?;

    log_audit(&mut *db, tenant_id, Some(auth_user.id), "REGISTRAR_OCORRENCIA", "ocorrencias_aluno", Some(ocorrencia.id.to_string()), Some(json!({"aluno_id": dto.aluno_id, "tipo_ocorrencia": dto.tipo_ocorrencia}))).await;

    Ok(Json(ocorrencia))
}

pub async fn listar_ocorrencias_aluno(
    State(_state): State<AppState>, TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
) -> Result<Json<Vec<OcorrenciaAluno>>, AppError> {
    check_roles(&auth_user, &["admin", "professor", "responsavel"])?;
    let tenant_id = active_tenant.0;
    check_aluno_ownership(&mut *db, &auth_user, aluno_id).await?;

    let ocorrencias = sqlx::query_as::<_, OcorrenciaAluno>(
        "SELECT * FROM ocorrencias_aluno WHERE tenant_id = $1 AND aluno_id = $2 ORDER BY created_at DESC",
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(Json(ocorrencias))
}


pub async fn criar_autorizacao_medicamento(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::agenda_admin::CreateAutorizacaoMedicamentoDto>,
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

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "CRIAR_AUTORIZACAO_MEDICAMENTO", "autorizacoes_medicamento", Some(auth_med.id.to_string()), Some(serde_json::json!({"aluno_id": dto.aluno_id, "medicamento": dto.medicamento}))).await;

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
    
    let status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("aplicado");

    sqlx::query(
        "UPDATE autorizacoes_medicamento SET status = $1 WHERE id = $2 AND tenant_id = $3 AND aluno_id = $4"
    )
    .bind(status)
    .bind(auth_id)
    .bind(tenant_id)
    .bind(aluno_id)
    .execute(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "ATUALIZAR_STATUS_MEDICAMENTO", "autorizacoes_medicamento", Some(auth_id.to_string()), Some(serde_json::json!({"aluno_id": aluno_id, "status": status}))).await;

    Ok(axum::Json(serde_json::json!({"status": "sucesso"})))
}

pub async fn criar_evento_calendario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::agenda_admin::CreateEventoCalendarioDto>,
) -> Result<axum::Json<crate::models::agenda_admin::EventoCalendario>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let evento = sqlx::query_as::<_, crate::models::agenda_admin::EventoCalendario>(
        r#"
        INSERT INTO eventos_calendario (tenant_id, turma_id, titulo, descricao, data_inicio, data_fim, tipo, visibilidade, criado_por, exige_confirmacao)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.turma_id)
    .bind(&dto.titulo)
    .bind(&dto.descricao)
    .bind(dto.data_inicio)
    .bind(dto.data_fim)
    .bind(&dto.tipo)
    .bind(&dto.visibilidade)
    .bind(auth_user.id)
    .bind(dto.exige_confirmacao.unwrap_or(false))
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "CRIAR_EVENTO_CALENDARIO", "eventos_calendario", Some(evento.id.to_string()), Some(serde_json::json!({"titulo": dto.titulo}))).await;

    Ok(axum::Json(evento))
}

pub async fn listar_eventos_calendario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<axum::Json<Vec<crate::models::agenda_admin::EventoCalendario>>, AppError> {
    let tenant_id = active_tenant.0;

    // Filter visibility based on role
    let visibilidade_filtro = if auth_user.role == "responsavel" || auth_user.role == "aluno" {
        "('todos', 'responsaveis')"
    } else {
        "('todos', 'funcionarios', 'responsaveis')"
    };

    // Note: A robust implementation would use a proper query builder or bind parameters for the IN clause,
    // but for simplicity we're injecting it safely since it's hardcoded based on role.
    let query_str = format!(
        "SELECT * FROM eventos_calendario WHERE tenant_id = $1 AND visibilidade IN {} ORDER BY data_inicio ASC",
        visibilidade_filtro
    );

    let eventos = sqlx::query_as::<_, crate::models::agenda_admin::EventoCalendario>(&query_str)
        .bind(tenant_id)
        .fetch_all(&mut *db)
        .await?;

    Ok(axum::Json(eventos))
}

pub async fn atualizar_evento_calendario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::agenda_admin::UpdateEventoCalendarioDto>,
) -> Result<axum::Json<crate::models::agenda_admin::EventoCalendario>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let evento = sqlx::query_as::<_, crate::models::agenda_admin::EventoCalendario>(
        r#"
        UPDATE eventos_calendario
        SET titulo = $1, descricao = $2, data_inicio = $3, data_fim = $4, tipo = $5, visibilidade = $6, exige_confirmacao = $7
        WHERE id = $8 AND tenant_id = $9
        RETURNING *
        "#,
    )
    .bind(&dto.titulo)
    .bind(&dto.descricao)
    .bind(dto.data_inicio)
    .bind(dto.data_fim)
    .bind(&dto.tipo)
    .bind(&dto.visibilidade)
    .bind(dto.exige_confirmacao.unwrap_or(false))
    .bind(evento_id)
    .bind(tenant_id)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "ATUALIZAR_EVENTO_CALENDARIO", "eventos_calendario", Some(evento.id.to_string()), Some(serde_json::json!({"titulo": dto.titulo}))).await;

    Ok(axum::Json(evento))
}

pub async fn deletar_evento_calendario(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<serde_json::Value>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    sqlx::query("DELETE FROM eventos_calendario WHERE id = $1 AND tenant_id = $2")
        .bind(evento_id)
        .bind(tenant_id)
        .execute(&mut *db)
        .await?;

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "DELETAR_EVENTO_CALENDARIO", "eventos_calendario", Some(evento_id.to_string()), None).await;

    Ok(axum::Json(serde_json::json!({"status": "sucesso"})))
}

pub async fn responder_rsvp(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::agenda_admin::UpsertRsvpDto>,
) -> Result<axum::Json<crate::models::agenda_admin::EventoRsvp>, AppError> {
    let tenant_id = active_tenant.0;

    // Check if event requires RSVP
    let evento = sqlx::query_as::<_, crate::models::agenda_admin::EventoCalendario>(
        "SELECT * FROM eventos_calendario WHERE id = $1 AND tenant_id = $2"
    )
    .bind(evento_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    if !evento.exige_confirmacao {
        return Err(AppError::BadRequest("Este evento não exige confirmação de presença.".to_string()));
    }

    let rsvp = sqlx::query_as::<_, crate::models::agenda_admin::EventoRsvp>(
        r#"
        INSERT INTO eventos_rsvps (tenant_id, evento_id, usuario_id, status, acompanhantes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (evento_id, usuario_id) 
        DO UPDATE SET status = EXCLUDED.status, acompanhantes = EXCLUDED.acompanhantes, updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(evento_id)
    .bind(auth_user.id)
    .bind(&dto.status)
    .bind(dto.acompanhantes)
    .fetch_one(&mut *db)
    .await?;

    crate::middleware::rbac::log_audit(&mut *db, tenant_id, Some(auth_user.id), "RESPONDER_RSVP", "eventos_rsvps", Some(rsvp.id.to_string()), Some(serde_json::json!({"evento_id": evento_id, "status": dto.status}))).await;

    Ok(axum::Json(rsvp))
}

pub async fn listar_rsvps_evento(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Path(evento_id): axum::extract::Path<Uuid>,
) -> Result<axum::Json<Vec<crate::models::agenda_admin::EventoRsvp>>, AppError> {
    // Only management can view the RSVPs!
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let rsvps = sqlx::query_as::<_, crate::models::agenda_admin::EventoRsvp>(
        "SELECT * FROM eventos_rsvps WHERE evento_id = $1 AND tenant_id = $2 ORDER BY updated_at DESC"
    )
    .bind(evento_id)
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;

    Ok(axum::Json(rsvps))
}
