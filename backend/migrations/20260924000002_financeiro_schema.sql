-- Migration: Financeiro Schema (Faturas, Pagamentos, Regua, Conciliacao)

CREATE TABLE IF NOT EXISTS faturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    valor DOUBLE PRECISION NOT NULL,
    data_vencimento DATE NOT NULL,
    metodo_pagamento VARCHAR(50) NOT NULL DEFAULT 'pix', -- 'pix', 'boleto', 'cartao_recorrente'
    status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- 'pendente', 'pago', 'atrasado', 'cancelado'
    linha_digitavel VARCHAR(255),
    qr_code_pix TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faturas_tenant_status ON faturas(tenant_id, status);

CREATE TABLE IF NOT EXISTS regua_cobranca_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fatura_id UUID NOT NULL REFERENCES faturas(id) ON DELETE CASCADE,
    canal VARCHAR(50) NOT NULL, -- 'whatsapp', 'email', 'sms'
    tipo_evento VARCHAR(50) NOT NULL, -- 'lembrete_preventivo', 'aviso_vencimento', 'cobranca_ativa'
    status_envio VARCHAR(50) NOT NULL DEFAULT 'enviado',
    enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
