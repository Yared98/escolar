/**
 * Dispatcher multicanal para notificações (WhatsApp, Push PWA, Cobrança, Portaria)
 */

export function resolveNotificationJob(canal) {
  const value = String(canal || '').toLowerCase();
  if (value === 'push_pwa' || value === 'web_push_pwa') return 'push_pwa';
  if (value.includes('whatsapp')) return 'whatsapp';
  if (value.includes('regua') || value === 'cobranca') return 'regua_cobranca';
  if (value.includes('perimetro')) return 'perimetro_alerta';
  return null;
}

export async function processPushPwaNotification(payload) {
  const { tenant_id, aluno_id, titulo, mensagem, prioridade } = payload;
  // Simulação de push notification com baixo overhead
  // Em produção, aciona web-push com VAPID keys
  const timestamp = new Date().toISOString();
  console.log(`[Push PWA] [${timestamp}] Aluno ${aluno_id || 'N/A'}: ${titulo} - ${mensagem} (Prioridade: ${prioridade})`);
  return { status: 'delivered', channel: 'push_pwa', timestamp };
}

export async function processWhatsAppWebhook(payload) {
  const { telefone, texto, template } = payload;
  const timestamp = new Date().toISOString();
  // Sanitiza número de telefone
  const cleanPhone = String(telefone).replace(/\D/g, '');
  console.log(`[WhatsApp Dispatcher] [${timestamp}] Enviando para ${cleanPhone}: "${texto || template}"`);
  return { status: 'sent', provider: 'whatsapp_cloud_api', phone: cleanPhone, timestamp };
}

export async function processReguaCobranca(payload) {
  const { fatura_id, valor, vencimento, canal, responsavel_nome } = payload;
  const timestamp = new Date().toISOString();
  console.log(`[Régua Cobrança] [${timestamp}] Fatura ${fatura_id} (R$ ${valor}) Vcto: ${vencimento} -> ${responsavel_nome} via ${canal}`);
  return { status: 'notified', fatura_id, timestamp };
}

export async function processPerimetroAlert(payload) {
  const { aluno_nome, direcao, ponto_acesso, responsavel_id } = payload;
  const timestamp = new Date().toISOString();
  console.log(`[Portaria Alerta] [${timestamp}] Aluno ${aluno_nome} realizou ${direcao} em '${ponto_acesso}'. Responsável ${responsavel_id} alertado.`);
  return { status: 'alerted', timestamp };
}
