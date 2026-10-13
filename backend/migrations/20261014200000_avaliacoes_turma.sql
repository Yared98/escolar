-- Migration: Vínculo de disciplina em avaliações/eventos do calendário por turma

ALTER TABLE eventos_calendario
ADD COLUMN IF NOT EXISTS disciplina_id UUID REFERENCES disciplinas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eventos_calendario_turma_disciplina
ON eventos_calendario(tenant_id, turma_id, disciplina_id);
