-- Migration: RSVP e Lembretes de Eventos

ALTER TABLE eventos_calendario
ADD COLUMN exige_confirmacao BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS eventos_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    evento_id UUID NOT NULL REFERENCES eventos_calendario(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- 'pendente', 'confirmado', 'recusado'
    acompanhantes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(evento_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_eventos_rsvps_evento ON eventos_rsvps(evento_id);

