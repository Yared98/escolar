-- Seed idempotente: tenant demo escola-modelo com ciclo de vida utilizável
-- Senha de todos os usuários demo: SenhaSegura2026!
-- Hash Argon2id (salt estável YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY)

DO $$
DECLARE
    v_tenant_id UUID;
    v_gestor_id UUID;
    v_prof_id UUID := 'a1111111-1111-4111-8111-111111111101';
    v_nutri_id UUID := 'a1111111-1111-4111-8111-111111111102';
    v_pwd TEXT := '$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY$KDSsoMBh5nKEezS+W4Rfrzq2DWJcIDWSiLRgdsEdE4I';
    v_sala_101 UUID := 'a2222222-2222-4222-8222-222222222201';
    v_sala_berc UUID := 'a2222222-2222-4222-8222-222222222202';
    v_turma_fund UUID := 'a3333333-3333-4333-8333-333333333301';
    v_turma_inf UUID := 'a3333333-3333-4333-8333-333333333302';
    v_aluno_1 UUID := 'a4444444-4444-4444-8444-444444444401';
    v_aluno_2 UUID := 'a4444444-4444-4444-8444-444444444402';
    v_aluno_3 UUID := 'a4444444-4444-4444-8444-444444444403';
    v_aluno_4 UUID := 'a4444444-4444-4444-8444-444444444404';
    v_aluno_5 UUID := 'a4444444-4444-4444-8444-444444444405';
    v_aluno_6 UUID := 'a4444444-4444-4444-8444-444444444406';
    v_func_1 UUID := 'a5555555-5555-4555-8555-555555555501';
    v_func_2 UUID := 'a5555555-5555-4555-8555-555555555502';
    v_forn_1 UUID := 'a6666666-6666-4666-8666-666666666601';
    v_forn_2 UUID := 'a6666666-6666-4666-8666-666666666602';
    v_fat_1 UUID := 'a7777777-7777-4777-8777-777777777701';
    v_fat_2 UUID := 'a7777777-7777-4777-8777-777777777702';
    v_fat_3 UUID := 'a7777777-7777-4777-8777-777777777703';
    v_fat_4 UUID := 'a7777777-7777-4777-8777-777777777704';
    v_desp_1 UUID := 'a8888888-8888-4888-8888-888888888801';
    v_diario_id UUID := 'a9999999-9999-4999-8999-999999999901';
    v_rotina_id UUID := 'a9999999-9999-4999-8999-999999999902';
    v_lead_1 UUID := 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaa01';
    v_lead_2 UUID := 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaa02';
    v_disc_port UUID;
    v_disc_mat UUID;
    v_disc_cien UUID;
    v_hoje DATE := CURRENT_DATE;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'escola-modelo';
    IF v_tenant_id IS NULL THEN
        v_tenant_id := 'a0000000-0000-4000-8000-000000000001';
        INSERT INTO tenants (id, name, slug, status)
        VALUES (v_tenant_id, 'Escola Modelo', 'escola-modelo', 'active');
    END IF;

    -- Gestor (cria se faltar; não sobrescreve senha existente)
    SELECT id INTO v_gestor_id
    FROM users
    WHERE tenant_id = v_tenant_id AND email = 'gestor@escolamodelo.com.br';

    IF v_gestor_id IS NULL THEN
        v_gestor_id := 'a1111111-1111-4111-8111-111111111100';
        INSERT INTO users (id, tenant_id, name, email, password_hash, role)
        VALUES (v_gestor_id, v_tenant_id, 'Carlos Gestor', 'gestor@escolamodelo.com.br', v_pwd, 'GestorEscolar');
    END IF;

    INSERT INTO users (id, tenant_id, name, email, password_hash, role)
    VALUES (v_prof_id, v_tenant_id, 'Ana Professora', 'professor@escolamodelo.com.br', v_pwd, 'professor')
    ON CONFLICT (tenant_id, email) DO NOTHING;

    SELECT id INTO v_prof_id FROM users WHERE tenant_id = v_tenant_id AND email = 'professor@escolamodelo.com.br';

    INSERT INTO users (id, tenant_id, name, email, password_hash, role)
    VALUES (v_nutri_id, v_tenant_id, 'Lucia Nutricionista', 'nutri@escolamodelo.com.br', v_pwd, 'nutricionista')
    ON CONFLICT (tenant_id, email) DO NOTHING;

    SELECT id INTO v_nutri_id FROM users WHERE tenant_id = v_tenant_id AND email = 'nutri@escolamodelo.com.br';

    INSERT INTO tenant_feature_flags (tenant_id, feature_name, is_enabled)
    VALUES
        (v_tenant_id, 'module_crm', true),
        (v_tenant_id, 'module_ia', true),
        (v_tenant_id, 'module_bank_api', true),
        (v_tenant_id, 'module_tri', false)
    ON CONFLICT (tenant_id, feature_name) DO UPDATE
        SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW();

    INSERT INTO salas (id, tenant_id, nome, capacidade)
    VALUES
        (v_sala_101, v_tenant_id, 'Sala 101', 30),
        (v_sala_berc, v_tenant_id, 'Berçário A', 20)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO turmas (
        id, tenant_id, sala_id, nome, ano_letivo, capacidade_maxima,
        codigo, etapa_ensino, serie, turno, professor_regente_id, status
    ) VALUES
        (v_turma_fund, v_tenant_id, v_sala_101, '1º Ano A', 2026, 30,
         'FUND-1A', 'fundamental_1', '1º Ano', 'matutino', v_prof_id, 'ativo'),
        (v_turma_inf, v_tenant_id, v_sala_berc, 'Infantil 4', 2026, 20,
         'INF-4', 'educacao_infantil', 'Infantil 4', 'integral', v_prof_id, 'ativo')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO alunos (
        id, tenant_id, nome, cpf, data_nascimento,
        nome_responsavel, email_responsavel, telefone_responsavel, status,
        cpf_responsavel_legal, parentesco_responsavel_legal,
        nome_responsavel_financeiro, email_responsavel_financeiro, telefone_responsavel_financeiro,
        cidade, estado, cep, logradouro, numero, bairro
    ) VALUES
        (v_aluno_1, v_tenant_id, 'Alice Moreira', '390.533.447-05', '2018-03-12',
         'Marina Moreira', 'marina.moreira@email.com', '11990001111', 'ativo',
         '153.509.460-56', 'Mãe', 'Marina Moreira', 'marina.moreira@email.com', '11990001111',
         'São Paulo', 'SP', '01310-100', 'Av. Paulista', '1000', 'Bela Vista'),
        (v_aluno_2, v_tenant_id, 'Bruno Gomes', '529.982.247-25', '2018-07-21',
         'Paulo Gomes', 'paulo.gomes@email.com', '11990002222', 'ativo',
         '886.415.779-47', 'Pai', 'Paulo Gomes', 'paulo.gomes@email.com', '11990002222',
         'São Paulo', 'SP', '04038-001', 'Rua Domingos de Morais', '200', 'Vila Mariana'),
        (v_aluno_3, v_tenant_id, 'Carla Nunes', '714.287.938-60', '2018-11-05',
         'Helena Nunes', 'helena.nunes@email.com', '11990003333', 'ativo',
         '231.002.999-00', 'Mãe', 'Helena Nunes', 'helena.nunes@email.com', '11990003333',
         'São Paulo', 'SP', '05422-000', 'Rua Teodoro Sampaio', '50', 'Pinheiros'),
        (v_aluno_4, v_tenant_id, 'Diego Prado', '111.444.777-35', '2021-02-18',
         'Sofia Prado', 'sofia.prado@email.com', '11990004444', 'ativo',
         '123.456.789-09', 'Mãe', 'Sofia Prado', 'sofia.prado@email.com', '11990004444',
         'São Paulo', 'SP', '04547-130', 'Av. Eng. Luís Carlos Berrini', '500', 'Brooklin'),
        (v_aluno_5, v_tenant_id, 'Elena Rocha', '987.654.321-00', '2021-06-30',
         'Ricardo Rocha', 'ricardo.rocha@email.com', '11990005555', 'ativo',
         '456.789.123-00', 'Pai', 'Ricardo Rocha', 'ricardo.rocha@email.com', '11990005555',
         'São Paulo', 'SP', '01414-000', 'Alameda Santos', '800', 'Jardins'),
        (v_aluno_6, v_tenant_id, 'Felipe Andrade', '321.654.987-00', '2021-09-14',
         'Juliana Andrade', 'juliana.andrade@email.com', '11990006666', 'ativo',
         '654.321.987-00', 'Mãe', 'Juliana Andrade', 'juliana.andrade@email.com', '11990006666',
         'São Paulo', 'SP', '01311-000', 'Rua Augusta', '300', 'Consolação')
    ON CONFLICT (tenant_id, cpf) DO NOTHING;

    -- Reconsultar IDs por CPF caso já existissem com outro UUID
    SELECT id INTO v_aluno_1 FROM alunos WHERE tenant_id = v_tenant_id AND cpf = '390.533.447-05';
    SELECT id INTO v_aluno_2 FROM alunos WHERE tenant_id = v_tenant_id AND cpf = '529.982.247-25';
    SELECT id INTO v_aluno_3 FROM alunos WHERE tenant_id = v_tenant_id AND cpf = '714.287.938-60';
    SELECT id INTO v_aluno_4 FROM alunos WHERE tenant_id = v_tenant_id AND cpf = '111.444.777-35';
    SELECT id INTO v_aluno_5 FROM alunos WHERE tenant_id = v_tenant_id AND cpf = '987.654.321-00';
    SELECT id INTO v_aluno_6 FROM alunos WHERE tenant_id = v_tenant_id AND cpf = '321.654.987-00';

    INSERT INTO turma_alunos (id, tenant_id, turma_id, aluno_id, data_matricula, status, numero_chamada)
    VALUES
        ('a4444444-aaaa-4aaa-8aaa-000000000001', v_tenant_id, v_turma_fund, v_aluno_1, '2026-02-01', 'ativo', 1),
        ('a4444444-aaaa-4aaa-8aaa-000000000002', v_tenant_id, v_turma_fund, v_aluno_2, '2026-02-01', 'ativo', 2),
        ('a4444444-aaaa-4aaa-8aaa-000000000003', v_tenant_id, v_turma_fund, v_aluno_3, '2026-02-01', 'ativo', 3),
        ('a4444444-aaaa-4aaa-8aaa-000000000004', v_tenant_id, v_turma_inf, v_aluno_4, '2026-02-01', 'ativo', 1),
        ('a4444444-aaaa-4aaa-8aaa-000000000005', v_tenant_id, v_turma_inf, v_aluno_5, '2026-02-01', 'ativo', 2),
        ('a4444444-aaaa-4aaa-8aaa-000000000006', v_tenant_id, v_turma_inf, v_aluno_6, '2026-02-01', 'ativo', 3)
    ON CONFLICT (turma_id, aluno_id) DO NOTHING;

    INSERT INTO funcionarios (id, tenant_id, user_id, nome, cpf, cargo, departamento, data_admissao, salario, status)
    VALUES
        (v_func_1, v_tenant_id, v_prof_id, 'Ana Professora', '153.509.460-56', 'Professora Regente', 'Pedagógico', '2024-01-15', 5500.00, 'ativo'),
        (v_func_2, v_tenant_id, v_nutri_id, 'Lucia Nutricionista', '886.415.779-47', 'Nutricionista', 'Nutrição', '2024-03-01', 4800.00, 'ativo')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO fornecedores (id, tenant_id, razao_social, cnpj, ramo_atividade, email, telefone)
    VALUES
        (v_forn_1, v_tenant_id, 'Merenda Brasil Alimentos LTDA', '12.345.678/0001-90', 'Alimentação escolar', 'contato@merendabrasil.com', '1133334444'),
        (v_forn_2, v_tenant_id, 'Papelaria Escolar Plus ME', '98.765.432/0001-10', 'Material didático', 'vendas@papelariaplus.com', '1144445555')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO faturas (id, tenant_id, aluno_id, descricao, valor, data_vencimento, metodo_pagamento, status, qr_code_pix)
    VALUES
        (v_fat_1, v_tenant_id, v_aluno_1, 'Mensalidade Setembro/2026', 1250.00, '2026-09-10', 'pix', 'pago', NULL),
        (v_fat_2, v_tenant_id, v_aluno_1, 'Mensalidade Outubro/2026', 1250.00, '2026-10-10', 'pix', 'pendente', '00020126580014BR.GOV.BCB.PIX0136123e4567-e12b-12d1-a456-426655440000'),
        (v_fat_3, v_tenant_id, v_aluno_2, 'Mensalidade Setembro/2026', 1250.00, '2026-09-05', 'boleto', 'atrasado', NULL),
        (v_fat_4, v_tenant_id, v_aluno_4, 'Mensalidade Outubro/2026', 1450.00, '2026-10-10', 'pix', 'pendente', NULL)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO despesas (id, tenant_id, descricao, categoria, valor, data_vencimento, status, tipo, fornecedor_nome)
    VALUES
        (v_desp_1, v_tenant_id, 'Compra de materiais de limpeza', 'insumos', 890.50, v_hoje + 7, 'pendente', 'pontual', 'Papelaria Escolar Plus ME')
    ON CONFLICT (id) DO NOTHING;

    -- Disciplinas BNCC (mesmo catálogo do lazy seed)
    INSERT INTO disciplinas (tenant_id, codigo, nome, area_conhecimento, carga_horaria_semanal, carga_horaria_anual, descricao, status)
    VALUES
        (v_tenant_id, 'PORT-01', 'Língua Portuguesa', 'linguagens', 5, 200, 'Comunicação, leitura, gramática e interpretação textual', 'ativo'),
        (v_tenant_id, 'MAT-01', 'Matemática', 'matematica', 5, 200, 'Aritmética, álgebra, geometria e raciocínio lógico', 'ativo'),
        (v_tenant_id, 'HIST-01', 'História', 'ciencias_humanas', 3, 120, 'História do Brasil, geral e cidadania crítica', 'ativo'),
        (v_tenant_id, 'GEOG-01', 'Geografia', 'ciencias_humanas', 3, 120, 'Geografia física, geopolítica e cartografia', 'ativo'),
        (v_tenant_id, 'CIEN-01', 'Ciências da Natureza', 'ciencias_natureza', 4, 160, 'Biologia, ecologia, química e física integrada', 'ativo'),
        (v_tenant_id, 'ARTE-01', 'Arte & Cultura', 'linguagens', 2, 80, 'Artes visuais, teatro, música e patrimônio cultural', 'ativo'),
        (v_tenant_id, 'EDFIS-01', 'Educação Física', 'linguagens', 2, 80, 'Cultura corporal, esportes coletivos e saúde preventiva', 'ativo'),
        (v_tenant_id, 'ING-01', 'Língua Inglesa', 'linguagens', 2, 80, 'Língua estrangeira moderna e comunicação global', 'ativo')
    ON CONFLICT (tenant_id, codigo) DO NOTHING;

    SELECT id INTO v_disc_port FROM disciplinas WHERE tenant_id = v_tenant_id AND codigo = 'PORT-01';
    SELECT id INTO v_disc_mat FROM disciplinas WHERE tenant_id = v_tenant_id AND codigo = 'MAT-01';
    SELECT id INTO v_disc_cien FROM disciplinas WHERE tenant_id = v_tenant_id AND codigo = 'CIEN-01';

    INSERT INTO turma_disciplinas (id, tenant_id, turma_id, disciplina_id, carga_horaria_semanal, carga_horaria_anual)
    VALUES
        ('abbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', v_tenant_id, v_turma_fund, v_disc_port, 5, 200),
        ('abbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02', v_tenant_id, v_turma_fund, v_disc_mat, 5, 200),
        ('abbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03', v_tenant_id, v_turma_fund, v_disc_cien, 4, 160)
    ON CONFLICT (tenant_id, turma_id, disciplina_id) DO NOTHING;

    INSERT INTO turma_professores (id, tenant_id, turma_id, disciplina_id, professor_id, ano_letivo)
    VALUES
        ('accccccc-cccc-4ccc-8ccc-cccccccccc01', v_tenant_id, v_turma_fund, v_disc_port, v_prof_id, 2026),
        ('accccccc-cccc-4ccc-8ccc-cccccccccc02', v_tenant_id, v_turma_fund, v_disc_mat, v_prof_id, 2026)
    ON CONFLICT (tenant_id, turma_id, disciplina_id, professor_id) DO NOTHING;

    INSERT INTO diarios_classe (id, tenant_id, turma_id, professor_id, data_aula, conteudo_ministrado)
    VALUES (
        v_diario_id, v_tenant_id, v_turma_fund, v_prof_id, v_hoje,
        'Leitura compartilhada e revisão de números naturais'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO presencas (id, tenant_id, diario_id, aluno_id, presente, justificativa)
    VALUES
        ('addddddd-dddd-4ddd-8ddd-dddddddddd01', v_tenant_id, v_diario_id, v_aluno_1, true, NULL),
        ('addddddd-dddd-4ddd-8ddd-dddddddddd02', v_tenant_id, v_diario_id, v_aluno_2, true, NULL),
        ('addddddd-dddd-4ddd-8ddd-dddddddddd03', v_tenant_id, v_diario_id, v_aluno_3, false, 'Consulta médica')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO rotina_diaria_infantil (
        id, tenant_id, aluno_id, data, refeicao_status, sono_minutos, fraldas_trocas,
        humor, medicamento_ministrado, observacao_pedagogica
    ) VALUES (
        v_rotina_id, v_tenant_id, v_aluno_4, v_hoje, 'excelente', 75, 3,
        'alegre', NULL, 'Participou da roda de música com entusiasmo'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO leads (id, tenant_id, nome, email, telefone, estagio_funil, custo_aquisicao, canal_aquisicao, observacoes)
    VALUES
        (v_lead_1, v_tenant_id, 'Fernanda Captação', 'fernanda.captacao@email.com', '11988887777', 'novo_lead', 40.0, 'instagram', 'Aluno: Miguel · Série: Infantil 3'),
        (v_lead_2, v_tenant_id, 'Roberto Visita', 'roberto.visita@email.com', '11977776666', 'visita_agendada', 80.0, 'indicacao', 'Aluno: Lara · Série: 1º Ano')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO prontuarios (tenant_id, aluno_id, restricoes_alimentares, alergias, tipo_sanguineo)
    VALUES
        (v_tenant_id, v_aluno_4, 'Lactose', 'Leite', 'O+'),
        (v_tenant_id, v_aluno_1, NULL, NULL, 'A+')
    ON CONFLICT (tenant_id, aluno_id) DO NOTHING;
END $$;
