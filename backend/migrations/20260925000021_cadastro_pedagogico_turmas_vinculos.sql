-- Migration: Cadastro Pedagógico, Gestão de Turmas Aprofundada & Vínculos Estruturais
-- Criação de Disciplinas (BNCC), Matriz Curricular, Atribuições Docentes, Grade Horária e Enriquecimento de Turmas

-- 1. Enriquecer tabela 'turmas' com metadados pedagógicos
ALTER TABLE turmas 
ADD COLUMN IF NOT EXISTS codigo VARCHAR(50),
ADD COLUMN IF NOT EXISTS etapa_ensino VARCHAR(50) NOT NULL DEFAULT 'fundamental_1',
ADD COLUMN IF NOT EXISTS serie VARCHAR(50),
ADD COLUMN IF NOT EXISTS turno VARCHAR(50) NOT NULL DEFAULT 'matutino',
ADD COLUMN IF NOT EXISTS professor_regente_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ativo';

CREATE INDEX IF NOT EXISTS idx_turmas_tenant_etapa ON turmas(tenant_id, etapa_ensino);
CREATE INDEX IF NOT EXISTS idx_turmas_tenant_regente ON turmas(tenant_id, professor_regente_id);

-- 2. Enriquecer tabela 'turma_alunos' com número de chamada ordenável
ALTER TABLE turma_alunos
ADD COLUMN IF NOT EXISTS numero_chamada INT;

CREATE INDEX IF NOT EXISTS idx_turma_alunos_chamada ON turma_alunos(turma_id, numero_chamada);

-- 3. Tabela 'disciplinas' (Componentes Curriculares da BNCC e Parte Diversificada)
CREATE TABLE IF NOT EXISTS disciplinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    area_conhecimento VARCHAR(50) NOT NULL DEFAULT 'linguagens',
    carga_horaria_semanal INT NOT NULL DEFAULT 4,
    carga_horaria_anual INT NOT NULL DEFAULT 160,
    descricao TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_disciplina_codigo UNIQUE (tenant_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_disciplinas_tenant ON disciplinas(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_disciplinas_area ON disciplinas(tenant_id, area_conhecimento);

-- 4. Tabela 'turma_disciplinas' (Matriz Curricular da Turma)
CREATE TABLE IF NOT EXISTS turma_disciplinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    disciplina_id UUID NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    carga_horaria_semanal INT NOT NULL DEFAULT 4,
    carga_horaria_anual INT NOT NULL DEFAULT 160,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_turma_disciplina UNIQUE (tenant_id, turma_id, disciplina_id)
);

CREATE INDEX IF NOT EXISTS idx_turma_disciplinas_turma ON turma_disciplinas(tenant_id, turma_id);

-- 5. Tabela 'turma_professores' (Atribuição Docente / Lotação de Professores por Turma e Disciplina)
CREATE TABLE IF NOT EXISTS turma_professores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    disciplina_id UUID NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ano_letivo INT NOT NULL DEFAULT 2026,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_tenant_turma_disciplina_prof UNIQUE (tenant_id, turma_id, disciplina_id, professor_id)
);

CREATE INDEX IF NOT EXISTS idx_turma_professores_prof ON turma_professores(tenant_id, professor_id);
CREATE INDEX IF NOT EXISTS idx_turma_professores_turma ON turma_professores(tenant_id, turma_id);

-- 6. Tabela 'horarios_turma' (Quadro Semanal de Horários com Detecção de Choques)
CREATE TABLE IF NOT EXISTS horarios_turma (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    disciplina_id UUID NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    professor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sala_id UUID REFERENCES salas(id) ON DELETE SET NULL,
    dia_semana INT NOT NULL, -- 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
    hora_inicio VARCHAR(5) NOT NULL, -- "HH:MM"
    hora_fim VARCHAR(5) NOT NULL,    -- "HH:MM"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_horarios_turma_dia ON horarios_turma(tenant_id, turma_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_horarios_prof_dia ON horarios_turma(tenant_id, professor_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_horarios_sala_dia ON horarios_turma(tenant_id, sala_id, dia_semana);
