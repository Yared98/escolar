-- Migration: Indice de Performance para Analise Preditiva de Evasao Escolar
CREATE INDEX IF NOT EXISTS idx_evasao_score ON analise_evasao_logs(tenant_id, score_risco_evasao DESC);
