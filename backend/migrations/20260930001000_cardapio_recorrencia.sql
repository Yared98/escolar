-- Catálogo de pratos reutilizáveis e vigência semanal.
-- As ocorrências continuam em cardapios, uma linha por data, para o Diário e o Portal.

CREATE TABLE IF NOT EXISTS pratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descricao_ingredientes TEXT NOT NULL,
    alergicos_atencao TEXT,
    tipo_refeicao VARCHAR(50),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pratos_tenant ON pratos (tenant_id);

CREATE TABLE IF NOT EXISTS cardapio_recorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    prato_id UUID NOT NULL REFERENCES pratos(id),
    turma_id UUID REFERENCES turmas(id),
    tipo_refeicao VARCHAR(50) NOT NULL,
    dias_semana SMALLINT[] NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    nutricionista_id UUID REFERENCES funcionarios(id),
    nutricionista_responsavel VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cardapio_recorrencias_vigencia CHECK (data_fim >= data_inicio),
    CONSTRAINT cardapio_recorrencias_limite CHECK (data_fim <= data_inicio + 180),
    CONSTRAINT cardapio_recorrencias_dias CHECK (cardinality(dias_semana) > 0)
);

CREATE INDEX IF NOT EXISTS idx_cardapio_recorrencias_tenant ON cardapio_recorrencias (tenant_id, data_inicio, data_fim);

ALTER TABLE cardapios
    ADD COLUMN IF NOT EXISTS prato_id UUID REFERENCES pratos(id),
    ADD COLUMN IF NOT EXISTS recorrencia_id UUID REFERENCES cardapio_recorrencias(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS origem VARCHAR(20) NOT NULL DEFAULT 'avulso',
    ADD COLUMN IF NOT EXISTS editado_manualmente BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE cardapios DROP CONSTRAINT IF EXISTS cardapios_origem_valida;
ALTER TABLE cardapios
    ADD CONSTRAINT cardapios_origem_valida CHECK (origem IN ('avulso', 'recorrencia', 'excecao'));

CREATE INDEX IF NOT EXISTS idx_cardapios_dia_refeicao ON cardapios (tenant_id, data_dia, tipo_refeicao);

GRANT SELECT, INSERT, UPDATE, DELETE ON pratos, cardapio_recorrencias TO escolar_runtime;
