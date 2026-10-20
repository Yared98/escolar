-- Migration: Campos para emissão de Bolecode Itaú
-- faturas: codigo_barras, nosso_numero, gateway_txid, gateway_emissao_pendente
-- tenant_itau_config: proximo_nosso_numero

ALTER TABLE faturas
    ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
    ADD COLUMN IF NOT EXISTS nosso_numero TEXT,
    ADD COLUMN IF NOT EXISTS gateway_txid TEXT,
    ADD COLUMN IF NOT EXISTS gateway_emissao_pendente BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS faturas_tenant_nosso_numero_idx
    ON faturas (tenant_id, nosso_numero)
    WHERE nosso_numero IS NOT NULL;

ALTER TABLE tenant_itau_config
    ADD COLUMN IF NOT EXISTS proximo_nosso_numero BIGINT NOT NULL DEFAULT 1;
