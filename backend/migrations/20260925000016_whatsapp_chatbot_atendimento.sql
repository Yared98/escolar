-- Migration: WhatsApp Business API & Chatbot Inteligente com Transbordo
-- Rastreamento de mensagens, protocolos de atendimento e transbordo humanizado

CREATE TABLE IF NOT EXISTS atendimento_protocolos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    protocolo VARCHAR(50) NOT NULL UNIQUE,
    telefone_contato VARCHAR(50) NOT NULL,
    aluno_id UUID REFERENCES alunos(id) ON DELETE SET NULL,
    assunto VARCHAR(100) NOT NULL DEFAULT 'autoatendimento',
    status VARCHAR(50) NOT NULL DEFAULT 'resolvido_bot', -- 'resolvido_bot', 'aguardando_atendente', 'em_atendimento', 'finalizado'
    setor_transbordo VARCHAR(50), -- 'secretaria', 'financeiro', 'pedagogico'
    ultima_mensagem TEXT,
    resposta_enviada TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(255),
    telefone_origem VARCHAR(50) NOT NULL,
    conteudo_texto TEXT NOT NULL,
    resposta_gerada TEXT NOT NULL,
    tipo_interacao VARCHAR(50) NOT NULL, -- 'pix_2a_via', 'duvida_faq', 'transbordo_humano', 'saudacao'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protocolos_telefone ON atendimento_protocolos(telefone_contato);
CREATE INDEX IF NOT EXISTS idx_protocolos_status ON atendimento_protocolos(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_telefone ON whatsapp_webhook_logs(telefone_origem);
