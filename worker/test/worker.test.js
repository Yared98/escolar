import { JobQueue } from '../src/queue.js';
import {
  processPushPwaNotification,
  processWhatsAppWebhook,
  processReguaCobranca,
  processPerimetroAlert,
  resolveNotificationJob,
} from '../src/dispatcher.js';
import { VapidPushAdapter, SimulatedPushAdapter, getPushAdapter } from '../src/adapters/push.js';

import { processNotificationRow } from '../src/index.js';

async function runTests() {
  console.log('--- Executando Testes Unitários do Worker Node.js ---');

  const queue = new JobQueue({ concurrency: 2, maxRetries: 2, backoffMs: 50 });

  queue.registerHandler('push_pwa', processPushPwaNotification);
  queue.registerHandler('whatsapp', processWhatsAppWebhook);
  queue.registerHandler('regua_cobranca', processReguaCobranca);
  queue.registerHandler('perimetro_alerta', processPerimetroAlert);

  // Testes de Atualização de Log de Disparo (atualizar_log_disparo)
  const logCalls = [];
  const mockLogClient = {
    query: async (sql, params) => {
      if (sql.includes('atualizar_log_disparo')) {
        logCalls.push({ sql, params });
      }
      return { rows: [] };
    },
  };

  // Teste B19.1: Delivered -> enviado
  const rowDelivered = {
    id: 'notif-1',
    tenant_id: 'tenant-1',
    canal_disparo: 'push_pwa',
    tentativas: 1,
    titulo: 'Teste',
    mensagem: 'Mensagem',
  };
  const mockHandlersDelivered = {
    push_pwa: async () => ({ status: 'delivered' }),
  };
  const resDelivered = await processNotificationRow(rowDelivered, {
    client: mockLogClient,
    handlers: mockHandlersDelivered,
  });
  const lastCallDelivered = logCalls[logCalls.length - 1];
  const deliveredLogPassed =
    resDelivered.logStatus === 'enviado' &&
    lastCallDelivered &&
    lastCallDelivered.params[3] === 'enviado';
  console.log('Teste Log Status Delivered -> enviado:', resDelivered.logStatus, deliveredLogPassed);

  // Teste B19.2: Simulated -> simulado
  const rowSimulated = {
    id: 'notif-2',
    tenant_id: 'tenant-1',
    canal_disparo: 'push_pwa',
    tentativas: 1,
    titulo: 'Teste',
    mensagem: 'Mensagem',
  };
  const mockHandlersSimulated = {
    push_pwa: async () => ({ status: 'simulated' }),
  };
  const resSimulated = await processNotificationRow(rowSimulated, {
    client: mockLogClient,
    handlers: mockHandlersSimulated,
  });
  const lastCallSimulated = logCalls[logCalls.length - 1];
  const simulatedLogPassed =
    resSimulated.logStatus === 'simulado' &&
    lastCallSimulated &&
    lastCallSimulated.params[3] === 'simulado';
  console.log('Teste Log Status Simulated -> simulado:', resSimulated.logStatus, simulatedLogPassed);

  // Teste B19.3: Falha definitiva (tentativas >= 3) -> falhou
  const rowFailed = {
    id: 'notif-3',
    tenant_id: 'tenant-1',
    canal_disparo: 'push_pwa',
    tentativas: 3,
    titulo: 'Teste',
    mensagem: 'Mensagem',
  };
  const mockHandlersFailed = {
    push_pwa: async () => {
      throw new Error('Falha de rede definitiva');
    },
  };
  const resFailed = await processNotificationRow(rowFailed, {
    client: mockLogClient,
    handlers: mockHandlersFailed,
  });
  const lastCallFailed = logCalls[logCalls.length - 1];
  const failedLogPassed =
    resFailed.logStatus === 'falhou' &&
    lastCallFailed &&
    lastCallFailed.params[3] === 'falhou';
  console.log('Teste Log Status Falha Definitiva -> falhou:', resFailed.logStatus, failedLogPassed);

  // Teste 1: Processamento de Push PWA (modo default simulated não retorna 'delivered')
  const simulatedResult = await processPushPwaNotification({
    aluno_id: 'test-uuid-1',
    titulo: 'Portaria: Entrada',
    mensagem: 'Aluno entrou às 07:15',
    prioridade: 'alta',
  });

  const simulatedDoesNotDeliver =
    simulatedResult.status === 'simulated' && simulatedResult.status !== 'delivered';
  console.log('Teste Push Simulated Status:', simulatedResult.status, '(não delivered):', simulatedDoesNotDeliver);

  // Teste 2: Processamento de WhatsApp (stub retorna simulated e provider null)
  const whatsAppResult = await processWhatsAppWebhook({
    telefone: '(11) 98765-4321',
    texto: 'Sua 2ª via Pix está disponível',
  });
  const whatsAppIsStub = whatsAppResult.status === 'simulated' && whatsAppResult.provider === null;
  console.log('Teste WhatsApp Stub:', whatsAppResult.status, 'provider:', whatsAppResult.provider, whatsAppIsStub);

  // Teste 3: Processamento de Push no modo VAPID com mock marca 'delivered'
  const mockWebPushSuccess = {
    setVapidDetails: () => {},
    sendNotification: async () => ({ statusCode: 201 }),
  };
  const vapidAdapter = new VapidPushAdapter({
    webpush: mockWebPushSuccess,
    subject: 'mailto:test@escolar.local',
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
  });

  const vapidSuccessResult = await vapidAdapter.send({
    titulo: 'Aviso Escolar',
    mensagem: 'Reunião pedagógica amanhã',
    subscription: {
      endpoint: 'https://push.example.com/sub/user-123',
      keys: { p256dh: 'mock-p256dh', auth: 'mock-auth' },
    },
  });

  const vapidDelivered = vapidSuccessResult.status === 'delivered' && vapidSuccessResult.deliveredCount === 1;
  console.log('Teste VAPID Mock Delivered:', vapidSuccessResult.status, 'count:', vapidSuccessResult.deliveredCount, vapidDelivered);

  // Teste 4: Subscription 410 (Gone) é desativada / removida do banco
  let deletedEndpoint = null;
  const mockDb = {
    query: async (sql, params) => {
      if (sql.includes('DELETE FROM push_subscriptions')) {
        deletedEndpoint = params[0];
      }
      return { rows: [] };
    },
  };

  const mockWebPush410 = {
    setVapidDetails: () => {},
    sendNotification: async () => {
      const err = new Error('Subscription has expired or is no longer valid');
      err.statusCode = 410;
      throw err;
    },
  };

  const vapid410Adapter = new VapidPushAdapter({
    webpush: mockWebPush410,
    subject: 'mailto:test@escolar.local',
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
  });

  const vapid410Result = await vapid410Adapter.send(
    {
      titulo: 'Aviso de teste 410',
      mensagem: 'Mensagem para endpoint expirado',
      subscription: {
        endpoint: 'https://push.example.com/sub/expired-410',
        keys: { p256dh: 'mock-p256dh', auth: 'mock-auth' },
      },
    },
    { client: mockDb }
  );

  const subscription410Removed =
    deletedEndpoint === 'https://push.example.com/sub/expired-410' &&
    vapid410Result.status !== 'delivered' &&
    vapid410Result.expiredEndpoints?.includes('https://push.example.com/sub/expired-410');
  console.log('Teste VAPID 410 Deletado:', deletedEndpoint, subscription410Removed);

  // Testes de Fila
  queue.enqueue('push_pwa', {
    aluno_id: 'test-uuid-1',
    titulo: 'Portaria: Entrada',
    mensagem: 'Aluno entrou às 07:15',
    prioridade: 'alta',
  });

  queue.enqueue('whatsapp', {
    telefone: '(11) 98765-4321',
    texto: 'Sua 2ª via Pix está disponível',
  });

  queue.enqueue('regua_cobranca', {
    fatura_id: 'fat-123',
    valor: 450.0,
    vencimento: '2026-09-30',
    canal: 'whatsapp',
    responsavel_nome: 'Mariana Lima',
  });

  let failAttempts = 0;
  queue.registerHandler('failing_job', async (_payload) => {
    failAttempts++;
    if (failAttempts < 2) {
      throw new Error('Falha simulada de rede');
    }
    return { ok: true };
  });

  queue.enqueue('failing_job', { id: 'fail-1' });

  // Aguarda processamento assíncrono da fila
  await new Promise((resolve) => setTimeout(resolve, 800));

  const stats = queue.getStats();
  console.log('Estatísticas do Teste:', stats);

  const mapped = [
    resolveNotificationJob('push_pwa') === 'push_pwa',
    resolveNotificationJob('whatsapp_api') === 'whatsapp',
    resolveNotificationJob('regua_cobranca') === 'regua_cobranca',
    resolveNotificationJob('perimetro_alerta') === 'perimetro_alerta',
    resolveNotificationJob('canal_desconhecido') === null,
  ].every(Boolean);

  const allPassed =
    stats.processed >= 4 &&
    failAttempts === 2 &&
    mapped &&
    simulatedDoesNotDeliver &&
    whatsAppIsStub &&
    vapidDelivered &&
    subscription410Removed &&
    deliveredLogPassed &&
    simulatedLogPassed &&
    failedLogPassed;

  if (allPassed) {
    console.log('[SUCESSO] 100% dos testes do Worker Node.js passaram com êxito!');
    process.exit(0);
  } else {
    console.error('[FALHA] Divergência nas métricas ou asserções do Worker.');
    process.exit(1);
  }
}

runTests();

