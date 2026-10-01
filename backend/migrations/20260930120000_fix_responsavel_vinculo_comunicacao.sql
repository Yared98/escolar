-- Garante vínculo portal família ↔ alunos demo (Elena e Felipe / Infantil 4).

DO $$
DECLARE
    v_tenant_id UUID;
    v_resp_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'escola-modelo';
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    SELECT id INTO v_resp_id
    FROM users
    WHERE tenant_id = v_tenant_id AND email = 'familia@escolamodelo.com.br';

    IF v_resp_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id, parentesco)
    SELECT v_tenant_id, v_resp_id, a.id, 'Mãe'
    FROM alunos a
    WHERE a.tenant_id = v_tenant_id
      AND a.id IN (
        'a4444444-4444-4444-8444-444444444405',
        'a4444444-4444-4444-8444-444444444406'
      )
    ON CONFLICT (tenant_id, responsavel_user_id, aluno_id) DO NOTHING;

    UPDATE alunos
    SET responsavel_user_id = v_resp_id
    WHERE tenant_id = v_tenant_id
      AND id IN (
        'a4444444-4444-4444-8444-444444444405',
        'a4444444-4444-4444-8444-444444444406'
      );
END $$;
