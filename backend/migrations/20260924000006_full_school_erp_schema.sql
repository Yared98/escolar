-- Migration: Full School ERP Schema (Pedagógico, Nutrição, Financeiro AP/AR/NFS-e, Administrativo RH, Agenda Digital)

-- 1. FINANCEIRO: NFS-e, AP (Despesas), Conciliação Bancária & Plano de Contas
CREATE TABLE IF NOT EXISTS nfse_emissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fatura_id UUID NOT NULL REFERENCES faturas(id) ON DELETE CASCADE,
    numero_nfse VARCHAR(50),
    codigo_verificacao VARCHAR(50),
    valor_servico DOUBLE PRECISION NOT NULL,
    aliquota_iss DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    status VARCHAR(50) NOT NULL DEFAULT 'rascunho', -- 'rascunho', 'processando', 'emitida', 'cancelada'
    xml_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS despesas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    categoria VARCHAR(100) NOT NULL, -- 'folha_pagamento', 'manutencao', 'insumos', 'impostos', 'outros'
    valor DOUBLE PRECISION NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    metodo_pagamento VARCHAR(50) DEFAULT 'pix',
    status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- 'pendente', 'pago', 'atrasado', 'cancelado'
    tipo VARCHAR(50) NOT NULL DEFAULT 'pontual', -- 'fixo', 'pontual', 'cartao_credito'
    fornecedor_nome VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conciliacao_bancaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    banco VARCHAR(100) NOT NULL,
    data_transacao DATE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    valor DOUBLE PRECISION NOT NULL,
    tipo VARCHAR(20) NOT NULL, -- 'credito', 'debito'
    fatura_id UUID REFERENCES faturas(id),
    despesa_id UUID REFERENCES despesas(id),
    status_conciliacao VARCHAR(50) NOT NULL DEFAULT 'pendente', -- 'conciliado', 'pendente'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plano_contas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'receita', 'despesa'
    nivel INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PEDAGÓGICO & NUTRIÇÃO: Turmas, Projetos, Nutrição e Cardápios
CREATE TABLE IF NOT EXISTS turma_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    data_matricula DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_turma_aluno UNIQUE(turma_id, aluno_id)
);

CREATE TABLE IF NOT EXISTS projetos_educacionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    professor_id UUID REFERENCES users(id),
    titulo VARCHAR(255) NOT NULL,
    objetivo TEXT NOT NULL,
    habilidades_bncc TEXT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'rascunho', -- 'rascunho', 'aprovado', 'em_andamento', 'concluido'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cardapios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    turma_id UUID REFERENCES turmas(id),
    semana_ano VARCHAR(20) NOT NULL,
    data_dia DATE NOT NULL,
    tipo_refeicao VARCHAR(50) NOT NULL, -- 'cafe_manha', 'almoco', 'lanche', 'jantar'
    titulo_menu VARCHAR(255) NOT NULL,
    descricao_ingredientes TEXT NOT NULL,
    alergicos_atencao TEXT,
    nutricionista_responsavel VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restricoes_alimentares_aluno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    tipo_restricao VARCHAR(100) NOT NULL,
    descricao TEXT,
    laudo_medico_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ADMINISTRATIVO & AUDITORIA: Funcionários (RH), Fornecedores, Audit Logs
CREATE TABLE IF NOT EXISTS funcionarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    cargo VARCHAR(100) NOT NULL,
    departamento VARCHAR(100) NOT NULL,
    data_admissao DATE NOT NULL,
    salario DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'ativo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fornecedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    razao_social VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) NOT NULL,
    ramo_atividade VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    acao VARCHAR(100) NOT NULL,
    entidade VARCHAR(100) NOT NULL,
    entidade_id VARCHAR(255),
    detalhes_json JSONB DEFAULT '{}'::jsonb,
    ip_origem VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AGENDA DIGITAL (APP): Comunicação Auditável e Tracking de Rotina Diária
CREATE TABLE IF NOT EXISTS mensagens_agenda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    remetente_id UUID NOT NULL REFERENCES users(id),
    destinatario_id UUID REFERENCES users(id),
    turma_id UUID REFERENCES turmas(id),
    canal VARCHAR(50) NOT NULL DEFAULT 'coordenacao', -- 'coordenacao', 'professor', 'financeiro', 'nutricao'
    titulo VARCHAR(255) NOT NULL,
    conteudo TEXT NOT NULL,
    anexo_url TEXT,
    lida BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rotina_diaria_infantil (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    refeicao_status VARCHAR(50) NOT NULL DEFAULT 'excelente', -- 'excelente', 'parcial', 'recusou'
    sono_minutos INT NOT NULL DEFAULT 60,
    fraldas_trocas INT NOT NULL DEFAULT 3,
    humor VARCHAR(50) NOT NULL DEFAULT 'alegre', -- 'alegre', 'tranquilo', 'agitado', 'choroso'
    medicamento_ministrado TEXT,
    observacao_pedagogica TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
