-- Despesa e cardápio deixam de guardar só um nome livre: passam a referenciar a entidade.

ALTER TABLE despesas
    ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE RESTRICT;

UPDATE despesas d
SET fornecedor_id = f.id
FROM fornecedores f
WHERE d.fornecedor_id IS NULL
  AND d.tenant_id = f.tenant_id
  AND lower(trim(d.fornecedor_nome)) = lower(trim(f.razao_social));

CREATE INDEX IF NOT EXISTS idx_despesas_fornecedor ON despesas (fornecedor_id);

ALTER TABLE cardapios
    ADD COLUMN IF NOT EXISTS nutricionista_id UUID REFERENCES funcionarios(id) ON DELETE RESTRICT;

UPDATE cardapios c
SET nutricionista_id = f.id
FROM funcionarios f
WHERE c.nutricionista_id IS NULL
  AND c.tenant_id = f.tenant_id
  AND lower(trim(c.nutricionista_responsavel)) = lower(trim(f.nome));

CREATE INDEX IF NOT EXISTS idx_cardapios_nutricionista ON cardapios (nutricionista_id);
