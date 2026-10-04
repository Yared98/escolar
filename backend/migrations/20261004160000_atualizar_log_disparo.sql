-- Migration: Função para atualizar log de disparos após envio real ou falha pelo worker
CREATE OR REPLACE FUNCTION atualizar_log_disparo(
    p_tenant UUID,
    p_notificacao UUID,
    p_canal TEXT,
    p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM set_config('app.current_tenant', p_tenant::text, true);
    UPDATE notificacoes_disparos_logs
    SET status_envio = p_status
    WHERE tenant_id = p_tenant
      AND notificacao_id = p_notificacao
      AND (
        canal = p_canal
        OR (p_canal IN ('push_pwa', 'web_push_pwa') AND canal IN ('push_pwa', 'web_push_pwa'))
      );
END;
$$;

REVOKE ALL ON FUNCTION atualizar_log_disparo(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION atualizar_log_disparo(UUID, UUID, TEXT, TEXT) TO escolar_runtime;
