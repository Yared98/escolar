-- Migration: Campos para controle da renovação automática de certificado mTLS do Itaú
ALTER TABLE tenant_itau_config
    ADD COLUMN IF NOT EXISTS renovacao_ultima_tentativa_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS renovacao_ultimo_erro TEXT,
    ADD COLUMN IF NOT EXISTS renovacao_alerta_enviado_em TIMESTAMPTZ;
