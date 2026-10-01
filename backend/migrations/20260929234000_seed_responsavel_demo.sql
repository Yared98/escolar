DO $$
DECLARE
    v_tenant_id UUID;
    v_resp_id UUID := 'a1111111-1111-4111-8111-111111111104';
    v_pwd TEXT := '$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY$KDSsoMBh5nKEezS+W4Rfrzq2DWJcIDWSiLRgdsEdE4I';
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'escola-modelo';
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO users (id, tenant_id, name, email, password_hash, role)
    VALUES (v_resp_id, v_tenant_id, 'Marina Andrade', 'familia@escolamodelo.com.br', v_pwd, 'responsavel')
    ON CONFLICT (tenant_id, email) DO NOTHING;

    SELECT id INTO v_resp_id FROM users WHERE tenant_id = v_tenant_id AND email = 'familia@escolamodelo.com.br';

    INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id, parentesco)
    SELECT v_tenant_id, v_resp_id, a.id, 'Mãe'
    FROM alunos a
    WHERE a.tenant_id = v_tenant_id
      AND a.id IN ('a4444444-4444-4444-8444-444444444405', 'a4444444-4444-4444-8444-444444444406')
    ON CONFLICT (tenant_id, responsavel_user_id, aluno_id) DO NOTHING;
END $$;
