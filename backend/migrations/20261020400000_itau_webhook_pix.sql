-- Migration: Coluna webhook_pix_registrado_em em tenant_itau_config

ALTER TABLE tenant_itau_config
    ADD COLUMN IF NOT EXISTS webhook_pix_registrado_em TIMESTAMPTZ;
