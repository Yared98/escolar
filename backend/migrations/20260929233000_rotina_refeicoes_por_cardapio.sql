ALTER TABLE rotina_diaria_infantil
    ADD COLUMN IF NOT EXISTS refeicoes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_rotina_infantil_aluno_data
    ON rotina_diaria_infantil (tenant_id, aluno_id, data);
