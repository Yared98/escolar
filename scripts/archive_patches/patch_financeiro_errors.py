import os

with open('backend/src/handlers/financeiro.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the block with the robust error checking block
old_generic_logic = """    // ==== INTEGRAÇÃO BANCÁRIA AGNÓSTICA ====
    let mut gateway_id: Option<String> = None;
    let mut gateway_url: Option<String> = None;
    let mut active_gateway: Option<String> = None;

    if dto.metodo_pagamento == "boleto" || dto.metodo_pagamento == "pix" {
        // Tenta buscar a integração ativa da escola
        let creds = sqlx::query_as::<_, (String, String, String)>("SELECT gateway_name, client_id, client_secret FROM tenant_bank_integrations WHERE tenant_id = $1 AND is_active = true").bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;
        
        if let Some((gateway, client_id, client_secret)) = creds {
            active_gateway = Some(gateway.clone());
            
            if gateway == "cora" {
                let cora_client = crate::services::cora_api::CoraClient::new();
                if let Ok(token) = cora_client.get_token(&client_id, &client_secret).await {
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

                    if let Ok(cora_resp) = cora_client.create_invoice(&token, req).await {
                        gateway_id = Some(cora_resp.id);
                        gateway_url = Some(cora_resp.url);
                    }
                }
            } else if gateway == "asaas" {
                // Placeholder para Asaas
            }
        }
    }
    // ==== FIM INTEGRAÇÃO ===="""

new_generic_logic = """    // ==== INTEGRAÇÃO BANCÁRIA AGNÓSTICA ====
    let mut gateway_id: Option<String> = None;
    let mut gateway_url: Option<String> = None;
    let mut active_gateway: Option<String> = None;

    if dto.metodo_pagamento == "boleto" || dto.metodo_pagamento == "pix" {
        // Tenta buscar a integração ativa da escola
        let creds = sqlx::query_as::<_, (String, String, String)>("SELECT gateway_name, client_id, client_secret FROM tenant_bank_integrations WHERE tenant_id = $1 AND is_active = true").bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;
        
        if let Some((gateway, client_id, client_secret)) = creds {
            active_gateway = Some(gateway.clone());
            
            if gateway == "cora" {
                let cora_client = crate::services::cora_api::CoraClient::new();
                let token = cora_client.get_token(&client_id, &client_secret).await?;
                
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

                let cora_resp = cora_client.create_invoice(&token, req).await?;
                gateway_id = Some(cora_resp.id);
                gateway_url = Some(cora_resp.url);
            } else if gateway == "asaas" {
                // Placeholder para Asaas
                return Err(AppError::BadRequest("Integração com Asaas em desenvolvimento.".to_string()));
            }
        } else {
            return Err(AppError::BadRequest("A escola não possui um banco configurado e ativo para emissão de boletos/pix.".to_string()));
        }
    }
    // ==== FIM INTEGRAÇÃO ===="""

# Need to handle encoding errors so doing a simple string replace
if old_generic_logic in content:
    content = content.replace(old_generic_logic, new_generic_logic)
else:
    # If the precise block is not found, we use a more robust way
    print("Exact block not found! Re-evaluating...")
    start_idx = content.find('// ==== INTEGRAÇÃO BANCÁRIA AGNÓSTICA ====')
    end_idx = content.find('// ==== FIM INTEGRAÇÃO ====') + len('// ==== FIM INTEGRAÇÃO ====')
    if start_idx != -1 and end_idx != -1:
        content = content[:start_idx] + new_generic_logic + content[end_idx:]

with open('backend/src/handlers/financeiro.rs', 'w', encoding='utf-8') as f:
    f.write(content)

