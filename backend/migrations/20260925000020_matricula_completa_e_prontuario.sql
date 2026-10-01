-- Migration: Matrícula Completa de Alunos, Responsáveis Legal e Financeiro, Endereço e Prontuário Médico
-- Atende aos requisitos de responsabilidade legal vs financeira, dados de contato/emergência, endereço e prontuário integrado.

-- 1. Expansão da tabela alunos com dados de responsáveis, endereço e contatos de emergência
ALTER TABLE alunos 
ADD COLUMN IF NOT EXISTS responsavel_financeiro_igual_legal BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS cpf_responsavel_legal VARCHAR(14),
ADD COLUMN IF NOT EXISTS parentesco_responsavel_legal VARCHAR(50) DEFAULT 'Mãe/Pai/Tutor Legal',
ADD COLUMN IF NOT EXISTS nome_responsavel_financeiro VARCHAR(255),
ADD COLUMN IF NOT EXISTS cpf_responsavel_financeiro VARCHAR(14),
ADD COLUMN IF NOT EXISTS email_responsavel_financeiro VARCHAR(255),
ADD COLUMN IF NOT EXISTS telefone_responsavel_financeiro VARCHAR(50),
ADD COLUMN IF NOT EXISTS parentesco_responsavel_financeiro VARCHAR(50),
ADD COLUMN IF NOT EXISTS cep VARCHAR(10),
ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255),
ADD COLUMN IF NOT EXISTS numero VARCHAR(50),
ADD COLUMN IF NOT EXISTS complemento VARCHAR(100),
ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
ADD COLUMN IF NOT EXISTS estado VARCHAR(2),
ADD COLUMN IF NOT EXISTS telefone_secundario VARCHAR(50),
ADD COLUMN IF NOT EXISTS contato_emergencia_nome VARCHAR(255),
ADD COLUMN IF NOT EXISTS contato_emergencia_telefone VARCHAR(50),
ADD COLUMN IF NOT EXISTS contato_emergencia_parentesco VARCHAR(50);

-- Preencher retroativamente dados de responsável financeiro onde estiver nulo para consistência
UPDATE alunos 
SET 
    nome_responsavel_financeiro = COALESCE(nome_responsavel_financeiro, nome_responsavel),
    email_responsavel_financeiro = COALESCE(email_responsavel_financeiro, email_responsavel),
    telefone_responsavel_financeiro = COALESCE(telefone_responsavel_financeiro, telefone_responsavel),
    parentesco_responsavel_legal = COALESCE(parentesco_responsavel_legal, 'Mãe/Pai/Tutor Legal'),
    parentesco_responsavel_financeiro = COALESCE(parentesco_responsavel_financeiro, 'Mãe/Pai/Tutor Legal')
WHERE nome_responsavel_financeiro IS NULL;

-- 2. Expansão da tabela prontuarios com ficha clínica estruturada
ALTER TABLE prontuarios
ADD COLUMN IF NOT EXISTS tipo_sanguineo VARCHAR(10),
ADD COLUMN IF NOT EXISTS alergias TEXT,
ADD COLUMN IF NOT EXISTS medicamentos_continuos TEXT,
ADD COLUMN IF NOT EXISTS cuidados_especiais TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Garantir constraint unique para permitir UPSERT atômico por tenant_id e aluno_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_prontuario_tenant_aluno'
    ) THEN
        ALTER TABLE prontuarios ADD CONSTRAINT unique_prontuario_tenant_aluno UNIQUE (tenant_id, aluno_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prontuarios_tenant_aluno ON prontuarios(tenant_id, aluno_id);
CREATE INDEX IF NOT EXISTS idx_alunos_tenant_cidade ON alunos(tenant_id, cidade);
