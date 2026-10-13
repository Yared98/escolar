use super::contatos::responsavel_pode_falar_com;
use super::{
    check_roles, json, log_audit, ActiveTenant, AppError, AppState, AuthUser,
    CreateMensagemAgendaDto, Extension, Json, MensagemAgenda, MensagemAgendaView, Path, Row, State,
    TenantDb, Uuid, Value,
};

pub async fn enviar_mensagem_agenda(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateMensagemAgendaDto>,
) -> Result<Json<MensagemAgenda>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "nutricionista",
            "responsavel",
        ],
    )?;
    let tenant_id = active_tenant.0;
    let is_responsavel = auth_user.role.eq_ignore_ascii_case("responsavel");

    if dto.titulo.trim().is_empty() || dto.conteudo.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Informe título e conteúdo do comunicado.".into(),
        ));
    }
    if dto.canal.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Informe o canal do comunicado.".into(),
        ));
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

        let original_remetente: Uuid = original
            .try_get("remetente_id")
            .map_err(|_| AppError::NotFound)?;
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
                && !responsavel_pode_falar_com(&mut db, tenant_id, auth_user.id, dest).await?
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

    state
        .message_hub
        .publish(crate::realtime::MensagemRealtimeEvent {
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
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<MensagemAgendaView>>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "nutricionista",
            "responsavel",
        ],
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
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "nutricionista",
            "responsavel",
        ],
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
    let rem: Uuid = atual
        .try_get("remetente_id")
        .map_err(|_| AppError::NotFound)?;
    let canal: String = atual.try_get("canal").unwrap_or_default();
    let is_staff = matches!(
        auth_user
            .role
            .to_lowercase()
            .replace([' ', '_'], "")
            .as_str(),
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
