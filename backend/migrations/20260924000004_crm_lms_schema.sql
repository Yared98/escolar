-- Migration: CRM, Atendimento WhatsApp & LMS Schema

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(50) NOT NULL,
    estagio_funil VARCHAR(50) NOT NULL DEFAULT 'novo_lead', -- 'visita_agendada', 'proposta_enviada', 'matriculado'
    custo_aquisicao DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lms_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lms_type VARCHAR(50) NOT NULL DEFAULT 'moodle', -- 'moodle', 'canvas', 'google_classroom'
    client_id VARCHAR(255) NOT NULL,
    platform_url VARCHAR(255) NOT NULL,
    lti_version VARCHAR(20) NOT NULL DEFAULT '1.3',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
