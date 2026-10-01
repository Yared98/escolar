-- Migration: Adicionar coluna mensagem_corpo e indices para rastreabilidade de disparos da regua

ALTER TABLE regua_cobranca_logs ADD COLUMN IF NOT EXISTS mensagem_corpo TEXT;
CREATE INDEX IF NOT EXISTS idx_regua_fatura ON regua_cobranca_logs(tenant_id, fatura_id);
CREATE INDEX IF NOT EXISTS idx_regua_tenant_tipo ON regua_cobranca_logs(tenant_id, tipo_evento, canal);
