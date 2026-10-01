-- Threads estilo Slack: tema raiz + respostas encadeadas.

ALTER TABLE mensagens_agenda
    ADD COLUMN IF NOT EXISTS resposta_a_id UUID REFERENCES mensagens_agenda(id) ON DELETE SET NULL;

ALTER TABLE mensagens_agenda
    ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES mensagens_agenda(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mensagens_agenda_thread
    ON mensagens_agenda (tenant_id, thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_mensagens_agenda_resposta
    ON mensagens_agenda (tenant_id, resposta_a_id);

-- Raízes existentes: thread_id = própria mensagem
UPDATE mensagens_agenda
SET thread_id = id
WHERE thread_id IS NULL AND resposta_a_id IS NULL;

-- Heurística para respostas antigas "Re: …" sem vínculo
UPDATE mensagens_agenda m
SET
    resposta_a_id = p.id,
    thread_id = COALESCE(p.thread_id, p.id)
FROM mensagens_agenda p
WHERE m.tenant_id = p.tenant_id
  AND m.resposta_a_id IS NULL
  AND m.titulo ~* '^Re:\s*'
  AND lower(trim(regexp_replace(m.titulo, '^Re:\s*', '', 'i'))) = lower(trim(p.titulo))
  AND p.resposta_a_id IS NULL
  AND m.created_at > p.created_at
  AND (m.turma_id IS NOT DISTINCT FROM p.turma_id OR m.turma_id IS NULL OR p.turma_id IS NULL);

-- Qualquer sobra sem thread_id vira raiz de si mesma
UPDATE mensagens_agenda
SET thread_id = id
WHERE thread_id IS NULL;
