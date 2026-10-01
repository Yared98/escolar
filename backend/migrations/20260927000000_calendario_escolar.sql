-- Migration: Calendario Escolar Anual

CREATE TABLE IF NOT EXISTS eventos_calendario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'outro', -- 'feriado', 'ferias', 'reuniao_pais', 'festa', 'prova', 'outro'
    visibilidade VARCHAR(50) NOT NULL DEFAULT 'todos', -- 'todos', 'funcionarios', 'responsaveis'
    criado_por UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_calendario_tenant_data ON eventos_calendario(tenant_id, data_inicio);

