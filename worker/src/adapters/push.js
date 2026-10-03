import webpush from 'web-push';

export class SimulatedPushAdapter {
  constructor(_options = {}) {
    this.name = 'simulated';
  }

  async send(payload, _options = {}) {
    const timestamp = new Date().toISOString();
    console.log(
      `[Push PWA Simulated] [${timestamp}] Aluno ${payload.aluno_id || 'N/A'}: ${payload.titulo || ''} - ${payload.mensagem || ''}`
    );
    return { status: 'simulated', channel: 'push_pwa', timestamp };
  }
}

export class VapidPushAdapter {
  constructor(options = {}) {
    this.name = 'vapid';
    this.webpush = options.webpush || webpush;
    this.subject = options.subject || process.env.VAPID_SUBJECT;
    this.publicKey = options.publicKey || process.env.VAPID_PUBLIC_KEY;
    this.privateKey = options.privateKey || process.env.VAPID_PRIVATE_KEY;

    if (!this.subject || !this.publicKey || !this.privateKey) {
      console.warn(
        '[VapidPushAdapter] VAPID keys incomplete. Required: VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.'
      );
    } else {
      try {
        this.webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
      } catch (err) {
        console.warn('[VapidPushAdapter] Failed to set VAPID details:', err.message);
      }
    }
  }

  async send(payload, options = {}) {
    const db = options.client || options.db || payload.dbClient;
    const wp = options.webpush || this.webpush;
    const timestamp = new Date().toISOString();

    let subscriptions = [];
    if (payload.subscription) {
      subscriptions = [payload.subscription];
    } else if (Array.isArray(payload.subscriptions) && payload.subscriptions.length > 0) {
      subscriptions = payload.subscriptions;
    } else if ((payload.destinatario_id || payload.user_id) && db) {
      const userId = payload.destinatario_id || payload.user_id;
      const tenantId = payload.tenant_id;
      const queryStr = tenantId
        ? 'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id = $1 AND user_id = $2'
        : 'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1';
      const params = tenantId ? [tenantId, userId] : [userId];
      const res = await db.query(queryStr, params);
      subscriptions = res.rows.map((r) => ({
        endpoint: r.endpoint,
        keys: { p256dh: r.p256dh, auth: r.auth },
      }));
    }

    if (subscriptions.length === 0) {
      return {
        status: 'simulated',
        channel: 'push_pwa',
        reason: 'no_subscriptions',
        timestamp,
      };
    }

    const pushPayload =
      typeof payload.mensagem === 'string'
        ? JSON.stringify({
            title: payload.titulo || 'Notificação',
            body: payload.mensagem,
            data: {
              tenant_id: payload.tenant_id,
              aluno_id: payload.aluno_id,
              destinatario_id: payload.destinatario_id,
              prioridade: payload.prioridade,
            },
          })
        : JSON.stringify(payload);

    let deliveredCount = 0;
    const expiredEndpoints = [];

    for (const sub of subscriptions) {
      const subObject = {
        endpoint: sub.endpoint,
        keys: sub.keys || { p256dh: sub.p256dh, auth: sub.auth },
      };

      try {
        await wp.sendNotification(subObject, pushPayload);
        deliveredCount += 1;
      } catch (err) {
        const statusCode = err?.statusCode || (err?.response && err.response.statusCode);
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
          console.warn(`[VapidPushAdapter] Subscription expirada (${statusCode}). Removendo ${sub.endpoint}`);
          if (db) {
            try {
              await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
            } catch (dbErr) {
              console.error('[VapidPushAdapter] Erro ao remover subscription expirada:', dbErr.message);
            }
          }
        } else {
          console.error(`[VapidPushAdapter] Erro ao enviar push para ${sub.endpoint}:`, err.message);
          throw err;
        }
      }
    }

    if (deliveredCount > 0) {
      return {
        status: 'delivered',
        channel: 'push_pwa',
        deliveredCount,
        expiredEndpoints,
        timestamp,
      };
    }

    return {
      status: 'failed',
      channel: 'push_pwa',
      deliveredCount: 0,
      expiredEndpoints,
      timestamp,
    };
  }
}

export function getPushAdapter(mode = process.env.PUSH_MODE, options = {}) {
  const selected = String(mode || '').toLowerCase().trim();
  if (selected === 'vapid') {
    return new VapidPushAdapter(options);
  }
  return new SimulatedPushAdapter(options);
}
