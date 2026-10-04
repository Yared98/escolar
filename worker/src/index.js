/**
 * Escolar ERP - Notification & Webhook Background Worker
 * Executa em Node.js (WSL2 / Docker) com zero custo de infraestrutura
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { JobQueue } from './queue.js';
import {
  processPushPwaNotification,
  processWhatsAppWebhook,
  processReguaCobranca,
  processPerimetroAlert,
  resolveNotificationJob,
} from './dispatcher.js';

dotenv.config();

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://escolar_app:escolar_password@localhost:5432/escolar_db';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '3000', 10);

console.log('='.repeat(65));
console.log('  ESCOLAR ERP - WORKER DE NOTIFICAÇÕES & WEBHOOKS ASSÍNCRONOS');
console.log('  Ambiente: WSL2 / Node.js Engine (Zero Cost Infrastructure)');
console.log('='.repeat(65));

const queue = new JobQueue({ concurrency: 5, maxRetries: 3 });
const handlers = {
  push_pwa: processPushPwaNotification,
  whatsapp: processWhatsAppWebhook,
  regua_cobranca: processReguaCobranca,
  perimetro_alerta: processPerimetroAlert,
};

Object.entries(handlers).forEach(([type, handler]) => queue.registerHandler(type, handler));

let pool = null;

try {
  pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.warn('[Worker PG Pool] Conexão com PostgreSQL oscilou:', err.message);
  });
} catch (err) {
  console.warn('[Worker PG Pool] Inicializando em modo standalone:', err.message);
}

export async function processNotificationRow(row, { client, handlers: customHandlers }) {
  const activeHandlers = customHandlers || handlers;
  const jobType = resolveNotificationJob(row.canal_disparo);
  const handler = jobType ? activeHandlers[jobType] : null;
  let status = 'pendente';
  let logStatus = null;

  if (!handler) {
    if (Number(row.tentativas) >= 3) {
      status = 'falhou';
      logStatus = 'falhou';
    }
    console.error(`[Worker] Canal sem handler recuperável: ${row.canal_disparo} (${row.id})`);
  } else {
    try {
      if (client && client.query) {
        await client.query("SELECT set_config('app.current_tenant', $1, false)", [row.tenant_id]);
      }
      const result = await handler(
        {
          id: row.id,
          tenant_id: row.tenant_id,
          aluno_id: row.aluno_id,
          destinatario_id: row.destinatario_id,
          modulo: row.modulo,
          titulo: row.titulo,
          mensagem: row.mensagem,
          prioridade: row.prioridade,
        },
        { client }
      );
      if (result && (result.status === 'delivered' || result.status === 'sent')) {
        status = 'enviada';
        logStatus = 'enviado';
      } else {
        status = 'simulada';
        logStatus = 'simulado';
      }
    } catch (err) {
      if (Number(row.tentativas) >= 3) {
        status = 'falhou';
        logStatus = 'falhou';
      } else {
        status = 'pendente';
      }
      console.error(`[Worker] Falha ao entregar ${row.id}:`, err.message);
    }
  }

  if (client && client.query) {
    if (logStatus) {
      await client.query('SELECT atualizar_log_disparo($1, $2, $3, $4)', [
        row.tenant_id,
        row.id,
        row.canal_disparo,
        logStatus,
      ]);
    }
    await client.query('SELECT concluir_notificacao($1, $2, $3)', [row.id, row.tenant_id, status]);
  }

  return { status, logStatus };
}

async function pollDatabaseNotifications() {
  if (!pool) return;
  let client;

  try {
    client = await pool.connect();
    await client.query('SET ROLE escolar_runtime');
    const claimed = await client.query(
      'SELECT * FROM claim_notificacoes_pendentes($1)',
      [10],
    );

    for (const row of claimed.rows) {
      await processNotificationRow(row, { client, handlers });
    }
  } catch (err) {
    console.error('[Worker] Falha ao reservar notificações:', err.message);
  } finally {
    if (client) client.release();
  }
}

// Inicia polling se pool existir
if (pool) {
  setInterval(pollDatabaseNotifications, POLL_INTERVAL_MS);
}

// Log periódico de saúde a cada 30 segundos
setInterval(() => {
  const stats = queue.getStats();
  console.log(`[Worker Health] Jobs Processados: ${stats.processed} | Pendentes: ${stats.pending} | Ativos: ${stats.active} | Falhas: ${stats.failed}`);
}, 30000);

export { queue, pool, handlers, pollDatabaseNotifications };

