use super::*;

pub async fn validar_acesso_perimetral(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<ValidarAcessoPerimetralDto>,
) -> Result<Json<ValidarAcessoPerimetralResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria", "professor"])?;
    let tenant_id = active_tenant.0;

    let direcao = dto.direcao.unwrap_or_else(|| "entrada".to_string());
    let ponto_acesso = dto
        .ponto_acesso
        .unwrap_or_else(|| "Portaria Principal".to_string());

    // 1. Identificação do Aluno via credencial cadastrada ou CPF / UUID fallback
    let credencial_opt = sqlx::query_as::<_, (Uuid, bool)>(
        "SELECT aluno_id, ativo FROM perimetro_credenciais WHERE tenant_id = $1 AND codigo = $2",
    )
    .bind(tenant_id)
    .bind(&dto.codigo)
    .fetch_optional(&mut *db)
    .await?;

    let aluno_opt = if let Some((aluno_id_cred, ativo)) = credencial_opt {
        if !ativo {
            sqlx::query(
                r#"
                INSERT INTO perimetro_acessos_logs (
                    tenant_id, aluno_id, tipo_identificador, codigo, direcao, acesso_permitido, motivo_bloqueio, ponto_acesso
                )
                VALUES ($1, $2, $3, $4, $5, false, 'Credencial perimetral desativada ou revogada', $6)
                "#,
            )
            .bind(tenant_id)
            .bind(aluno_id_cred)
            .bind(&dto.tipo_identificador)
            .bind(&dto.codigo)
            .bind(&direcao)
            .bind(&ponto_acesso)
            .execute(&mut *db)
            .await?;

            return Ok(Json(ValidarAcessoPerimetralResponse {
                acesso_permitido: false,
                nome_aluno: None,
                turma: None,
                motivo_bloqueio: Some("Credencial perimetral desativada ou revogada.".to_string()),
            }));
        }

        sqlx::query_as::<_, (Uuid, String, String)>(
            "SELECT id, nome, status FROM alunos WHERE id = $1 AND tenant_id = $2",
        )
        .bind(aluno_id_cred)
        .bind(tenant_id)
        .fetch_optional(&mut *db)
        .await?
    } else {
        sqlx::query_as::<_, (Uuid, String, String)>(
            "SELECT id, nome, status FROM alunos WHERE tenant_id = $1 AND (cpf = $2 OR id::text = $2) LIMIT 1",
        )
        .bind(tenant_id)
        .bind(&dto.codigo)
        .fetch_optional(&mut *db)
        .await?
    };

    let (aluno_id, aluno_nome, _aluno_status) = match aluno_opt {
        Some((id, nome, status)) if status == "ativo" => (id, nome, status),
        Some((id, nome, _status)) => {
            sqlx::query(
                r#"
                INSERT INTO perimetro_acessos_logs (
                    tenant_id, aluno_id, tipo_identificador, codigo, direcao, acesso_permitido, motivo_bloqueio, ponto_acesso
                )
                VALUES ($1, $2, $3, $4, $5, false, 'Aluno com matrícula inativa ou trancada', $6)
                "#,
            )
            .bind(tenant_id)
            .bind(id)
            .bind(&dto.tipo_identificador)
            .bind(&dto.codigo)
            .bind(&direcao)
            .bind(&ponto_acesso)
            .execute(&mut *db)
            .await?;

            return Ok(Json(ValidarAcessoPerimetralResponse {
                acesso_permitido: false,
                nome_aluno: Some(nome),
                turma: None,
                motivo_bloqueio: Some("Matrícula inativa ou trancada.".to_string()),
            }));
        }
        None => {
            sqlx::query(
                r#"
                INSERT INTO perimetro_acessos_logs (
                    tenant_id, aluno_id, tipo_identificador, codigo, direcao, acesso_permitido, motivo_bloqueio, ponto_acesso
                )
                VALUES ($1, NULL, $2, $3, $4, false, 'Credencial não identificada no perímetro escolar.', $5)
                "#,
            )
            .bind(tenant_id)
            .bind(&dto.tipo_identificador)
            .bind(&dto.codigo)
            .bind(&direcao)
            .bind(&ponto_acesso)
            .execute(&mut *db)
            .await?;

            return Ok(Json(ValidarAcessoPerimetralResponse {
                acesso_permitido: false,
                nome_aluno: None,
                turma: None,
                motivo_bloqueio: Some(
                    "Credencial não identificada no perímetro escolar.".to_string(),
                ),
            }));
        }
    };

    // 2. Busca da Turma atual do estudante
    let turma_nome = sqlx::query_scalar::<_, String>(
        r#"
        SELECT t.nome 
        FROM turmas t
        JOIN turma_alunos ta ON t.id = ta.turma_id
        WHERE ta.tenant_id = $1 AND ta.aluno_id = $2 AND ta.status = 'ativo'
        ORDER BY t.ano_letivo DESC
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_optional(&mut *db)
    .await?
    .unwrap_or_else(|| "1º Ano A".to_string());

    // 3. Registro indelével da passagem em `perimetro_acessos_logs`
    sqlx::query(
        r#"
        INSERT INTO perimetro_acessos_logs (
            tenant_id, aluno_id, tipo_identificador, codigo, direcao, acesso_permitido, motivo_bloqueio, ponto_acesso
        )
        VALUES ($1, $2, $3, $4, $5, true, NULL, $6)
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .bind(&dto.tipo_identificador)
    .bind(&dto.codigo)
    .bind(&direcao)
    .bind(&ponto_acesso)
    .execute(&mut *db)
    .await?;

    // 4. Notificação Instantânea aos Responsáveis Legais (Push PWA / Agenda)
    let responsaveis = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT DISTINCT responsavel_user_id 
        FROM responsaveis_alunos 
        WHERE tenant_id = $1 AND aluno_id = $2
        UNION
        SELECT responsavel_user_id 
        FROM alunos 
        WHERE tenant_id = $1 AND id = $2 AND responsavel_user_id IS NOT NULL
        "#,
    )
    .bind(tenant_id)
    .bind(aluno_id)
    .fetch_all(&mut *db)
    .await?;

    let hora_formatada = chrono::Local::now().format("%H:%M").to_string();
    let direcao_label = if direcao == "saida" {
        "saída da escola"
    } else {
        "entrada na escola"
    };
    let titulo = format!("Controle de Portaria: {}", aluno_nome);
    let mensagem = format!(
        "Passagem confirmada: {} registrou {} às {} no ponto '{}'.",
        aluno_nome, direcao_label, hora_formatada, ponto_acesso
    );

    for resp_id in responsaveis {
        let _ = sqlx::query(
            r#"
            INSERT INTO notificacoes_sistema (
                tenant_id, destinatario_id, aluno_id, modulo, titulo, mensagem, prioridade, lida, canal_disparo
            )
            VALUES ($1, $2, $3, 'controle_perimetral', $4, $5, 'alta', false, 'push_pwa')
            "#,
        )
        .bind(tenant_id)
        .bind(resp_id)
        .bind(aluno_id)
        .bind(&titulo)
        .bind(&mensagem)
        .execute(&mut *db)
        .await;
    }

    // 5. Trilha de Auditoria Indelével
    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "ACESSO_PERIMETRAL",
        "perimetro_acessos_logs",
        Some(aluno_id.to_string()),
        Some(json!({
            "aluno_id": aluno_id,
            "nome_aluno": aluno_nome,
            "turma": turma_nome,
            "codigo": dto.codigo,
            "direcao": direcao,
            "ponto_acesso": ponto_acesso,
            "acesso_permitido": true
        })),
    )
    .await;

    Ok(Json(ValidarAcessoPerimetralResponse {
        acesso_permitido: true,
        nome_aluno: Some(aluno_nome),
        turma: Some(turma_nome),
        motivo_bloqueio: None,
    }))
}

pub async fn cadastrar_credencial_perimetral(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CadastrarCredencialPerimetralDto>,
) -> Result<Json<PerimetroCredencial>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;
    let tipo = dto
        .tipo_identificador
        .unwrap_or_else(|| "rfid_ou_qrcode".to_string());

    let credencial = sqlx::query_as::<_, PerimetroCredencial>(
        r#"
        INSERT INTO perimetro_credenciais (tenant_id, aluno_id, tipo_identificador, codigo, ativo)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (tenant_id, codigo) DO UPDATE SET aluno_id = $2, tipo_identificador = $3, ativo = true
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&tipo)
    .bind(&dto.codigo)
    .fetch_one(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CADASTRAR_CREDENCIAL_PERIMETRO",
        "perimetro_credenciais",
        Some(credencial.id.to_string()),
        Some(json!({ "aluno_id": dto.aluno_id, "codigo": dto.codigo })),
    )
    .await;

    Ok(Json(credencial))
}

// ==========================================
// 5. MOTOR IA ANTI-EVASÃO ESCOLAR
// ==========================================
