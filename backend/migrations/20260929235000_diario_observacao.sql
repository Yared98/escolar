ALTER TABLE diarios_classe
    ADD COLUMN IF NOT EXISTS observacao TEXT NOT NULL DEFAULT '';

ALTER TABLE diarios_classe
    DROP CONSTRAINT IF EXISTS diarios_classe_observacao_limite;

ALTER TABLE diarios_classe
    ADD CONSTRAINT diarios_classe_observacao_limite
    CHECK (char_length(observacao) <= 4000);
