-- Migration: Adiciona flags de ativação e troca obrigatória de senha em users

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS deve_trocar_senha BOOLEAN NOT NULL DEFAULT false;
