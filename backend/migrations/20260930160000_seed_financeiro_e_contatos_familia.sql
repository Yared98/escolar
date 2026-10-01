-- Usuário financeiro demo + contatos restritos para responsáveis.

DO $$
DECLARE
    v_tenant_id UUID;
    v_fin_id UUID := 'a1111111-1111-4111-8111-111111111105';
    v_pwd TEXT := '$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY$KDSsoMBh5nKEezS+W4Rfrzq2DWJcIDWSiLRgdsEdE4I';
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'escola-modelo';
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO users (id, tenant_id, name, email, password_hash, role)
    VALUES (v_fin_id, v_tenant_id, 'Paula Financeiro', 'financeiro@escolamodelo.com.br', v_pwd, 'financeiro')
    ON CONFLICT (tenant_id, email) DO UPDATE
      SET role = 'financeiro',
          name = EXCLUDED.name;
END $$;
