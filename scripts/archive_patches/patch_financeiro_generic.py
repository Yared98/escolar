import os

with open('backend/src/handlers/financeiro.rs', 'r', encoding='utf-8') as f:
    content = f.read()

old_cora_logic = """    // ==== INTEGRAÇÃO CORA BANK ====
    let mut cora_id: Option<String> = None;
    let mut cora_url: Option<String> = None;

    if dto.metodo_pagamento == "boleto" || dto.metodo_pagamento == "pix" {
        // Tenta buscar as credenciais da escola no banco
        let creds = sqlx::query_as::<_, (String, String)>("SELECT client_id, client_secret FROM tenant_cora_config WHERE tenant_id = $1").bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;
        
        if let Some((client_id, client_secret)) = creds {
            let cora_client = crate::services::cora_api::CoraClient::new();
            if let Ok(token) = cora_client.get_token(&client_id, &client_secret).await {
                
                let req = crate::services::cora_api::CoraCreateInvoiceRequest {
                    request_id: txid.clone(),
                    name: dto.descricao.clone(),
                    description: format!("Mensalidade Escolar - {}", tenant_nome),
                    customer: crate::services::cora_api::CoraCustomer {
                        name: "Responsavel Financeiro".to_string(), // Na vida real, pegaria do banco
                        email: "responsavel@email.com".to_string(),
                        document: "12345678909".to_string(),
                    },
                    payment_terms: vec![crate::services::cora_api::CoraBankSlip {
                        payment_type: "BOLETO".to_string(), // O Híbrido atende Pix também
                        amount: (dto.valor * 100.0) as i32, // Cora usa centavos
                        due_at: dto.data_vencimento.format("%Y-%m-%d").to_string(),
                        description: dto.descricao.clone(),
                        discount: None,
                        fine: Some(crate::services::cora_api::CoraBankSlipOption {
                            name: "MULTA".to_string(),
                            value: 200, // 2% 
                        }),
                        interest: Some(crate::services::cora_api::CoraBankSlipOption {
                            name: "JUROS".to_string(),
                            value: 100, // 1% a.m
                        }),
                    }],
                };

                if let Ok(cora_resp) = cora_client.create_invoice(&token, req).await {
                    cora_id = Some(cora_resp.id);
                    cora_url = Some(cora_resp.url);
                }
            }
        }
    }
    // ==== FIM INTEGRAÇÃO CORA ===="""

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

content = content.replace(old_cora_logic, new_generic_logic)

old_insert = """        INSERT INTO faturas (tenant_id, aluno_id, descricao, valor, data_vencimento, metodo_pagamento, status, linha_digitavel, qr_code_pix, cora_invoice_id, cora_invoice_url)
        VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7, $8, $9, $10)"""
new_insert = """        INSERT INTO faturas (tenant_id, aluno_id, descricao, valor, data_vencimento, metodo_pagamento, status, linha_digitavel, qr_code_pix, gateway_invoice_id, gateway_invoice_url, gateway_name)
        VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7, $8, $9, $10, $11)"""

content = content.replace(old_insert, new_insert)
content = content.replace('.bind(cora_id)\n    .bind(cora_url)', '.bind(gateway_id)\n    .bind(gateway_url)\n    .bind(active_gateway)')

with open('backend/src/handlers/financeiro.rs', 'w', encoding='utf-8') as f:
    f.write(content)
