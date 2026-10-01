-- Migration: Central de Notificações Unificada & Logs de Disparos Multicanal (WhatsApp, Push, Email)

CREATE TABLE IF NOT EXISTS notificacoes_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    destinatario_id UUID REFERENCES users(id),
    aluno_id UUID REFERENCES alunos(id),
    modulo VARCHAR(50) NOT NULL, -- 'financeiro', 'ocorrencia_urgente', 'rotina_infantil', 'nutricao', 'agenda'
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    prioridade VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'normal', 'alta', 'urgente'
    lida BOOLEAN NOT NULL DEFAULT false,
    canal_disparo VARCHAR(50) NOT NULL DEFAULT 'push_pwa', -- 'whatsapp_api', 'email_smtp', 'push_pwa'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_tenant_lida ON notificacoes_sistema(tenant_id, lida);

CREATE TABLE IF NOT EXISTS notificacoes_disparos_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    notificacao_id UUID REFERENCES notificacoes_sistema(id) ON DELETE CASCADE,
    canal VARCHAR(50) NOT NULL, -- 'whatsapp_business_api', 'email_smtp', 'web_push_pwa'
    destino VARCHAR(255) NOT NULL, -- telefone WhatsApp ou e-mail
    status_envio VARCHAR(50) NOT NULL DEFAULT 'enviado', -- 'processando', 'enviado', 'entregue', 'lido', 'falhou'
    resposta_webhook JSONB DEFAULT '{}'::jsonb,
    disparado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
