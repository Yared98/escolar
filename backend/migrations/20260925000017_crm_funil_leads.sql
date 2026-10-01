-- Migration: CRM Funil de Captação e Prospecção de Novos Alunos
-- Adiciona campos analíticos de conversão, canal de aquisição e histórico de interações

ALTER TABLE leads ADD COLUMN IF NOT EXISTS canal_aquisicao VARCHAR(100) DEFAULT 'site';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_leads_tenant_estagio ON leads(tenant_id, estagio_funil);

CREATE TABLE IF NOT EXISTS lead_interacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'ligacao', 'whatsapp', 'visita', 'email', 'mudanca_estagio'
    descricao TEXT NOT NULL,
    usuario_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_interacoes_lead ON lead_interacoes(tenant_id, lead_id);
