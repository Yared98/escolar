-- Migration: Cora integração direta (Stage/produção) e campos de cobrança

ALTER TABLE faturas
    ADD COLUMN IF NOT EXISTS gateway_pix_code TEXT,
    ADD COLUMN IF NOT EXISTS gateway_digitable_line TEXT;
