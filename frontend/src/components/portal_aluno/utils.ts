import type { MensagemPortal, ThreadPortal } from './types';

export const tituloTemaPortal = (titulo: string) => titulo.replace(/^(Re:\s*)+/i, '').trim() || titulo;

export const agruparThreadsPortal = (msgs: MensagemPortal[]): ThreadPortal[] => {
  const grupos = new Map<string, MensagemPortal[]>();
  for (const m of msgs) {
    const key = m.thread_id || m.resposta_a_id || m.id;
    const lista = grupos.get(key) || [];
    lista.push(m);
    grupos.set(key, lista);
  }
  const threads: ThreadPortal[] = [];
  for (const [key, lista] of grupos) {
    const ordenadas = [...lista].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const raiz =
      ordenadas.find((m) => m.id === key) ||
      ordenadas.find((m) => !m.resposta_a_id) ||
      ordenadas[0];
    threads.push({
      id: key,
      raiz,
      mensagens: ordenadas,
      respostas: Math.max(0, ordenadas.length - 1),
      ultima: ordenadas[ordenadas.length - 1],
    });
  }
  return threads.sort(
    (a, b) => new Date(b.ultima.created_at).getTime() - new Date(a.ultima.created_at).getTime(),
  );
};
