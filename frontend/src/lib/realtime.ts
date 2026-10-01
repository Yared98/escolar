'use client';

import { useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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

    const connect = () => {
      if (closed) return;
      const token = localStorage.getItem('escolar_jwt_token');
      if (!token) return;

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
          retryTimer = setTimeout(connect, 4000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [enabled]);
}
