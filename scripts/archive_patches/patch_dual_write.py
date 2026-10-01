import os

with open('backend/src/handlers/financeiro.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to completely rewrite the `gerar_fatura` function.
# Let's extract the whole function.
start_str = "pub async fn gerar_fatura("
end_str = "Ok(axum::Json(fatura))\n}\n"

start_idx = content.find(start_str)
end_idx = content.find(end_str) + len(end_str)

if start_idx != -1 and end_idx != -1:
    new_func = """pub async fn gerar_fatura(
    State(state): State<AppState>,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    axum::extract::Json(dto): axum::extract::Json<crate::models::financeiro::CreateFaturaDto>,
) -> Result<axum::Json<crate::models::financeiro::Fatura>, AppError> {
    crate::middleware::rbac::check_roles(&auth_user, &["admin", "gestor", "financeiro"])?;
    let tenant_id = active_tenant.0;

    let tenant_nome = "Escola Infantil (Tenant)";
    let mut db = state.pool.acquire().await?;

    // Pré-cadastro no Banco (Saga Pattern: Prevents Dual-Write bugs)
    let mut fatura = sqlx::query_as::<_, crate::models::financeiro::Fatura>(
        r#"
        INSERT INTO faturas (tenant_id, aluno_id, descricao, valor, data_vencimento, metodo_pagamento, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'processando_banco')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.descricao)
    .bind(dto.valor)
    .bind(dto.data_vencimento)
    .bind(&dto.metodo_pagamento)
    .fetch_one(&mut *db)
    .await?;

    let txid = format!("fatura_{}", fatura.id.simple());

    // ==== INTEGRAÇÃO BANCÁRIA AGNÓSTICA ====
    if dto.metodo_pagamento == "boleto" || dto.metodo_pagamento == "pix" {
        // Tenta buscar a integração ativa da escola
        let creds = sqlx::query_as::<_, (String, String, String)>("SELECT gateway_name, client_id, client_secret FROM tenant_bank_integrations WHERE tenant_id = $1 AND is_active = true").bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;
        
        if let Some((gateway, client_id, client_secret)) = creds {
            if gateway == "cora" {
                let cora_client = crate::services::cora_api::CoraClient::new();
                
                // Trata o erro e faz rollback lógico
                let token_res = cora_client.get_token(&client_id, &client_secret).await;
                if let Err(e) = token_res {
                    let _ = sqlx::query("UPDATE faturas SET status = 'erro_banco' WHERE id = $1").bind(fatura.id).execute(&mut *db).await;
                    return Err(e);
                }
                let token = token_res.unwrap();
                
                let req = crate::services::cora_api::CoraCreateInvoiceRequest {
                    request_id: txid.clone(),
                    name: dto.descricao.clone(),
                    description: format!("Mensalidade Escolar - {}", tenant_nome),
                    customer: crate::services::cora_api::CoraCustomer {
                        name: "Responsavel Financeiro".to_string(), 
                        email: "responsavel@email.com".to_string(),
                        document: "12345678909".to_string(),
                    },
                    payment_terms: vec![crate::services::cora_api::CoraBankSlip {
                        payment_type: "BOLETO".to_string(), 
                        amount: (dto.valor * 100.0) as i32,
                        due_at: dto.data_vencimento.format("%Y-%m-%d").to_string(),
                        description: dto.descricao.clone(),
                        discount: None,
                        fine: Some(crate::services::cora_api::CoraBankSlipOption { name: "MULTA".to_string(), value: 200 }),
                        interest: Some(crate::services::cora_api::CoraBankSlipOption { name: "JUROS".to_string(), value: 100 }),
                    }],
                };

                let cora_resp = cora_client.create_invoice(&token, req).await;
                match cora_resp {
                    Ok(resp) => {
                        // Sucesso: Atualiza fatura para pendente com os dados do Gateway
                        fatura = sqlx::query_as::<_, crate::models::financeiro::Fatura>(
                            "UPDATE faturas SET status = 'pendente', gateway_invoice_id = $1, gateway_invoice_url = $2, gateway_name = $3 WHERE id = $4 RETURNING *"
                        )
                        .bind(&resp.id)
                        .bind(&resp.url)
                        .bind(&gateway)
                        .bind(fatura.id)
                        .fetch_one(&mut *db)
                        .await?;
                    },
                    Err(e) => {
                        // Falha: Falhou em criar na Cora, marca como erro_banco
                        let _ = sqlx::query("UPDATE faturas SET status = 'erro_banco' WHERE id = $1").bind(fatura.id).execute(&mut *db).await;
                        return Err(e);
                    }
                }
            } else if gateway == "asaas" {
                let _ = sqlx::query("UPDATE faturas SET status = 'erro_banco' WHERE id = $1").bind(fatura.id).execute(&mut *db).await;
                return Err(AppError::BadRequest("Integração com Asaas em desenvolvimento.".to_string()));
            }
        } else {
            let _ = sqlx::query("UPDATE faturas SET status = 'erro_banco' WHERE id = $1").bind(fatura.id).execute(&mut *db).await;
            return Err(AppError::BadRequest("A escola não possui um banco configurado e ativo para emissão de boletos/pix.".to_string()));
        }
    } else {
        // Se for dinheiro/cartão interno, só marca como pendente direto
        fatura = sqlx::query_as::<_, crate::models::financeiro::Fatura>(
            "UPDATE faturas SET status = 'pendente' WHERE id = $1 RETURNING *"
        )
        .bind(fatura.id)
        .fetch_one(&mut *db)
        .await?;
    }
    // ==== FIM INTEGRAÇÃO ====

    crate::middleware::rbac::log_audit(&state.pool, tenant_id, Some(auth_user.id), "GERAR_FATURA", "faturas", Some(fatura.id.to_string()), Some(serde_json::json!({"valor": dto.valor}))).await;

    Ok(axum::Json(fatura))
}
"""
    content = content[:start_idx] + new_func + content[end_idx:]

    with open('backend/src/handlers/financeiro.rs', 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Function not found!")
