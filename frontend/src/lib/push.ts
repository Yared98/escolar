'use client';

import { API_BASE, garantirTokenDeAcesso } from './session';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return buffer;
}

export async function ensurePushReady(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const reg = await navigator.serviceWorker.register('/push-sw.js');
    await navigator.serviceWorker.ready;

    // Inscrição Web Push (quando suportado)
    if ('PushManager' in window) {
      try {
        const token = await garantirTokenDeAcesso();
        const tenantId = localStorage.getItem('escolar_tenant_id');
        if (token) {
          const vapidRes = await fetch(`${API_BASE}/notificacoes/push/vapid-public-key`, {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
            },
          });
          if (vapidRes.ok) {
            const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
            if (publicKey) {
              let sub = await reg.pushManager.getSubscription();
              if (!sub) {
                sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(publicKey),
                });
              }
              const json = sub.toJSON();
              if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
                await fetch(`${API_BASE}/notificacoes/push/subscribe`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
                  },
                  body: JSON.stringify({
                    endpoint: json.endpoint,
                    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
                  }),
                });
              }
            }
          }
        }
      } catch {
        // inscrição push é best-effort; notificação local via SW ainda funciona
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function notifyNovaMensagem(title: string, body: string, url?: string) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const payload = {
    type: 'SHOW_NOTIFICATION',
    title,
    body,
    url: url || '/?route=agenda&tab=comunicacao',
    tag: 'escolar-mensagem',
  };

  try {
    const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
    if (reg?.active) {
      reg.active.postMessage(payload);
      return;
    }
  } catch {
    // fallback abaixo
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(title, {
      body,
      tag: 'escolar-mensagem',
    });
  } catch {
    // ignore
  }
}
