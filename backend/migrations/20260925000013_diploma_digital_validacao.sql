-- Migration: Suporte a validação pública e status do Diploma Digital MEC (Portaria 70/2025)

ALTER TABLE diplomas_digitais ADD COLUMN IF NOT EXISTS codigo_validacao VARCHAR(100);
ALTER TABLE diplomas_digitais ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'registrado_e_assinado';

CREATE INDEX IF NOT EXISTS idx_diplomas_codigo_validacao ON diplomas_digitais(tenant_id, codigo_validacao);
CREATE INDEX IF NOT EXISTS idx_diplomas_hash_xades ON diplomas_digitais(hash_xades);
CREATE INDEX IF NOT EXISTS idx_diplomas_aluno ON diplomas_digitais(tenant_id, aluno_id);
