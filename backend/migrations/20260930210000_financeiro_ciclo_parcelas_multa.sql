-- Ciclo financeiro escolar: vínculo com contrato, parcelas, desconto, multa e juros

ALTER TABLE faturas
    ADD COLUMN IF NOT EXISTS contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS parcela_numero INT,
    ADD COLUMN IF NOT EXISTS parcela_total INT,
    ADD COLUMN IF NOT EXISTS valor_original DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS desconto_percentual DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS multa_percentual DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    ADD COLUMN IF NOT EXISTS juros_mora_mes_percentual DOUBLE PRECISION NOT NULL DEFAULT 1.0;

UPDATE faturas
SET valor_original = valor
WHERE valor_original IS NULL;

CREATE INDEX IF NOT EXISTS idx_faturas_contrato ON faturas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_faturas_aluno_status_venc ON faturas(tenant_id, aluno_id, status, data_vencimento);
