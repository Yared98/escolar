import { MensagemAgenda, ThreadAgenda } from './types';

export const rotuloCanal = (canal: string) => {
  switch (canal) {
    case 'mural_turma':
      return 'Mural';
    case 'professor':
      return 'Privado';
    case 'responsavel':
      return 'Família';
    case 'coordenacao':
      return 'Coordenação';
    case 'financeiro':
      return 'Financeiro';
    case 'nutricao':
      return 'Nutrição';
    default:
      return canal;
  }
};

export const estiloCanal = (canal: string) => {
  if (canal === 'mural_turma') return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200';
  if (canal === 'professor' || canal === 'responsavel') return 'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200';
  if (canal === 'coordenacao') return 'bg-salvia-100 text-salvia-900 dark:bg-salvia-900/60 dark:text-salvia-200';
  if (canal === 'financeiro') return 'bg-violet-100 text-violet-900';
  if (canal === 'nutricao') return 'bg-emerald-100 text-emerald-900';
  return 'bg-slate-200 text-slate-700';
};

export const formatarQuando = (iso: string) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  const agora = new Date();
  const diffMs = agora.getTime() - data.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Agora';
  if (min < 60) return `Há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `Há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Há ${dias} d`;
  return data.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const tituloTema = (titulo: string) => titulo.replace(/^(Re:\s*)+/i, '').trim() || titulo;

export const threadKeyOf = (m: MensagemAgenda) => m.thread_id || m.resposta_a_id || m.id;

export const agruparThreads = (msgs: MensagemAgenda[]): ThreadAgenda[] => {
  const grupos = new Map<string, MensagemAgenda[]>();
  for (const m of msgs) {
    const key = threadKeyOf(m);
    const lista = grupos.get(key) || [];
    lista.push(m);
    grupos.set(key, lista);
  }

  const threads: ThreadAgenda[] = [];
  for (const [key, lista] of grupos) {
    const ordenadas = [...lista].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const raiz =
      ordenadas.find((m) => m.id === key) ||
      ordenadas.find((m) => !m.resposta_a_id) ||
      ordenadas[0];
    const ultima = ordenadas[ordenadas.length - 1];
    threads.push({
      id: key,
      raiz,
      mensagens: ordenadas,
      respostas: Math.max(0, ordenadas.length - 1),
      ultima,
      temNaoLida: ordenadas.some((m) => !m.lida && m.id !== raiz.id),
    });
  }

  return threads.sort(
    (a, b) => new Date(b.ultima.created_at).getTime() - new Date(a.ultima.created_at).getTime(),
  );
};
