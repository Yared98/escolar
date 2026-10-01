import { JobQueue } from '../src/queue.js';
import {
  processPushPwaNotification,
  processWhatsAppWebhook,
  processReguaCobranca,
  processPerimetroAlert,
  resolveNotificationJob,
} from '../src/dispatcher.js';

async function runTests() {
  console.log('--- Executando Testes Unitários do Worker Node.js ---');

  const queue = new JobQueue({ concurrency: 2, maxRetries: 2, backoffMs: 50 });

  queue.registerHandler('push_pwa', processPushPwaNotification);
  queue.registerHandler('whatsapp', processWhatsAppWebhook);
  queue.registerHandler('regua_cobranca', processReguaCobranca);
  queue.registerHandler('perimetro_alerta', processPerimetroAlert);

  // Teste 1: Processamento de Push PWA
  let pwaDone = false;
  queue.enqueue('push_pwa', {
    aluno_id: 'test-uuid-1',
    titulo: 'Portaria: Entrada',
    mensagem: 'Aluno entrou às 07:15',
    prioridade: 'alta',
  });

  // Teste 2: Processamento de WhatsApp
  queue.enqueue('whatsapp', {
    telefone: '(11) 98765-4321',
    texto: 'Sua 2ª via Pix está disponível',
  });

  // Teste 3: Processamento de Régua
  queue.enqueue('regua_cobranca', {
    fatura_id: 'fat-123',
    valor: 450.0,
    vencimento: '2026-09-30',
    canal: 'whatsapp',
    responsavel_nome: 'Mariana Lima',
  });

  // Teste 4: Retry de job com falha
  let failAttempts = 0;
  queue.registerHandler('failing_job', async (payload) => {
    failAttempts++;
    if (failAttempts < 2) {
      throw new Error('Falha simulada de rede');
    }
    return { ok: true };
  });

  queue.enqueue('failing_job', { id: 'fail-1' });

  // Aguarda processamento assíncrono
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

  if (stats.processed >= 4 && failAttempts === 2 && mapped) {
    console.log('[SUCESSO] 100% dos testes do Worker Node.js passaram com êxito!');
    process.exit(0);
  } else {
    console.error('[FALHA] Divergência nas métricas de execução do Worker.');
    process.exit(1);
  }
}

runTests();
