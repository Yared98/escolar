-- Seed DEMO (filtrado em producao via SEEDS_DEMO): grade semanal da professora demo e login de secretaria.
-- Sem isso a tela "Meu dia" do professor fica vazia na demonstracao e nao ha como mostrar o perfil Secretaria.
-- Idempotente: no-op sem o tenant escola-modelo; ids fixos com ON CONFLICT DO NOTHING; nao altera dados existentes.
DO $$
DECLARE
    v_tenant_id UUID;
    v_prof_id UUID;
    v_pwd TEXT;
    v_turma_fund UUID := 'a3333333-3333-4333-8333-333333333301';
    v_sala UUID;
    v_lp UUID;
    v_mat UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'escola-modelo';
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    PERFORM set_config('app.current_tenant', v_tenant_id::text, true);

    SELECT id, password_hash INTO v_prof_id, v_pwd
    FROM users WHERE tenant_id = v_tenant_id AND email = 'professor@escolamodelo.com.br';
    IF v_prof_id IS NULL THEN
        RETURN;
    END IF;

    -- Login de secretaria com a mesma senha demo dos outros perfis (documentada no CORE_SPEC).
    INSERT INTO users (id, tenant_id, name, email, password_hash, role)
    VALUES ('a1111111-1111-4111-8111-111111111106', v_tenant_id, 'Beatriz Secretaria',
            'secretaria@escolamodelo.com.br', v_pwd, 'secretaria')
    ON CONFLICT (tenant_id, email) DO NOTHING;

    SELECT id INTO v_sala FROM salas WHERE tenant_id = v_tenant_id AND nome = 'Sala 101' LIMIT 1;

    SELECT tp.disciplina_id INTO v_lp
    FROM turma_professores tp JOIN disciplinas d ON d.id = tp.disciplina_id
    WHERE tp.tenant_id = v_tenant_id AND tp.professor_id = v_prof_id
      AND tp.turma_id = v_turma_fund AND d.nome = 'Língua Portuguesa'
    LIMIT 1;

    SELECT tp.disciplina_id INTO v_mat
    FROM turma_professores tp JOIN disciplinas d ON d.id = tp.disciplina_id
    WHERE tp.tenant_id = v_tenant_id AND tp.professor_id = v_prof_id
      AND tp.turma_id = v_turma_fund AND d.nome = 'Matemática'
    LIMIT 1;

    IF v_lp IS NULL OR v_mat IS NULL THEN
        RETURN;
    END IF;

    -- 1º Ano A, segunda a sexta: dois horários por manhã, alternando Língua Portuguesa e Matemática.
    INSERT INTO horarios_turma (id, tenant_id, turma_id, disciplina_id, professor_id, sala_id, dia_semana, hora_inicio, hora_fim)
    VALUES
        ('b9999999-9999-4999-8999-999999999101', v_tenant_id, v_turma_fund, v_lp,  v_prof_id, v_sala, 1, '07:30', '08:20'),
        ('b9999999-9999-4999-8999-999999999102', v_tenant_id, v_turma_fund, v_mat, v_prof_id, v_sala, 1, '08:20', '09:10'),
        ('b9999999-9999-4999-8999-999999999201', v_tenant_id, v_turma_fund, v_mat, v_prof_id, v_sala, 2, '07:30', '08:20'),
        ('b9999999-9999-4999-8999-999999999202', v_tenant_id, v_turma_fund, v_lp,  v_prof_id, v_sala, 2, '08:20', '09:10'),
        ('b9999999-9999-4999-8999-999999999301', v_tenant_id, v_turma_fund, v_lp,  v_prof_id, v_sala, 3, '07:30', '08:20'),
        ('b9999999-9999-4999-8999-999999999302', v_tenant_id, v_turma_fund, v_mat, v_prof_id, v_sala, 3, '08:20', '09:10'),
        ('b9999999-9999-4999-8999-999999999401', v_tenant_id, v_turma_fund, v_mat, v_prof_id, v_sala, 4, '07:30', '08:20'),
        ('b9999999-9999-4999-8999-999999999402', v_tenant_id, v_turma_fund, v_lp,  v_prof_id, v_sala, 4, '08:20', '09:10'),
        ('b9999999-9999-4999-8999-999999999501', v_tenant_id, v_turma_fund, v_lp,  v_prof_id, v_sala, 5, '07:30', '08:20'),
        ('b9999999-9999-4999-8999-999999999502', v_tenant_id, v_turma_fund, v_mat, v_prof_id, v_sala, 5, '08:20', '09:10')
    ON CONFLICT (id) DO NOTHING;
END $$;
