'use client';

import { useEffect, useRef } from 'react';

import { API_BASE, garantirTokenDeAcesso, renovarSessao } from './session';

export type MensagemRealtimePayload = {
  tipo: string;
  tenant_id: string;
  mensagem_id: string;
  thread_id?: string | null;
  remetente_id: string;
  destinatario_id?: string | null;
  titulo: string;
  conteudo: string;
  canal: string;
};

type Handlers = {
  onMensagemNova?: (payload: MensagemRealtimePayload) => void;
  onResync?: () => void;
};

/**
 * Mantém EventSource autenticado via query token (headers não são suportados pelo EventSource).
 */
export function useMensagensRealtime(enabled: boolean, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let es: EventSource | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (closed) return;
      // O token fica só em memória: depois de recarregar a página ele vem do cookie de sessão.
      const token = await garantirTokenDeAcesso();
      if (!token || closed) return;

      es?.close();
      es = new EventSource(
        `${API_BASE}/agenda/mensagens/stream?access_token=${encodeURIComponent(token)}`,
      );

      es.addEventListener('mensagem_nova', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as MensagemRealtimePayload;
          handlersRef.current.onMensagemNova?.(data);
          window.dispatchEvent(new CustomEvent('escolar:mensagem_nova', { detail: data }));
        } catch {
          // ignore malformed
        }
      });

      es.addEventListener('resync', () => {
        handlersRef.current.onResync?.();
      });

      es.onerror = () => {
        es?.close();
        if (!closed) {
          // o token de acesso dura 15 min: renova antes de tentar de novo
          retryTimer = setTimeout(() => {
            void renovarSessao().finally(() => void connect());
          }, 4000);
        }
      };
    };

    void connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [enabled]);
}
