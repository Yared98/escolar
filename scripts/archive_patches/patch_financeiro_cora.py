import os

with open('backend/src/handlers/financeiro.rs', 'r', encoding='utf-8') as f:
    content = f.read()

new_logic = """
    // ==== INTEGRAÇÃO CORA BANK ====
    let mut cora_id: Option<String> = None;
    let mut cora_url: Option<String> = None;

    if dto.metodo_pagamento == "boleto" || dto.metodo_pagamento == "pix" {
        // Tenta buscar as credenciais da escola no banco
        let creds = sqlx::query!("SELECT client_id, client_secret FROM tenant_cora_config WHERE tenant_id = $1", tenant_id)
            .fetch_optional(&mut *db)
            .await?;
        
        if let Some(config) = creds {
            let cora_client = crate::services::cora_api::CoraClient::new();
            if let Ok(token) = cora_client.get_token(&config.client_id, &config.client_secret).await {
                
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
    // ==== FIM INTEGRAÇÃO CORA ====

    let fatura = sqlx::query_as::<_, Fatura>(
        r#"
        INSERT INTO faturas (tenant_id, aluno_id, descricao, valor, data_vencimento, metodo_pagamento, status, linha_digitavel, qr_code_pix, cora_invoice_id, cora_invoice_url)
        VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.descricao)
    .bind(dto.valor)
    .bind(dto.data_vencimento)
    .bind(&dto.metodo_pagamento)
    .bind(linha_digitavel)
    .bind(qr_code_pix)
    .bind(cora_id)
    .bind(cora_url)
    .fetch_one(&mut *db)
    .await?;
"""

old_logic = """
    let fatura = sqlx::query_as::<_, Fatura>(
        r#"
        INSERT INTO faturas (tenant_id, aluno_id, descricao, valor, data_vencimento, metodo_pagamento, status, linha_digitavel, qr_code_pix)
        VALUES ($1, $2, $3, $4, $5, $6, 'pendente', $7, $8)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(dto.aluno_id)
    .bind(&dto.descricao)
    .bind(dto.valor)
    .bind(dto.data_vencimento)
    .bind(&dto.metodo_pagamento)
    .bind(linha_digitavel)
    .bind(qr_code_pix)
    .fetch_one(&mut *db)
    .await?;
"""

content = content.replace(old_logic, new_logic)

with open('backend/src/handlers/financeiro.rs', 'w', encoding='utf-8') as f:
    f.write(content)
