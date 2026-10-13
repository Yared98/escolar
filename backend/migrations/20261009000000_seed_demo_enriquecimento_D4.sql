-- Seed idempotente D4: enriquece o tenant demo escola-modelo.
-- Cobre Calendário (eventos com RSVP), Nutrição (cardápios sem lactose e turma do fundamental),
-- Comunicados (mural realista), IA Anti-Evasão (sinais em 2 alunos) e Financeiro (faturas extras).
-- Executa como no-op quando o tenant escola-modelo não existe.

DO $$
DECLARE
    v_tenant_id UUID;
    v_gestor_id UUID;
    v_turma_fund UUID := 'a3333333-3333-4333-8333-333333333301';
    v_turma_inf UUID := 'a3333333-3333-4333-8333-333333333302';
    v_aluno_1 UUID := 'a4444444-4444-4444-8444-444444444401';
    v_aluno_2 UUID := 'a4444444-4444-4444-8444-444444444402';
    v_aluno_3 UUID := 'a4444444-4444-4444-8444-444444444403';
    v_aluno_4 UUID := 'a4444444-4444-4444-8444-444444444404';
    v_aluno_5 UUID := 'a4444444-4444-4444-8444-444444444405';
    v_aluno_6 UUID := 'a4444444-4444-4444-8444-444444444406';
    v_prof_id UUID := 'a1111111-1111-4111-8111-111111111101';
    v_nutri_func_id UUID := 'a5555555-5555-4555-8555-555555555502';
    v_hoje DATE := CURRENT_DATE;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'escola-modelo';
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    SELECT id INTO v_gestor_id
    FROM users
    WHERE tenant_id = v_tenant_id AND email = 'gestor@escolamodelo.com.br';

    IF v_gestor_id IS NULL THEN
        v_gestor_id := 'a1111111-1111-4111-8111-111111111100';
    END IF;

    -- ============================================================
    -- 1. CALENDÁRIO ESCOLAR: 8 eventos nos próximos 60 dias
    -- ============================================================
    INSERT INTO eventos_calendario (
        id, tenant_id, turma_id, titulo, descricao, data_inicio, data_fim,
        tipo, visibilidade, criado_por, exige_confirmacao
    ) VALUES
        ('b0000001-0001-4001-8001-000000000001', v_tenant_id, v_turma_inf,
         'Reunião de Pais - Infantil 4', 'Apresentação das rotinas e acompanhamento dos primeiros meses de adaptação.',
         v_hoje + 5, v_hoje + 5, 'reuniao_pais', 'responsaveis', v_gestor_id, true),
        ('b0000001-0001-4001-8001-000000000002', v_tenant_id, NULL,
         'Feriado municipal (sem aula)', 'Não haverá aula em função do feriado municipal.',
         v_hoje + 14, v_hoje + 14, 'feriado', 'todos', v_gestor_id, false),
        ('b0000001-0001-4001-8001-000000000003', v_tenant_id, v_turma_fund,
         'Prova Bimestral - Língua Portuguesa', 'Avaliação de interpretação textual e produção de texto.',
         v_hoje + 10, v_hoje + 10, 'prova', 'todos', v_gestor_id, false),
        ('b0000001-0001-4001-8001-000000000004', v_tenant_id, NULL,
         'Passeio ao Zoológico', 'Saída pedagógica com autorização dos responsáveis. Levar lanche e água.',
         v_hoje + 21, v_hoje + 21, 'outro', 'todos', v_gestor_id, true),
        ('b0000001-0001-4001-8001-000000000005', v_tenant_id, NULL,
         'Mostra Cultural e Festa da Família', 'Apresentações culturais, comidas típicas e barracas das famílias. Confirmar presença até uma semana antes.',
         v_hoje + 35, v_hoje + 35, 'festa', 'todos', v_gestor_id, true),
        ('b0000001-0001-4001-8001-000000000006', v_tenant_id, NULL,
         'Reunião Geral de Pais e Responsáveis', 'Balanço pedagógico, calendário de avaliações e orientações de fim de ano.',
         v_hoje + 7, v_hoje + 7, 'reuniao_pais', 'responsaveis', v_gestor_id, true),
        ('b0000001-0001-4001-8001-000000000007', v_tenant_id, NULL,
         'Ponto facultativo (sem aula)', 'Não haverá aula nesta data, conforme o calendário escolar definido pelo município.',
         v_hoje + 45, v_hoje + 45, 'feriado', 'todos', v_gestor_id, false),
        ('b0000001-0001-4001-8001-000000000008', v_tenant_id, v_turma_fund,
         'Prova Bimestral - Matemática', 'Avaliação de resolução de problemas e operações numéricas.',
         v_hoje + 12, v_hoje + 12, 'prova', 'funcionarios', v_gestor_id, false)
    ON CONFLICT (id) DO NOTHING;

    -- ============================================================
    -- 2. NUTRIÇÃO: pratos e cardápios com vigência
    -- ============================================================
    INSERT INTO pratos (
        id, tenant_id, titulo, descricao_ingredientes, alergicos_atencao, tipo_refeicao, ativo
    ) VALUES
        ('b1111111-1111-4111-8111-111111111101', v_tenant_id, 'Arroz integral e feijão carioca',
         'Arroz integral, feijão carioca e azeite de oliva.', NULL, 'almoco', true),
        ('b1111111-1111-4111-8111-111111111102', v_tenant_id, 'Frango desfiado com legumes',
         'Peito de frango desfiado, cenoura, abobrinha e batata.', NULL, 'almoco', true),
        ('b1111111-1111-4111-8111-111111111103', v_tenant_id, 'Isca de peixe grelhado',
         'Filé de peixe grelhado, limão e ervas finas.', 'Peixe', 'almoco', true),
        ('b1111111-1111-4111-8111-111111111104', v_tenant_id, 'Salada mista da estação',
         'Alface, tomate, pepino, cenoura ralada e molho de limão.', NULL, 'almoco', true),
        ('b1111111-1111-4111-8111-111111111105', v_tenant_id, 'Sopa de legumes sem lactose',
         'Abóbora, cenoura, batata, carne magra e cheiro-verde.', NULL, 'almoco', true),
        ('b1111111-1111-4111-8111-111111111106', v_tenant_id, 'Lanche da manhã - frutas e granola',
         'Mix de frutas da estação com granola sem açúcar.', NULL, 'lanche', true),
        ('b1111111-1111-4111-8111-111111111107', v_tenant_id, 'Lanche - iogurte natural',
         'Iogurte natural, mel e castanhas.', 'Lactose e castanhas', 'lanche', true),
        ('b1111111-1111-4111-8111-111111111108', v_tenant_id, 'Lanche sem lactose - suco e biscoito',
         'Suco de laranja natural e biscoito de arroz.', NULL, 'lanche', true),
        ('b1111111-1111-4111-8111-111111111109', v_tenant_id, 'Macarrão integral ao sugo',
         'Macarrão integral, molho de tomate caseiro e queijo ralado.', 'Lactose', 'almoco', true),
        ('b1111111-1111-4111-8111-111111111110', v_tenant_id, 'Ovo mexido com espinafre',
         'Ovos, espinafre refogado e azeite.', NULL, 'almoco', true)
    ON CONFLICT (id) DO NOTHING;

    -- Recorrências: Infantil 4 (sem lactose) e 1º Ano A
    INSERT INTO cardapio_recorrencias (
        id, tenant_id, prato_id, turma_id, tipo_refeicao, dias_semana, data_inicio, data_fim,
        nutricionista_id, nutricionista_responsavel
    ) VALUES
        ('b2222222-2222-4222-8222-222222222201', v_tenant_id, 'b1111111-1111-4111-8111-111111111105',
         v_turma_inf, 'almoco', ARRAY[2,3,4,5]::SMALLINT[], v_hoje + 1, v_hoje + 60,
         v_nutri_func_id, 'Lúcia Nutricionista'),
        ('b2222222-2222-4222-8222-222222222202', v_tenant_id, 'b1111111-1111-4111-8111-111111111108',
         v_turma_inf, 'lanche', ARRAY[2,3,4,5]::SMALLINT[], v_hoje + 1, v_hoje + 60,
         v_nutri_func_id, 'Lúcia Nutricionista'),
        ('b2222222-2222-4222-8222-222222222203', v_tenant_id, 'b1111111-1111-4111-8111-111111111102',
         v_turma_fund, 'almoco', ARRAY[1,2,3,4,5]::SMALLINT[], v_hoje + 1, v_hoje + 60,
         v_nutri_func_id, 'Lúcia Nutricionista'),
        ('b2222222-2222-4222-8222-222222222204', v_tenant_id, 'b1111111-1111-4111-8111-111111111106',
         v_turma_fund, 'lanche', ARRAY[1,2,3,4,5]::SMALLINT[], v_hoje + 1, v_hoje + 60,
         v_nutri_func_id, 'Lúcia Nutricionista')
    ON CONFLICT (id) DO NOTHING;

    -- Publica algumas ocorrências de cardápio para os próximos dias úteis
    INSERT INTO cardapios (
        id, tenant_id, turma_id, semana_ano, data_dia, tipo_refeicao, titulo_menu,
        descricao_ingredientes, alergicos_atencao, nutricionista_responsavel, nutricionista_id,
        prato_id, recorrencia_id, origem
    ) VALUES
        ('b3333333-3333-4333-8333-333333333311', v_tenant_id, v_turma_inf, 'Semana ' || EXTRACT(WEEK FROM v_hoje + 2)::TEXT || '/' || EXTRACT(YEAR FROM v_hoje + 2)::TEXT,
         v_hoje + 2, 'almoco', 'Sopa de legumes sem lactose', 'Abóbora, cenoura, batata, carne magra e cheiro-verde.', NULL,
         'Lúcia Nutricionista', v_nutri_func_id, 'b1111111-1111-4111-8111-111111111105',
         'b2222222-2222-4222-8222-222222222201', 'recorrencia'),
        ('b3333333-3333-4333-8333-333333333312', v_tenant_id, v_turma_inf, 'Semana ' || EXTRACT(WEEK FROM v_hoje + 3)::TEXT || '/' || EXTRACT(YEAR FROM v_hoje + 3)::TEXT,
         v_hoje + 3, 'lanche', 'Lanche sem lactose - suco e biscoito', 'Suco de laranja natural e biscoito de arroz.', NULL,
         'Lúcia Nutricionista', v_nutri_func_id, 'b1111111-1111-4111-8111-111111111108',
         'b2222222-2222-4222-8222-222222222202', 'recorrencia'),
        ('b3333333-3333-4333-8333-333333333313', v_tenant_id, v_turma_fund, 'Semana ' || EXTRACT(WEEK FROM v_hoje + 1)::TEXT || '/' || EXTRACT(YEAR FROM v_hoje + 1)::TEXT,
         v_hoje + 1, 'almoco', 'Frango desfiado com legumes', 'Peito de frango desfiado, cenoura, abobrinha e batata.', NULL,
         'Lúcia Nutricionista', v_nutri_func_id, 'b1111111-1111-4111-8111-111111111102',
         'b2222222-2222-4222-8222-222222222203', 'recorrencia'),
        ('b3333333-3333-4333-8333-333333333314', v_tenant_id, v_turma_fund, 'Semana ' || EXTRACT(WEEK FROM v_hoje + 4)::TEXT || '/' || EXTRACT(YEAR FROM v_hoje + 4)::TEXT,
         v_hoje + 4, 'lanche', 'Lanche da manhã - frutas e granola', 'Mix de frutas da estação com granola sem açúcar.', NULL,
         'Lúcia Nutricionista', v_nutri_func_id, 'b1111111-1111-4111-8111-111111111106',
         'b2222222-2222-4222-8222-222222222204', 'recorrencia')
    ON CONFLICT (id) DO NOTHING;

    -- Prontuário do Diego: a restrição alimentar (lactose) já é criada pelo seed base
    -- (20260929180000_seed_demo_escola_modelo.sql). Aqui só garantimos o registro sem sobrescrever
    -- alergias/tipo sanguíneo/restrições que já existam.
    INSERT INTO prontuarios (tenant_id, aluno_id, restricoes_alimentares, alergias, tipo_sanguineo)
    VALUES (v_tenant_id, v_aluno_4, 'Lactose', 'Leite e derivados', 'O+')
    ON CONFLICT (tenant_id, aluno_id) DO NOTHING;

    -- ============================================================
    -- 3. COMUNICADOS / MURAL: 5 comunicados realistas
    -- ============================================================
    INSERT INTO mensagens_agenda (
        id, tenant_id, remetente_id, turma_id, canal, titulo, conteudo, thread_id
    ) VALUES
        ('b4444444-4444-4444-8444-444444444401', v_tenant_id, v_gestor_id, NULL, 'coordenacao',
         'Reunião de Pais - Infantil 4', 'Prezados responsáveis, convidamos todos para a reunião de pais da turma Infantil 4 no próximo sábado às 9h. A confirmação pode ser feita pelo aplicativo.',
         'b4444444-4444-4444-8444-444444444401'),
        ('b4444444-4444-4444-8444-444444444402', v_tenant_id, v_gestor_id, NULL, 'financeiro',
         'Lembrete de Mensalidade - Outubro/2026', 'Gentileza regularizar as mensalidades com vencimento no dia 10. Para segunda via de boleto ou Pix, acesse o Portal da Família.',
         'b4444444-4444-4444-8444-444444444402'),
        ('b4444444-4444-4444-8444-444444444403', v_tenant_id, v_gestor_id, v_turma_fund, 'professor',
         'Passeio Pedagógico - 1º Ano A', 'A turma do 1º Ano A fará uma visita ao zoológico municipal. Enviar autorização assinada até quinta-feira e levar lanche reforçado.',
         'b4444444-4444-4444-8444-444444444403'),
        ('b4444444-4444-4444-8444-444444444404', v_tenant_id, v_gestor_id, NULL, 'coordenacao',
         'Aviso de Feriado Municipal', 'Informamos que não haverá aula no dia ' || TO_CHAR(v_hoje + 14, 'DD/MM/YYYY') || ' em razão do feriado municipal. Até lá!',
         'b4444444-4444-4444-8444-444444444404'),
        ('b4444444-4444-4444-8444-444444444405', v_tenant_id, v_gestor_id, v_turma_inf, 'nutricao',
         'Cardápio Sem Lactose - Infantil 4', 'A partir da próxima semana, o cardápio da turma Infantil 4 seguirá opção sem lactose para atender as restrições alimentares dos alunos. O cardápio completo está no Portal.',
         'b4444444-4444-4444-8444-444444444405')
    ON CONFLICT (id) DO NOTHING;

    -- ============================================================
    -- 4. FINANCEIRO: 2 faturas pagas e 1 atrasada recente
    -- Datas absolutas (como no seed base): a descrição do mês combina com o vencimento
    -- mesmo que a migration seja aplicada em outra data.
    -- ============================================================
    INSERT INTO faturas (
        id, tenant_id, aluno_id, descricao, valor, data_vencimento, metodo_pagamento, status,
        qr_code_pix, parcela_numero, parcela_total, valor_original, desconto_percentual
    ) VALUES
        ('b5555555-5555-4555-8555-555555555501', v_tenant_id, v_aluno_3,
         'Mensalidade Agosto/2026', 1250.00, DATE '2026-08-10', 'boleto', 'pago', NULL, 1, 1, 1250.00, 0),
        ('b5555555-5555-4555-8555-555555555502', v_tenant_id, v_aluno_5,
         'Mensalidade Setembro/2026', 1450.00, DATE '2026-09-10', 'pix', 'pago', NULL, 1, 1, 1450.00, 0),
        ('b5555555-5555-4555-8555-555555555503', v_tenant_id, v_aluno_3,
         'Mensalidade Outubro/2026', 1250.00, DATE '2026-10-05', 'pix', 'atrasado',
         NULL, 1, 1, 1250.00, 0)
    ON CONFLICT (id) DO NOTHING;

    -- ============================================================
    -- 5. IA ANTI-EVASÃO: sinais em Bruno (faltas e nota baixa) e Carla (nota baixa e atraso)
    -- As aulas ficam nos últimos 30 dias porque o score lê a janela CURRENT_DATE - 30 dias.
    -- ============================================================
    -- Diários no passado para Bruno com baixa frequência
    INSERT INTO diarios_classe (id, tenant_id, turma_id, professor_id, data_aula, conteudo_ministrado)
    VALUES
        ('b6666666-6666-4666-8666-666666666601', v_tenant_id, v_turma_fund, v_prof_id, v_hoje - 28, 'Revisão de adição e subtração'),
        ('b6666666-6666-4666-8666-666666666602', v_tenant_id, v_turma_fund, v_prof_id, v_hoje - 21, 'Leitura de texto informativo'),
        ('b6666666-6666-4666-8666-666666666603', v_tenant_id, v_turma_fund, v_prof_id, v_hoje - 14, 'Resolução de problemas simples'),
        ('b6666666-6666-4666-8666-666666666604', v_tenant_id, v_turma_fund, v_prof_id, v_hoje - 7, 'Produção textual livre')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO presencas (id, tenant_id, diario_id, aluno_id, presente, justificativa)
    VALUES
        -- Bruno: 1 de 4 aulas presente nos últimos 30 dias
        ('b7777777-7777-4777-8777-777777777601', v_tenant_id, 'b6666666-6666-4666-8666-666666666601', v_aluno_2, false, 'Falta não justificada'),
        ('b7777777-7777-4777-8777-777777777602', v_tenant_id, 'b6666666-6666-4666-8666-666666666602', v_aluno_2, false, NULL),
        ('b7777777-7777-4777-8777-777777777603', v_tenant_id, 'b6666666-6666-4666-8666-666666666603', v_aluno_2, false, NULL),
        ('b7777777-7777-4777-8777-777777777604', v_tenant_id, 'b6666666-6666-4666-8666-666666666604', v_aluno_2, true, NULL),
        -- Alice e Carla: presenças para manter coerência dos diários
        ('b7777777-7777-4777-8777-777777777611', v_tenant_id, 'b6666666-6666-4666-8666-666666666601', v_aluno_1, true, NULL),
        ('b7777777-7777-4777-8777-777777777612', v_tenant_id, 'b6666666-6666-4666-8666-666666666601', v_aluno_3, true, NULL),
        ('b7777777-7777-4777-8777-777777777613', v_tenant_id, 'b6666666-6666-4666-8666-666666666602', v_aluno_1, true, NULL),
        ('b7777777-7777-4777-8777-777777777614', v_tenant_id, 'b6666666-6666-4666-8666-666666666602', v_aluno_3, false, 'Consulta médica'),
        ('b7777777-7777-4777-8777-777777777615', v_tenant_id, 'b6666666-6666-4666-8666-666666666603', v_aluno_1, true, NULL),
        ('b7777777-7777-4777-8777-777777777616', v_tenant_id, 'b6666666-6666-4666-8666-666666666603', v_aluno_3, true, NULL),
        ('b7777777-7777-4777-8777-777777777617', v_tenant_id, 'b6666666-6666-4666-8666-666666666604', v_aluno_1, true, NULL),
        ('b7777777-7777-4777-8777-777777777618', v_tenant_id, 'b6666666-6666-4666-8666-666666666604', v_aluno_3, true, NULL)
    ON CONFLICT (id) DO NOTHING;

    -- Notas baixas para Bruno e Carla
    INSERT INTO notas (id, tenant_id, aluno_id, disciplina_nome, nota, periodo)
    VALUES
        ('b8888888-8888-4888-8888-888888888801', v_tenant_id, v_aluno_2, 'Língua Portuguesa', 4.2, '2_bimestre'),
        ('b8888888-8888-4888-8888-888888888802', v_tenant_id, v_aluno_2, 'Matemática', 3.8, '2_bimestre'),
        ('b8888888-8888-4888-8888-888888888803', v_tenant_id, v_aluno_3, 'Língua Portuguesa', 4.5, '2_bimestre'),
        ('b8888888-8888-4888-8888-888888888804', v_tenant_id, v_aluno_3, 'Ciências da Natureza', 4.0, '2_bimestre')
    ON CONFLICT (id) DO NOTHING;
END $$;