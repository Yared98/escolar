import os

f1 = 'src/handlers/agenda_admin.rs'
with open(f1, 'r', encoding='utf-8') as file:
    content = file.read()
content = content.replace('"cargo": dto.cargo, "status": dto.status', '"cargo": &funcionario.cargo, "status": &funcionario.status')
content = content.replace('"razao_social": dto.razao_social, "cnpj": dto.cnpj', '"razao_social": &fornecedor.razao_social, "cnpj": &fornecedor.cnpj')
with open(f1, 'w', encoding='utf-8') as file:
    file.write(content)

f2 = 'src/handlers/financeiro.rs'
with open(f2, 'r', encoding='utf-8') as file:
    content = file.read()
content = content.replace('log_audit(&state.pool, tenant_id, Some(auth_user.id), "ATUALIZAR_FATURA", "faturas", Some(fatura.id.to_string()), Some(json!({"valor": dto.valor, "status": dto.status}))).await;',
                          'log_audit(&state.pool, tenant_id, Some(auth_user.id), "ATUALIZAR_FATURA", "faturas", Some(fatura.id.to_string()), Some(json!({"valor": &fatura.valor, "status": &fatura.status}))).await;')

content = content.replace('log_audit(&state.pool, tenant_id, Some(auth_user.id), "ATUALIZAR_DESPESA", "despesas", Some(despesa.id.to_string()), Some(json!({"valor": dto.valor, "status": dto.status}))).await;',
                          'log_audit(&state.pool, tenant_id, Some(auth_user.id), "ATUALIZAR_DESPESA", "despesas", Some(despesa.id.to_string()), Some(json!({"valor": &despesa.valor, "status": &despesa.status}))).await;')

with open(f2, 'w', encoding='utf-8') as file:
    file.write(content)
