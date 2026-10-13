-- Migration: 20261014000000_diario_por_aula.sql
-- Diário de classe passa a suportar registro por aula/disciplina,
-- permitindo que vários professores lancem chamadas distintas no mesmo dia.

ALTER TABLE diarios_classe
    ADD COLUMN IF NOT EXISTS disciplina_id UUID REFERENCES disciplinas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS horario_id UUID REFERENCES horarios_turma(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_diarios_classe_turma_data_disciplina
    ON diarios_classe (tenant_id, turma_id, data_aula, disciplina_id);
