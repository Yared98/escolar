'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '@/lib/db';
import { apiFetch } from '@/lib/api';
import type { ToastMsg } from '@/lib/types/academico';

const ENDPOINT_BY_ENTITY: Record<string, string> = {
  diario_classe: '/academico/diario/sync',
  rotina_infantil: '/agenda/rotina',
  portfolio_infantil: '/pedagogico/portfolio',
};

export type SyncFlushMode = 'auto' | 'manual';

export function useOfflineSyncQueue(tenantId: string | undefined, isOnline: boolean) {
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState<ToastMsg | null>(null);
  const syncingRef = useRef(false);
  const tenantIdRef = useRef(tenantId);
  tenantIdRef.current = tenantId;

  const showToast = useCallback((toast: ToastMsg, ms = 4000) => {
    setToastMsg(toast);
    setTimeout(() => setToastMsg(null), ms);
  }, []);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const refreshPendingCount = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !db?.sync_events) return 0;
      const rows = await db.sync_events.where('status').anyOf(['pending', 'pending_sync']).toArray();
      const currentTenant = tenantIdRef.current;
      const count = currentTenant
        ? rows.filter((r) => r.tenant_id === currentTenant).length
        : rows.length;
      setPendingSyncCount(count);
      return count;
    } catch {
      return 0;
    }
  }, []);

  const enqueue = useCallback(
    async (entity: string, payload: Record<string, unknown>) => {
      const currentTenant = tenantIdRef.current;
      if (!currentTenant) {
        throw new Error('Sua sessão expirou. Entre novamente.');
      }
      const eventUuid = crypto.randomUUID();
      await db.sync_events.add({
        uuid: eventUuid,
        tenant_id: currentTenant,
        entity,
        action: 'create',
        payload,
        created_at: new Date().toISOString(),
        status: 'pending_sync',
      });
      await refreshPendingCount();
      return eventUuid;
    },
    [refreshPendingCount]
  );

  const removeByUuid = useCallback(
    async (uuid: string) => {
      await db.sync_events.where('uuid').equals(uuid).delete();
      await refreshPendingCount();
    },
    [refreshPendingCount]
  );

  const flush = useCallback(async (mode: SyncFlushMode = 'manual') => {
    if (syncingRef.current) return;
    if (mode === 'auto' && typeof navigator !== 'undefined' && !navigator.onLine) return;

    syncingRef.current = true;
    setSyncing(true);
    try {
      const pendentes = await db.sync_events
        .where('status')
        .anyOf(['pending', 'pending_sync'])
        .toArray();
      const currentTenant = tenantIdRef.current;
      const filtrados = currentTenant
        ? pendentes.filter((p) => p.tenant_id === currentTenant)
        : pendentes;

      if (filtrados.length === 0) {
        if (mode === 'manual') {
          showToastRef.current({ text: 'Nenhum item pendente na fila offline.', type: 'success' });
        }
        await refreshPendingCount();
        return;
      }

      let countSuccess = 0;
      let countFailed = 0;
      for (const item of filtrados) {
        const endpoint = ENDPOINT_BY_ENTITY[item.entity];
        if (!endpoint) {
          countFailed++;
          continue;
        }
        try {
          await apiFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(item.payload),
          });
          await db.sync_events.where('uuid').equals(item.uuid).delete();
          countSuccess++;
        } catch {
          countFailed++;
        }
      }

      await refreshPendingCount();
      if (countSuccess > 0 && countFailed === 0) {
        showToastRef.current({
          text: `${countSuccess} item(ns) do diário enviado(s) ao servidor.`,
          type: 'success',
        }, 4500);
      } else if (countFailed > 0) {
        showToastRef.current({
          text: countSuccess > 0
            ? `${countSuccess} enviado(s). ${countFailed} continuam na fila e saem ao reconectar.`
            : `${countFailed} item(ns) continuam na fila. O envio tenta de novo ao reconectar.`,
          type: 'warn',
        }, 4500);
      }
    } catch {
      showToastRef.current({
        text: 'Sem conexão com o servidor agora. O registro continua salvo neste aparelho e será enviado depois.',
        type: 'warn',
      }, 4500);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount, tenantId]);

  useEffect(() => {
    const kick = () => {
      if (navigator.onLine) {
        void flush('auto');
      } else {
        void refreshPendingCount();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') kick();
    };
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', onVisible);
    kick();
    return () => {
      window.removeEventListener('online', kick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [flush, refreshPendingCount]);

  useEffect(() => {
    if (isOnline) {
      void flush('auto');
    }
  }, [isOnline, flush]);

  return {
    pendingSyncCount,
    syncing,
    toastMsg,
    showToast,
    refreshPendingCount,
    enqueue,
    removeByUuid,
    flush,
  };
}
